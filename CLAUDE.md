# AI Co-Learner

React + TypeScript + AWS Serverless 기반 AI 학습 코칭 플랫폼

---

## 프로젝트 구조

```
ai-co-learner/
├── src/
│   ├── pages/                       # 8개 페이지
│   │   ├── Dashboard.tsx           # 메인 대시보드 (역량 차트, 뱃지, 추천 봇)
│   │   ├── ChatRoom.tsx            # AI 채팅 인터페이스 (스트리밍)
│   │   ├── Login.tsx               # 로그인 페이지
│   │   ├── InitialAssessment.tsx   # 초기 역량 진단 (8문항)
│   │   ├── DailyQuests.tsx         # 일일 퀘스트
│   │   ├── KnowledgeBase.tsx       # 학습 자료 (예정)
│   │   ├── UserProfile.tsx         # 프로필 설정
│   │   └── AdminPanel.tsx          # 관리자 패널 (Templates, Users, Usage)
│   ├── components/
│   │   ├── chat/                   # ChatBubble, StreamingIndicator
│   │   ├── dashboard/              # CompetencyRadar, CompetencyGrowthChart, LearningInsights
│   │   ├── layout/                 # Layout, PageTransition
│   │   └── ui/                     # Button, Card, Input
│   ├── contexts/                   # AuthContext, BotContext
│   ├── services/                   # awsBackend.ts, apiUtils.ts
│   └── types.ts                    # TypeScript 타입 정의
├── lambda/                          # 8개 Lambda 함수
│   ├── chat-api/                   # 메인 채팅 API (20+ 엔드포인트 라우팅)
│   ├── message-batch-analyzer/     # 5분마다 메시지 분석
│   ├── competency-aggregator/      # 매일 새벽 2시 역량 계산
│   ├── quest-generator/            # 매일 오전 9시 퀘스트 생성
│   ├── quest-evaluator/            # 5분마다 퀘스트 진행도 추적
│   ├── achievement-evaluator/      # 5분마다 뱃지 평가
│   └── learning-pattern-analyzer/  # 학습 패턴 분석 (온디맨드)
├── scripts/
│   └── create-test-accounts.mjs    # 테스트 계정 대량 생성 (120개)
└── docs/
    ├── development-roadmap.md      # 개발 로드맵
    ├── aws-architecture.md         # AWS 아키텍처
    ├── ui-ux-guide.md              # UI/UX 가이드
    ├── usage-tracking-guide.md     # 사용량 추적 가이드
    └── archive/                    # 아카이브 문서
```

---

## 핵심 개념

### 1. 역량 6가지 (자동 분석)
- **questionQuality**: 질문력
- **thinkingDepth**: 사고력
- **creativity**: 창의력
- **communicationClarity**: 소통력
- **executionOriented**: 실행력
- **collaborationSignal**: 협업력

### 2. 데이터 전략
- **chat-sessions** (30일 TTL): 최근 대화 저장
- **learning-analytics** (1년 TTL): 분석 데이터 장기 보관
- **배치 분석**: 5분마다 최근 메시지 분석 (비용 최적화)

### 3. AWS 리소스 & AI 모델
- **리전**: ap-northeast-2 (Lambda, DynamoDB, API Gateway, Cognito)
- **AI 모델**: Google Gemini 2.5 Flash (비용 효율성 최적화)
- **API URL**: `https://oz20zs5lfc.execute-api.ap-northeast-2.amazonaws.com/prod`
- **Cognito User Pool**: `ap-northeast-2_OCntQ228q`
- **S3 Frontend**: `ai-co-learner-frontend-synnex`

---

## 개발 시 주의사항

### 개발 환경
Windows : nul 파일이 생성안되게 주의


### Lambda 함수 배포
```bash
cd lambda/chat-api
npm install
.\deploy.bat  # Windows
```

### 환경 변수 (.env.local)
```env
# AWS Cognito
VITE_COGNITO_USER_POOL_ID=ap-northeast-2_OCntQ228q
VITE_COGNITO_CLIENT_ID=4csdt3gpkfujrg1lslu4fgo5b1
VITE_COGNITO_REGION=ap-northeast-2

# API Gateway
VITE_API_GATEWAY_URL=https://oz20zs5lfc.execute-api.ap-northeast-2.amazonaws.com/prod

# Google Gemini (Lambda 환경 변수로 설정)
# GEMINI_API_KEY는 Lambda 함수 환경 변수에서 설정
```

### DynamoDB 테이블 (10개)
- `ai-co-learner-users` - 사용자 프로필 및 기본 정보
- `ai-co-learner-user-bots` - 사용자가 생성한 AI 봇 인스턴스
- `ai-co-learner-bot-templates` - AI 봇 템플릿 및 역량 매핑
- `ai-co-learner-chat-sessions` (30일 TTL) - 채팅 메시지 저장
- `ai-co-learner-learning-analytics` (1년 TTL) - 메시지 분석 결과
- `ai-co-learner-user-competencies` - 역량 점수 및 히스토리
- `ai-co-learner-assessments` - 초기 진단 결과
- `ai-co-learner-daily-quests` (7일 TTL) - 일일 퀘스트
- `ai-co-learner-user-achievements` - 뱃지 및 업적
- `ai-co-learner-usage-tracking` (TTL 미설정) - 토큰 사용량 및 비용

### 코드 수정 시
- Lambda 함수는 `index.mjs` (ES Module)
- DynamoDB 쿼리 시 반드시 PK+SK 사용
- Google Gemini API 사용 (`@google/generative-ai` 패키지)
- **모든 Lambda 응답에 CORS 헤더 포함 필수** (`Access-Control-Allow-Origin: *`)
- 스트리밍 응답: newline-delimited JSON 형식
- Exponential Backoff 재시도 로직 포함 (Rate Limit 대응)

---

## 현재 구현 상태

### ✅ Phase 1-7 완료 (프로덕션 운영 중)

**인프라 & 인증**
- AWS 서버리스 인프라 (Lambda, DynamoDB, API Gateway, S3, Cognito)
- 사용자 인증 및 역할 관리 (USER, SUPER_USER, ADMIN)

**AI 채팅 시스템**
- Google Gemini 2.5 Flash 기반 실시간 스트리밍 채팅
- 다중 AI 봇 시스템 (9개 템플릿)
- 채팅 세션 관리 및 히스토리
- Rate Limit 대응 (Exponential Backoff 재시도)

**역량 분석 시스템**
- 초기 역량 진단 (8문항, 6개 역량 분석)
- 배치 메시지 분석 (5분 간격, 비용 90% 절감)
- 역량 자동 계산 (일일 집계, 30일 가중 평균)
- 역량 성장 차트 (30일 히스토리)
- AI 기반 학습 인사이트

**봇 추천 시스템**
- 역량 기반 AI 봇 추천
- Primary/Secondary 역량 매핑
- 개인화된 학습 경로 제안

**게이미피케이션**
- 일일 퀘스트 시스템 (대화형, 도전, 성찰 3가지 유형)
- 업적/뱃지 시스템 (14개 뱃지)
- 경험치 & 레벨 시스템
- 학습 패턴 분석

**관리 기능**
- 사용량 추적 & 비용 관리 시스템
  - 실시간 토큰 사용량 추적 (입력/출력 토큰 분리)
  - 사용자별 비용 집계 (Gemini 2.5 Flash 요금 기준)
  - 관리자 대시보드 (일별 차트, 월간 예상 비용)
  - 기간별 필터링 (7/30/90일)
- 테스트 계정 대량 생성 도구 (학교용)
- 봇 템플릿 관리 (생성, 수정, 삭제)
- 사용자 관리 (역할 변경, 차단)

### 🚧 다음 단계 (Phase 8-10)
- 학습 패턴 기반 적응형 봇 추천
- 퀘스트 난이도 자동 조절
- 뱃지 획득 알림 UI
- 주간 학습 리포트
- 학습 경로 시각화

---

## 주요 명령어

### 프론트엔드 개발
```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# S3 배포 (프론트엔드)
npm run deploy
# 또는
aws s3 sync dist s3://ai-co-learner-frontend-synnex --region ap-northeast-2 --delete
```

### Lambda 함수 배포
```bash
# chat-api 배포
cd lambda/chat-api
npm install
.\deploy.bat  # Windows

# 기타 Lambda 함수 (각 디렉토리에서)
cd lambda/message-batch-analyzer
.\deploy.bat
```

### 모니터링 & 디버깅
```bash
# Lambda 로그 확인
aws logs tail /aws/lambda/ai-co-learner-chat --since 5m --region ap-northeast-2 --format short

# DynamoDB 데이터 확인
aws dynamodb scan --table-name ai-co-learner-usage-tracking --max-items 5 --region ap-northeast-2

# 테스트 계정 생성 (120개)
cd scripts
node create-test-accounts.mjs
```

---

## 트러블슈팅

### CORS 에러 (가장 빈번)
**증상**: 프론트엔드에서 API 호출 시 CORS 에러 발생
**원인**: Lambda 응답에 CORS 헤더 누락
**해결**:
```javascript
// 모든 Lambda 응답에 반드시 포함
return {
  statusCode: 200,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  },
  body: JSON.stringify(data)
};
```
- **주의**: 에러 응답(`catch` 블록)에도 CORS 헤더 필수!

### Lambda 타임아웃
**증상**: AI 모델 응답 대기 중 타임아웃 발생
**해결**: Lambda 설정에서 타임아웃 30초 → 60초 증가

### Gemini Rate Limit 에러
**증상**: `RESOURCE_EXHAUSTED` 또는 429 에러 발생
**해결**: Exponential Backoff 재시도 로직이 자동으로 처리 (최대 3회 재시도)
**추가 조치**: 무료 할당량 초과 시 유료 API 키로 전환 필요

### DynamoDB 비용 급증
**원인**: Scan 사용 또는 TTL 미설정
**해결**:
- TTL 설정 확인 (chat-sessions: 30일, learning-analytics: 1년, daily-quests: 7일)
- Scan 대신 Query 사용 (PK+SK 활용)
- 배치 작업 시 Limit 파라미터 사용

### 스트리밍 채팅 응답 끊김
**증상**: 스트리밍 중간에 연결 종료
**원인**: Gemini 스트리밍 응답 파싱 오류
**해결**: newline-delimited JSON 파싱 로직 확인

### 테스트 계정 생성 실패
**증상**: Cognito 계정 생성 시 속도 제한 에러
**해결**: `create-test-accounts.mjs`에서 200ms 딜레이 유지

---

## 핵심 API 엔드포인트

### 사용자 관리
- `GET /users/{userId}` - 사용자 프로필 조회
- `POST /users` - 신규 사용자 생성
- `POST /users/update` - 프로필 업데이트
- `GET /users/{userId}/competencies` - 역량 데이터 조회
- `GET /users/{userId}/competencies/history?days=30` - 역량 히스토리

### AI 봇
- `GET /bots/templates` - 봇 템플릿 목록
- `GET /bots/user/{userId}` - 내 봇 목록
- `POST /bots/create` - 봇 생성
- `POST /bots/delete` - 봇 삭제
- `GET /bots/recommended/{userId}` - 추천 봇

### 채팅
- `POST /chat/stream` - 스트리밍 채팅 (권장)
- `GET /chat/session/{sessionId}` - 채팅 히스토리

### 진단 & 학습
- `POST /assessment/start` - 초기 진단 시작
- `POST /assessment/submit` - 답변 제출
- `GET /quests/{userId}` - 오늘의 퀘스트
- `GET /achievements/{userId}` - 뱃지 현황
- `GET /analysis/{userId}` - 학습 패턴 분석

### 관리자 (ADMIN 권한 필요)
- `GET /admin/users?userId={adminUserId}` - 전체 사용자 목록
- `POST /admin/users/update-role` - 사용자 역할 변경
- `POST /admin/templates/create` - 봇 템플릿 생성
- `GET /admin/usage?adminUserId={id}&days={n}` - 사용량 통계

---

## 기술 스택 & 의존성

### 프론트엔드
- **React** 19.2.0 - UI 프레임워크
- **TypeScript** 5.8.2 - 타입 안전성
- **Vite** 6.2.0 - 빌드 도구
- **AWS Amplify** 6.15.8 - AWS SDK 및 인증
- **Tailwind CSS** 4.1.17 - 스타일링
- **Recharts** 3.4.1 - 차트 라이브러리
- **Framer Motion** 12.23.25 - 애니메이션
- **React Router** 7.9.6 - 라우팅

### Lambda 함수
- **@google/generative-ai** - Google Gemini AI 호출
- **@aws-sdk/client-dynamodb** - DynamoDB 작업
- **@aws-sdk/lib-dynamodb** - DynamoDB Document Client
- **@aws-sdk/client-cognito-identity-provider** - Cognito 관리
- **@aws-sdk/client-lambda** - Lambda 호출 (배치 분석)

---

## 비용 추정 (월간)

### 예상 사용량: 100,000 메시지/월
- **Gemini 2.5 Flash API**: ~$8/월 (**70% 절감**)
  - 입력 토큰: $0.075/1M tokens
  - 출력 토큰: $0.30/1M tokens
  - Claude 3 Haiku 대비 3-4배 저렴
- **DynamoDB**: ~$0.40/월
  - On-Demand 요금제
  - TTL 자동 삭제로 비용 최적화
- **Lambda**: ~$0.50/월
  - 512MB 메모리, 평균 3초 실행
- **API Gateway**: 무시 가능
- **S3 + CloudFront**: ~$0.10/월

**총 월간 비용**: 약 **$9** (50-100명 동시 사용자 기준)

### 모델 선택 이유
- **Gemini 2.5 Flash 선택**: 비용 효율성 최우선 (학교용 프로젝트)
- **Gemini 3.0 Flash 미사용**: 성능은 우수하지만 가격 6-10배 비쌈 ($0.50/$3.00)
- 현재 기능(채팅, 역량 분석)에는 2.5 Flash로 충분

---

## 문서 참조

- **개발 로드맵**: [docs/development-roadmap.md](docs/development-roadmap.md)
- **AWS 아키텍처**: [docs/aws-architecture.md](docs/aws-architecture.md)
- **UI/UX 가이드**: [docs/ui-ux-guide.md](docs/ui-ux-guide.md)
- **사용량 추적 가이드**: [docs/usage-tracking-guide.md](docs/usage-tracking-guide.md)
- **상세 가이드**: [docs/archive/](docs/archive/)

---

## 최근 주요 업데이트

### 2025-12-26
- **AI 모델 전환**: Claude 3 Haiku → Google Gemini 2.5 Flash
- **비용 70% 절감**: 월 $27 → $9 (입력 $0.075, 출력 $0.30)
- **Exponential Backoff 재시도 로직 추가**: Rate Limit 대응
- **CLAUDE.md 업데이트**: Gemini 관련 정보 전면 반영

### 2025-12-22
- **CLAUDE.md 전면 개정**: 프로젝트 전체 구조 재정리
- 8개 Lambda 함수 목록 업데이트
- 10개 DynamoDB 테이블 상세 설명
- 20+ API 엔드포인트 문서화
- 트러블슈팅 섹션 강화 (CORS 에러 중점)

### 2025-11-27 이전
- 사용량 추적 & 비용 관리 시스템 구축
- 봇 역량 매핑 및 추천 시스템
- 스트리밍 채팅 응답 구현
- Phase 5-7 완료 (퀘스트, 뱃지, 학습 패턴 분석)
- 테스트 계정 대량 생성 스크립트

---

**마지막 업데이트**: 2025-12-26
