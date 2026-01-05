# KnowledgeBase 페이지 개선 제안서

**작성일**: 2025-12-31
**상태**: Sprint 5 분석 완료
**우선순위**: Medium (Phase 8-9)

---

## 1. 현재 상태 분석

### 1.1 구현 현황

**UI 완성도**: ✅ 80% 완료
- Mock 데이터 기반 완전한 UI 구현
- 파일 업로드 영역 (Drag & Drop)
- 문서 목록 표시 (이름, 크기, 업로드일, 상태)
- 삭제 기능
- 상태 표시 (Processing, Ready, Error)

**백엔드 연동**: ❌ 0% 미구현
- API 엔드포인트 없음
- DynamoDB 테이블 없음
- S3 업로드 로직 없음
- RAG (Retrieval-Augmented Generation) 시스템 없음

**라우팅**: ✅ 완료
- `/knowledge-base` 라우팅 설정 완료
- ProtectedRoute로 인증 보호
- 메뉴 네비게이션 포함

### 1.2 파일 위치

```
src/pages/KnowledgeBase.tsx (114줄)
└── Mock 데이터 기반 UI 컴포넌트
```

### 1.3 코드 분석

**장점**:
- ✅ 깔끔한 UI/UX (Upload 영역, 문서 리스트)
- ✅ 상태 관리 (useState)
- ✅ 로딩 상태 표시 (Processing)
- ✅ lucide-react 아이콘 사용

**문제점**:
- ❌ 실제 파일 업로드 없음 (Mock 데이터만 추가)
- ❌ API 연동 없음
- ❌ S3 업로드 로직 없음
- ❌ 파일 검증 없음 (크기, 형식)
- ❌ RAG 시스템 미구현

---

## 2. 개선 방안 (3가지 옵션)

### 옵션 A: 완전 구현 (RAG 시스템) - 5-7일 소요

**목표**: 프로덕션급 학습 자료 관리 시스템

#### 2.1 아키텍처 설계

```
프론트엔드 (KnowledgeBase.tsx)
    ↓ 파일 업로드
S3 버킷 (ai-co-learner-documents)
    ↓ S3 Event → Lambda
Lambda (document-processor)
    ↓ 텍스트 추출, 청킹, 임베딩
DynamoDB (ai-co-learner-learning-resources)
    ↓ 메타데이터 저장
Vector DB (OpenSearch / Pinecone)
    ↓ 벡터 검색
Lambda (chat-api)
    ↓ RAG 컨텍스트 주입
Gemini 2.5 Flash
    ↓ 학습 자료 기반 응답
```

#### 2.2 필요한 AWS 리소스

**S3 버킷**:
```bash
# 문서 저장용 S3 버킷
ai-co-learner-documents/
├── raw/          # 원본 파일 (PDF, DOCX, TXT)
└── processed/    # 처리된 텍스트 (JSON)
```

**DynamoDB 테이블**:
```javascript
// ai-co-learner-learning-resources
{
  PK: 'USER#<userId>',
  SK: 'DOC#<documentId>',
  documentId: string,
  userId: string,
  title: string,
  fileName: string,
  s3Key: string,
  fileSize: number,
  mimeType: string,
  uploadDate: string,
  status: 'processing' | 'ready' | 'error',
  chunkCount: number,
  competency: CompetencyType,  // 연관 역량
  difficulty: 'beginner' | 'intermediate' | 'advanced',
  ttl: number (90일)
}
```

**Lambda 함수**:
```javascript
// document-processor Lambda
// 1. S3에서 파일 다운로드
// 2. 텍스트 추출 (PDF → 텍스트)
// 3. 청킹 (512 토큰 단위)
// 4. 임베딩 생성 (text-embedding-3-small API)
// 5. Vector DB 저장
// 6. DynamoDB 메타데이터 업데이트
```

**Vector Database 옵션**:
- **Option 1**: AWS OpenSearch (월 $50-100)
- **Option 2**: Pinecone (무료 티어 10K 벡터)
- **Option 3**: ChromaDB (Self-hosted, EC2 필요)

#### 2.3 프론트엔드 구현

```typescript
// src/services/awsBackend.ts 추가

// 문서 업로드 (S3 Presigned URL 사용)
export async function uploadDocument(file: File): Promise<{ documentId: string }> {
  // 1. API 호출하여 Presigned URL 받기
  const { presignedUrl, documentId } = await apiCall('/documents/upload-url', 'POST', {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type
  });

  // 2. S3에 직접 업로드
  await fetch(presignedUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type }
  });

  return { documentId };
}

// 문서 목록 조회
export async function getDocuments(userId: string): Promise<Document[]> {
  return apiCall(`/documents/${userId}`, 'GET');
}

// 문서 삭제
export async function deleteDocument(documentId: string): Promise<void> {
  return apiCall(`/documents/${documentId}`, 'DELETE');
}
```

#### 2.4 RAG 통합 (chat-api Lambda 수정)

```javascript
// chat-api Lambda에서 RAG 컨텍스트 주입

async function getChatResponse(userId, message) {
  // 1. 사용자 메시지 임베딩 생성
  const queryEmbedding = await createEmbedding(message);

  // 2. Vector DB에서 유사 문서 검색
  const relevantDocs = await vectorDB.search(queryEmbedding, topK=3);

  // 3. Gemini에 컨텍스트 주입
  const systemPrompt = `
    당신은 AI 학습 코치입니다.
    다음 학습 자료를 참고하여 답변하세요:

    ${relevantDocs.map(doc => doc.content).join('\n\n')}
  `;

  // 4. Gemini API 호출
  const response = await gemini.generateContent({
    contents: [{ role: 'user', parts: [{ text: message }] }],
    systemInstruction: systemPrompt
  });

  return response;
}
```

#### 2.5 비용 분석

**월간 예상 비용** (100명 사용자, 문서 500개):
- S3 저장 (10GB): $0.23
- Lambda 실행 (문서 처리): $2.00
- Vector DB (Pinecone 무료 티어): $0.00
- Gemini API (RAG 포함): $12.00
- **총 비용**: ~$14.27/월 (기존 $9 → +58% 증가)

**AWS OpenSearch 사용 시**: +$50/월

#### 2.6 구현 단계

**Week 1: 인프라 구축**
- [ ] S3 버킷 생성
- [ ] DynamoDB 테이블 생성
- [ ] Lambda (document-processor) 생성
- [ ] Pinecone 계정 설정

**Week 2: 프론트엔드 연동**
- [ ] Presigned URL API 구현
- [ ] 파일 업로드 기능
- [ ] 문서 목록 API 연동
- [ ] 삭제 기능 구현

**Week 3: RAG 시스템**
- [ ] 텍스트 추출 (PDF, DOCX)
- [ ] 청킹 및 임베딩
- [ ] Vector DB 저장
- [ ] chat-api에 RAG 통합

**예상 소요 시간**: 15-20일 (1인 개발 기준)

---

### 옵션 B: 간소화 구현 (S3 업로드만) - 2일 소요

**목표**: 파일 업로드/다운로드 기능만 구현 (RAG 없음)

#### 구현 범위
- S3 버킷에 파일 업로드
- DynamoDB 메타데이터 저장
- 문서 목록 조회/삭제
- **RAG 통합 없음** (Phase 9-10으로 연기)

#### 장점
- ✅ 빠른 구현 (2일)
- ✅ 비용 최소화 ($1/월)
- ✅ 기본 기능 제공

#### 단점
- ❌ AI 봇이 문서 내용 활용 불가
- ❌ 사용자 가치 제한적

---

### 옵션 C: 제거 (현재 Phase에서) - 30분 소요

**목표**: Phase 8-10 이후로 연기, UI 라우팅 제거

#### 작업 내용
- [ ] `src/App.tsx`에서 KnowledgeBase 라우팅 제거
- [ ] `src/components/layout/Layout.tsx`에서 메뉴 제거
- [ ] `src/pages/KnowledgeBase.tsx` 파일 삭제 (또는 아카이브)
- [ ] CLAUDE.md 업데이트 ("학습 자료 (Phase 10 예정)")

#### 장점
- ✅ 리소스 집중 (핵심 기능 우선)
- ✅ 기술 부채 감소
- ✅ 사용자 혼란 방지 (미완성 기능 노출 X)

#### 단점
- ❌ 기존 UI 작업 일부 낭비

---

## 3. 권장사항 (Tech Lead 의견)

### 🏆 **권장 옵션: C (제거) → Phase 9-10에 A (완전 구현)**

**이유**:

1. **우선순위**:
   - Phase 5-7 완료 상태
   - Sprint 5 목표: Lambda Layer, CloudWatch 모니터링
   - KnowledgeBase는 부가 기능 (핵심 아님)

2. **기술 복잡도**:
   - RAG 시스템 구현 복잡 (15-20일 소요)
   - Vector DB 운영 경험 필요
   - 임베딩 API 비용 증가

3. **사용자 가치**:
   - 현재 AI 봇 시스템만으로 충분
   - 학습 자료 없어도 역량 분석 가능
   - RAG 없는 업로드만으로는 가치 제한적

4. **리소스 효율**:
   - Sprint 5-6: 안정화 작업 우선
   - Phase 8: 적응형 추천, 퀘스트 난이도
   - Phase 9-10: RAG 시스템 구현

### 실행 계획

**즉시 (Sprint 5)**:
- KnowledgeBase 라우팅 제거
- 메뉴에서 숨김 처리
- CLAUDE.md 업데이트

**Phase 9-10 (3-4개월 후)**:
- 옵션 A (완전 구현) 진행
- Vector DB 도입
- RAG 시스템 구축

---

## 4. 대안: 간소화된 "학습 노트" 기능

**목표**: RAG 없이 사용자가 직접 작성한 학습 메모 관리

### 구현 아이디어

```typescript
interface LearningNote {
  id: string;
  userId: string;
  title: string;
  content: string;  // Markdown 형식
  competency: CompetencyType;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
```

**기능**:
- 학습 노트 작성 (Markdown 에디터)
- 역량별 분류
- 태그 기반 검색
- AI 봇 채팅 시 노트 참조 (수동 선택)

**장점**:
- ✅ 1-2일 구현 가능
- ✅ RAG 없이도 가치 제공
- ✅ 비용 최소화 (DynamoDB만 사용)

**단점**:
- ❌ 파일 업로드 불가
- ❌ 자동 컨텍스트 주입 없음

---

## 5. 최종 결정 사항

### Sprint 5 권장 작업

**선택**: **옵션 C (제거)**

**작업 항목**:
1. [ ] `src/App.tsx`에서 `/knowledge-base` 라우팅 주석 처리
2. [ ] `src/components/layout/Layout.tsx`에서 메뉴 숨김
3. [ ] CLAUDE.md 업데이트: "학습 자료 (Phase 9-10 예정)"
4. [ ] `docs/next_todo.md` 업데이트: "KnowledgeBase → Phase 9-10"

**Phase 9-10 계획**:
- RAG 시스템 완전 구현 (옵션 A)
- Vector DB 도입 (Pinecone 무료 티어)
- 문서 처리 파이프라인
- Gemini API RAG 통합

---

## 6. 참고 자료

### RAG 시스템 구현 가이드
- [AWS S3 Presigned URL](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
- [Pinecone Vector DB](https://www.pinecone.io/)
- [LangChain RAG Tutorial](https://python.langchain.com/docs/use_cases/question_answering/)
- [Gemini API with RAG](https://ai.google.dev/gemini-api/docs/retrieval-augmented-generation)

### 비용 계산기
- [AWS Pricing Calculator](https://calculator.aws/)
- [Pinecone Pricing](https://www.pinecone.io/pricing/)

---

**작성자**: AI Developer (Gemini)
**검토 필요**: Tech Lead (Claude)
**최종 승인**: Product Owner
