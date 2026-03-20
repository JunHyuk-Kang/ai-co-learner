# AI Co-Learner

React + TypeScript + AWS Serverless 기반 AI 학습 코칭 플랫폼 (Phase 1-8 프로덕션 운영 중)

---

## 핵심 규칙 (반드시 준수)

### 절대 하면 안 되는 것
- `console.log` 사용 금지 → 반드시 `logger` 사용 (`src/utils/logger.ts`)
- DynamoDB `Scan` 사용 금지 → 반드시 `Query` (PK+SK 활용)
- `any` 타입 사용 금지 → 명시적 타입 정의
- Lambda 응답에 CORS 헤더 누락 금지 (성공/에러 응답 모두 필수)
- Windows에서 `/dev/null` 또는 `nul` 파일 생성 금지

### 항상 해야 하는 것
- 코드 수정 후: `npm run lint:fix && npm run format`
- 배포 전: `npm run test:run` 통과 확인
- Lambda 에러 응답에도 CORS 헤더 포함
- `errorResponse()` 헬퍼 함수 사용 (에러 응답 표준화)

### AI 모델
- **Google Gemini 2.5 Flash** 고정 사용 (`@google/generative-ai` 패키지)
- 모델 변경 금지 (비용 최적화 이유)

---

## 작업별 워크플로우

### 새 Lambda 엔드포인트 추가
1. `lambda/chat-api/index.mjs` 라우터에 경로 추가
2. CORS 헤더 포함 (성공/실패 모두)
3. `errorResponse()` 헬퍼 사용
4. `src/services/awsBackend.ts`에 프론트엔드 함수 추가
5. `cd lambda/chat-api && .\deploy.bat` 실행

### 새 React 페이지 추가
1. `src/pages/`에 컴포넌트 생성
2. `App.tsx` 라우터에 등록
3. `Layout` 컴포넌트로 감싸기
4. `logger` 사용 (console.log 금지)
5. 필요 시 테스트 파일 추가 (`*.test.tsx`)

### 새 React 컴포넌트 추가
1. `src/components/{category}/`에 생성
2. TypeScript props 타입 명시
3. Tailwind CSS로 스타일링
4. Framer Motion으로 애니메이션 (필요 시)

### 테스트 작성
- 위치: `src/**/*.test.ts` (유틸리티), `src/**/*.test.tsx` (컴포넌트)
- 프레임워크: Vitest + React Testing Library
- 실행: `npm run test:run`

### 프론트엔드 배포
```bash
npm run build
npm run deploy
# 또는: aws s3 sync dist s3://ai-co-learner-frontend-synnex --region ap-northeast-2 --delete
```

### Lambda 배포
```bash
cd lambda/{함수명}
npm install
.\deploy.bat
```

---

## 프로젝트 구조

```
src/
├── pages/          # Dashboard, ChatRoom, Login, InitialAssessment,
│                   # DailyQuests, KnowledgeBase, UserProfile, AdminPanel
├── components/
│   ├── admin/      # MetricCard, UserDetailModal
│   ├── chat/       # ChatBubble, StreamingIndicator
│   ├── dashboard/  # CompetencyRadar, CompetencyGrowthChart, LearningInsights
│   ├── layout/     # Layout, PageTransition
│   └── ui/         # Button, Card, Input
├── contexts/       # AuthContext, BotContext
├── hooks/          # useChatStream, useMutations, useQueries
├── services/       # awsBackend.ts, apiUtils.ts
├── utils/          # logger.ts
└── types.ts

lambda/
├── chat-api/                  # 메인 API (30+ 엔드포인트) ← index.mjs
│   ├── handlers/              # admin, assessment, bot, chat, dashboard, subscription, user
│   └── lib/                   # config.mjs (TABLES, CORS_HEADERS, RETRY_CONFIG 등)
├── message-batch-analyzer/    # 5분마다 실행
├── competency-aggregator/     # 매일 새벽 2시
├── quest-generator/           # 매일 오전 9시
├── quest-evaluator/           # 5분마다 실행
├── achievement-evaluator/     # 5분마다 실행
└── learning-pattern-analyzer/ # 온디맨드
```

---

## 핵심 개념

### 역량 6가지 (자동 분석)
| 키 | 의미 |
|----|------|
| `questionQuality` | 질문력 |
| `thinkingDepth` | 사고력 |
| `creativity` | 창의력 |
| `communicationClarity` | 소통력 |
| `executionOriented` | 실행력 |
| `collaborationSignal` | 협업력 |

### 사용자 역할
`USER` → `SUPER_USER` → `ADMIN`

---

## AWS 리소스

| 항목 | 값 |
|------|----|
| 리전 | `ap-northeast-2` |
| API URL | `https://oz20zs5lfc.execute-api.ap-northeast-2.amazonaws.com/prod` |
| Cognito User Pool | `ap-northeast-2_OCntQ228q` |
| S3 Frontend | `ai-co-learner-frontend-synnex` |

---

## DynamoDB 테이블 (10개)

| 테이블 | TTL | 용도 |
|--------|-----|------|
| `ai-co-learner-users` | - | 사용자 프로필 |
| `ai-co-learner-user-bots` | - | 사용자 봇 인스턴스 |
| `ai-co-learner-bot-templates` | - | 봇 템플릿 |
| `ai-co-learner-chat-sessions` | 30일 | 채팅 메시지 |
| `ai-co-learner-learning-analytics` | 1년 | 분석 결과 |
| `ai-co-learner-user-competencies` | - | 역량 점수 |
| `ai-co-learner-assessments` | - | 초기 진단 결과 |
| `ai-co-learner-daily-quests` | 7일 | 일일 퀘스트 |
| `ai-co-learner-user-achievements` | - | 뱃지/업적 |
| `ai-co-learner-usage-tracking` | - | 토큰 사용량 |

---

## 핵심 API 엔드포인트

```
# 사용자
POST /users                               ← 신규 사용자 생성
GET  /users/{userId}
POST /users/update
GET  /users/{userId}/competencies
GET  /users/{userId}/competencies/history?days=30

# 봇
GET  /bots/templates
GET  /bots/user/{userId}
GET  /bots/recommended/{userId}
POST /bots/create
POST /bots/delete

# 채팅
POST /chat/stream          ← 스트리밍 (권장)
GET  /chat/session/{sessionId}

# 진단 & 학습
POST /assessment/start
POST /assessment/submit
GET  /assessment/results
GET  /quests/{userId}
GET  /achievements/{userId}
GET  /analysis/{userId}

# 관리자 (ADMIN 권한 필요)
GET  /admin/dashboard
GET  /admin/users?userId={adminUserId}
POST /admin/users/update-role
POST /admin/users/update-info
POST /admin/users/block
POST /admin/templates/create
POST /admin/templates/update
POST /admin/templates/delete
GET  /admin/usage?adminUserId={id}&days={n}

# 구독 관리 (ADMIN 권한 필요)
GET  /admin/subscription/organizations
GET  /admin/subscription/stats
POST /admin/subscription/update-tier
POST /admin/subscription/update-group-tier
POST /admin/subscription/reset-quota
POST /admin/subscription/extend-trial
```

---

## Lambda 코드 패턴

### CORS 헤더 (모든 응답에 필수)
```javascript
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

// 성공 응답
return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data) };

// 에러 응답 (catch 블록에도 CORS 필수!)
return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: '...' }) };
```

### 로깅 (프론트엔드)
```typescript
import { logger } from './utils/logger';
logger.debug('DEV 전용');
logger.info('일반 정보');
logger.warn('경고');
logger.error('에러', error);
```

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| CORS 에러 | Lambda 응답에 헤더 누락 | 성공/에러 응답 모두에 `CORS_HEADERS` 추가 |
| Lambda 타임아웃 | AI 모델 응답 대기 | 타임아웃 30초 → 60초로 증가 |
| Gemini 429 에러 | Rate Limit 초과 | Exponential Backoff 자동 처리 (최대 3회) |
| DynamoDB 비용 급증 | Scan 사용 | Query로 교체, TTL 설정 확인 |
| 스트리밍 응답 끊김 | JSON 파싱 오류 | newline-delimited JSON 파싱 로직 확인 |

---

## 완료된 주요 기능 (Phase 8)

- ✅ 구독 시스템 (tier 관리, 그룹 구독, 쿼터 리셋, 트라이얼 연장)
- ✅ 어드민 실시간 대시보드 (MetricCard, 시간대별 활동 차트, 이탈 위험 감지)
- ✅ Lambda 핸들러 모듈화 (`handlers/` 분리)
- ✅ SJT 역량 진단 전면 교체

## 다음 단계 (Phase 9-10)

- 퀘스트 난이도 자동 조절 (AI 기반 동적 생성)
- 뱃지 획득 알림 UI
- 주간 학습 리포트
- 학습 경로 시각화
- KnowledgeBase 백엔드 RAG 연동
- 학습 패턴 기반 적응형 봇 추천

---

## 문서

- **개발 로드맵**: [docs/development/development-roadmap.md](docs/development/development-roadmap.md)
- **AWS 아키텍처**: [docs/architecture/aws-architecture.md](docs/architecture/aws-architecture.md)
- **UI/UX 가이드**: [docs/development/ui-ux-guide.md](docs/development/ui-ux-guide.md)
- **API 에러 응답**: [docs/architecture/api-error-responses.md](docs/architecture/api-error-responses.md)
- **Lambda 환경 변수**: [docs/architecture/lambda-environment-variables.md](docs/architecture/lambda-environment-variables.md)
- **다음 할 일**: [docs/next_todo.md](docs/next_todo.md)
- **변경 이력**: [docs/changelog.md](docs/changelog.md)
- **봇 사용 가이드**: [docs/guides/user/](docs/guides/user/)
- **관리자 가이드**: [docs/guides/admin/](docs/guides/admin/)

---

**마지막 업데이트**: 2026-03-20
