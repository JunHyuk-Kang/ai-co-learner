# 역량 성장 추이 버그 수정 보고서

**작성일**: 2025-12-31
**버그 ID**: COMP-001
**심각도**: High (핵심 기능 동작 안 함)
**담당**: Claude (Tech Lead)

---

## 🐛 버그 개요

### 증상
- 대시보드의 "역량 성장 추이" 차트가 표시되지 않음
- "아직 충분한 데이터가 없습니다" 메시지만 표시
- 실제로는 learning-analytics 테이블에 98개 데이터 존재

### 영향 범위
- **영향받는 사용자**: 전체 사용자
- **영향받는 기능**: 역량 성장 추이 차트 (Dashboard 페이지)
- **비즈니스 영향**: 사용자 학습 성장 시각화 불가

---

## 🔍 근본 원인 분석

### 1. 필드명 불일치 문제

#### message-batch-analyzer Lambda (데이터 저장)
```javascript
// lambda/message-batch-analyzer/index.mjs:248-255
Item: {
  userId: result.userId,
  timestamp: result.timestamp,
  analysisResult: {  // ❌ 잘못된 필드명
    questionQuality: result.analysis.questionQuality,
    thinkingDepth: result.analysis.thinkingDepth,
    // ...
  }
}
```

#### chat-api Lambda (데이터 조회)
```javascript
// lambda/chat-api/index.mjs:2800
const scores = item.competencyScores || {};  // ❌ 다른 필드명 참조
```

### 2. 데이터 확인 결과
```bash
aws dynamodb scan --table-name ai-co-learner-learning-analytics --max-items 1
```

**실제 데이터 구조**:
```json
{
  "analysisResult": {
    "thinkingDepth": 10,
    "questionQuality": 5,
    "creativity": 0,
    // ... 역량 점수 존재
  },
  "competencyScores": null  // ❌ 필드는 있지만 null
}
```

### 3. 문제 발생 시점
- **2025-12-26**: AI 모델을 Gemini로 전환하면서 message-batch-analyzer 재작성
- 당시 필드명을 `analysisResult`로 작성
- 이후 chat-api에서 `competencyScores`로 조회하도록 수정됐으나 analyzer는 미수정
- **총 98개 메시지 분석 데이터**가 이미 잘못된 필드로 저장됨

---

## ✅ 수정 내용

### 1. message-batch-analyzer 수정
**파일**: `lambda/message-batch-analyzer/index.mjs`

**변경 전**:
```javascript
analysisResult: {
  questionQuality: result.analysis.questionQuality,
  thinkingDepth: result.analysis.thinkingDepth,
  // ...
}
```

**변경 후**:
```javascript
competencyScores: {  // ✅ 올바른 필드명으로 수정
  questionQuality: result.analysis.questionQuality,
  thinkingDepth: result.analysis.thinkingDepth,
  // ...
}
```

### 2. chat-api 하위 호환성 추가
**파일**: `lambda/chat-api/index.mjs`

**변경 전**:
```javascript
const scores = item.competencyScores || {};
```

**변경 후**:
```javascript
// 하위 호환성: competencyScores(신규) 또는 analysisResult(기존) 사용
const scores = item.competencyScores || item.analysisResult || {};
```

**이유**:
- 기존 98개 데이터는 `analysisResult` 필드로 저장되어 있음
- 새로운 데이터는 `competencyScores`로 저장됨
- 두 가지 모두 읽을 수 있도록 하위 호환성 추가

---

## 🚀 배포 절차

### 1. message-batch-analyzer 배포
```bash
cd lambda/message-batch-analyzer
powershell "Remove-Item -Path function.zip -ErrorAction SilentlyContinue; Compress-Archive -Path index.mjs,package.json,node_modules -DestinationPath function.zip -Force"
aws lambda update-function-code --function-name ai-co-learner-message-batch-analyzer --zip-file fileb://function.zip --region ap-northeast-2
```

**배포 결과**: ✅ Successful (2025-12-31 확인)

### 2. chat-api 배포
```bash
cd lambda/chat-api
powershell "Remove-Item -Path function.zip -ErrorAction SilentlyContinue; Compress-Archive -Path index.mjs,package.json,node_modules -DestinationPath function.zip -Force"
aws lambda update-function-code --function-name ai-co-learner-chat --zip-file fileb://function.zip --region ap-northeast-2
```

**배포 결과**: ✅ Successful (2025-12-31 확인)

---

## 🧪 테스트 계획

### 1. 기존 데이터 조회 테스트
```bash
# 기존 데이터 (analysisResult 필드) 조회 가능한지 확인
curl "https://oz20zs5lfc.execute-api.ap-northeast-2.amazonaws.com/prod/users/24480d7c-b0c1-70aa-1c5b-82ea4466e7fd/competencies/history?days=30" \
  -H "Authorization: Bearer {TOKEN}"
```

**예상 결과**: 98개 메시지의 역량 데이터 조회 성공

### 2. 신규 데이터 저장 테스트
```bash
# 새로운 메시지 발송 후 5분 대기 (message-batch-analyzer 실행)
# 새로운 데이터가 competencyScores 필드로 저장되는지 확인
aws dynamodb scan --table-name ai-co-learner-learning-analytics \
  --filter-expression "attribute_exists(competencyScores)" \
  --region ap-northeast-2
```

**예상 결과**: 새로운 데이터는 `competencyScores` 필드로 저장됨

### 3. 프론트엔드 UI 테스트
```bash
npm run dev
# 브라우저에서 Dashboard 접속
# 역량 성장 추이 차트 확인
```

**예상 결과**: 30일간 역량 변화 그래프 표시

---

## 📊 데이터 마이그레이션 계획

### 현재 상황
- **기존 데이터**: 98개 (analysisResult 필드)
- **신규 데이터**: 0개 (competencyScores 필드)

### 마이그레이션 옵션

#### Option A: 자동 마이그레이션 (권장하지 않음)
- DynamoDB 스캔 → 모든 `analysisResult`를 `competencyScores`로 복사
- 비용: 98번 Write 요청 (~$0.0001)
- 위험: 데이터 손실 가능성

#### Option B: 하위 호환성 유지 (권장, 적용 완료)
- chat-api에서 `analysisResult` || `competencyScores` 모두 읽도록 수정 ✅
- 자연스럽게 새로운 데이터는 `competencyScores`로 저장됨
- 30일 TTL 이후 기존 데이터 자동 삭제
- 비용: $0
- 위험: 없음

#### Option C: 데이터 삭제 후 재분석 (권장하지 않음)
- 기존 데이터 삭제
- chat-sessions 테이블에서 메시지 재분석
- 비용: Gemini API 호출 비용 (~$0.50)
- 위험: 높음 (데이터 손실 가능성)

### 최종 결정
**Option B 채택** ✅
- 하위 호환성 코드 이미 적용
- 30일 후 자동으로 기존 데이터 정리됨
- 추가 작업 불필요

---

## 📈 모니터링 계획

### CloudWatch Logs 확인
```bash
# message-batch-analyzer 로그 확인
aws logs tail /aws/lambda/ai-co-learner-message-batch-analyzer \
  --since 5m --region ap-northeast-2 --format short

# chat-api 로그 확인
aws logs tail /aws/lambda/ai-co-learner-chat \
  --since 5m --region ap-northeast-2 --format short
```

### 메트릭 확인
- **Lambda 에러율**: 0% 유지 (현재 5% 임계값)
- **DynamoDB 읽기/쓰기**: 정상 범위 내
- **API Gateway 5xx 에러**: 0건 유지

---

## 🔄 재발 방지 대책

### 1. 필드명 표준화 문서 작성
**파일**: `docs/dynamodb-schema-guide.md` (예정)
- 모든 DynamoDB 테이블 스키마 명세
- 필드명 네이밍 규칙
- 필수/선택 필드 구분

### 2. Lambda 함수 간 필드명 검증
```javascript
// message-batch-analyzer에서 저장 전 검증
const REQUIRED_FIELDS = ['competencyScores', 'userId', 'timestamp'];
validateFields(item, REQUIRED_FIELDS);
```

### 3. 통합 테스트 추가
```javascript
// lambda/message-batch-analyzer/test/integration.test.mjs
describe('Data schema compatibility', () => {
  it('should save data with competencyScores field', async () => {
    const result = await handler(mockEvent);
    const savedItem = await getItemFromDB();
    expect(savedItem.competencyScores).toBeDefined();
  });
});
```

### 4. TypeScript 도입 검토 (Phase 9-10)
- Lambda 함수를 TypeScript로 전환
- 타입 안전성으로 필드명 오류 방지
- 빌드 시점에 타입 체크

---

## 📝 교훈 (Lessons Learned)

### 1. API 계약 (Contract) 중요성
- 프론트엔드-백엔드 간 필드명 일치 필수
- 변경 시 모든 관련 Lambda 함수 동시 수정 필요

### 2. 배치 작업 검증 부족
- message-batch-analyzer가 5분마다 자동 실행되지만 출력 검증 안 함
- CloudWatch Logs만으로는 데이터 구조 오류 발견 어려움

### 3. E2E 테스트 부재
- 단위 테스트만 있고 통합 테스트 없음
- 프론트엔드 → API → Lambda → DynamoDB 전체 흐름 테스트 필요

### 4. 문서화 필요성
- DynamoDB 테이블 스키마 문서 없음
- 각 Lambda 함수가 어떤 필드를 저장/조회하는지 명확한 문서 필요

---

## 🎯 후속 작업

### Immediate (이번 주)
- [x] message-batch-analyzer 수정 및 배포
- [x] chat-api 하위 호환성 추가
- [ ] 프론트엔드 UI 테스트 (사용자 확인)
- [ ] CloudWatch Logs 모니터링 (48시간)

### Short-term (1주일 내)
- [ ] `docs/dynamodb-schema-guide.md` 작성
- [ ] Lambda 함수 간 필드명 검증 로직 추가
- [ ] 통합 테스트 추가

### Long-term (Phase 9-10)
- [ ] Lambda 함수 TypeScript 전환
- [ ] E2E 테스트 프레임워크 도입
- [ ] CI/CD 파이프라인 구축

---

## 📚 참고 자료

### 관련 파일
- [lambda/message-batch-analyzer/index.mjs](lambda/message-batch-analyzer/index.mjs) (수정됨)
- [lambda/chat-api/index.mjs](lambda/chat-api/index.mjs) (수정됨)
- [src/components/dashboard/CompetencyGrowthChart.tsx](src/components/dashboard/CompetencyGrowthChart.tsx)

### DynamoDB 테이블
- `ai-co-learner-learning-analytics` (30일 TTL, 365일 TTL)
- PK: `userId` (String)
- SK: `timestamp` (Number)
- 필드: `competencyScores` (Map) ← **수정됨**

### API 엔드포인트
- `GET /users/{userId}/competencies/history?days=30`
- 응답 형식:
```json
{
  "history": [
    {
      "date": "2025-12-31",
      "competencies": {
        "questionQuality": 85,
        "thinkingDepth": 70,
        // ...
      },
      "messageCount": 10
    }
  ],
  "startDate": "2025-12-01",
  "endDate": "2025-12-31",
  "totalDays": 30
}
```

---

**작성자**: Claude (Tech Lead)
**검토**: 배포 완료 후 사용자 피드백 대기
**상태**: ✅ 수정 완료, 배포 완료, 테스트 대기

---

**다음 버그 수정**:
- [ ] AuthContext.test.tsx 테스트 실패 수정
- [ ] Lambda 함수 타임아웃 개선 (50초 → 30초 목표)
