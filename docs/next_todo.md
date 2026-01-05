# AI Co-Learner - 개선 과제 (Next TODO)

**작성일**: 2025-12-30
**프로젝트 건강도**: 7/10 (프로덕션 운영 가능하나 테스트 부족)

---

## 📋 우선순위별 개선 과제

### 🔴 **긴급 수정 필요 (Critical) - 이번 스프린트**

#### 1. 테스트 프레임워크 부재 ⚠️
**현재 상태:**
- 단위 테스트, 통합 테스트, E2E 테스트 모두 없음
- `.test.ts`, `.spec.ts` 파일 0개
- 회귀(regression) 버그 발생 위험 높음

**해결 방안:**
```bash
# Vitest + React Testing Library 설정
npm install -D vitest @vitest/ui jsdom
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event

# vitest.config.ts 생성
# package.json에 "test": "vitest" 추가
```

**우선 작성할 테스트:**
- `src/services/awsBackend.test.ts` - API 호출 함수
- `src/contexts/AuthContext.test.tsx` - 인증 로직
- `lambda/chat-api/index.test.mjs` - 주요 엔드포인트
- `src/components/dashboard/CompetencyRadar.test.tsx` - 역량 차트

**예상 소요 시간**: 2-3일

---

#### 2. 프로덕션 코드에 console.log 22개 발견
**위치:**
- `src/contexts/AuthContext.tsx` - 인증 관련 로그
- `src/hooks/useChatStream.ts` - 스트리밍 디버그 로그
- `src/pages/Dashboard.tsx` - 역량 데이터 확인 로그
- `src/services/awsBackend.ts` - API 호출 로그

**해결 방안:**
```typescript
// 구조화된 로깅 시스템 도입
// src/utils/logger.ts
export const logger = {
  debug: (msg: string, data?: any) => {
    if (import.meta.env.DEV) console.log(`[DEBUG] ${msg}`, data);
  },
  error: (msg: string, error?: any) => {
    console.error(`[ERROR] ${msg}`, error);
    // 프로덕션에서는 Sentry 등으로 전송
  }
};

// 사용 예시
logger.debug('User authenticated', { userId });
```

**체크리스트:**
- [ ] `src/utils/logger.ts` 생성
- [ ] 모든 console.log → logger.debug 교체
- [ ] 에러 처리: logger.error 사용
- [ ] 프로덕션 빌드 시 debug 로그 제거 확인

**예상 소요 시간**: 2시간

---

#### 3. Git에 불필요한 파일 추적 중
**파일 목록:**
- `nul` - Windows 아티팩트 (47 bytes)
- `lambdachat-apiscripts/` - 고아 디렉토리
- `lambda/chat-api/check-history.mjs` - 디버그 스크립트
- `lambda/chat-api/check-history2.mjs`
- `lambda/chat-api/check-history3.mjs`
- `lambda/chat-api/check-markdown-prompt.mjs`
- `lambda/chat-api/check-prompts.mjs`
- `lambda/chat-api/create-zip.mjs`
- `check-prompts.py`
- 다수의 `test-*.json` 파일

**해결 방안:**
```bash
# .gitignore에 추가
echo "nul" >> .gitignore
echo "check-*.mjs" >> .gitignore
echo "check-*.py" >> .gitignore
echo "test-*.json" >> .gitignore
echo "lambdachat-apiscripts/" >> .gitignore

# Git에서 제거 (파일은 유지)
git rm --cached nul
git rm --cached -r lambdachat-apiscripts/
git rm --cached lambda/chat-api/check-*.mjs
git rm --cached check-prompts.py

# 커밋
git add .gitignore
git commit -m "chore: remove debug files from git tracking"
```

**예상 소요 시간**: 30분

---

#### 4. Lint/Format 설정 부재
**현재 상태:**
- `.eslintrc`, `prettier.config.js` 없음
- 코드 스타일 일관성 보장 안됨
- TypeScript strict mode는 활성화되어 있음 ✓

**해결 방안:**
```bash
# ESLint + Prettier 설치
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install -D prettier eslint-config-prettier eslint-plugin-prettier
npm install -D eslint-plugin-react eslint-plugin-react-hooks

# Husky + lint-staged 설치 (pre-commit hook)
npm install -D husky lint-staged
npx husky init
```

**생성할 파일:**
- `.eslintrc.json` - ESLint 규칙
- `.prettierrc` - 코드 포매팅 규칙
- `.husky/pre-commit` - 커밋 전 자동 lint

**권장 ESLint 규칙:**
```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  "rules": {
    "no-console": "warn",
    "@typescript-eslint/no-unused-vars": "error",
    "react/react-in-jsx-scope": "off"
  }
}
```

**예상 소요 시간**: 3시간

---

#### 5. .env.example 업데이트
**현재 문제:**
- Bedrock 관련 환경 변수 레퍼런스 (현재는 Gemini 사용)
- Lambda 환경 변수 설명 부족

**해결 방안:**
```env
# .env.example 수정
# AWS Cognito
VITE_COGNITO_USER_POOL_ID=your-user-pool-id
VITE_COGNITO_CLIENT_ID=your-client-id
VITE_COGNITO_REGION=ap-northeast-2

# API Gateway
VITE_API_GATEWAY_URL=https://your-api-gateway-url/prod

# Lambda 환경 변수 (AWS Console에서 설정)
# GEMINI_API_KEY=your-gemini-api-key
# TABLE_PREFIX=ai-co-learner
```

**Lambda 환경 변수 문서화:**
- `docs/lambda-environment-variables.md` 생성

**예상 소요 시간**: 1시간

---

### 🟡 **단기 개선 필요 (High Priority) - 다음 스프린트**

#### 6. chat-api Lambda 함수 분리 (3,043줄 → 3개 함수)
**현재 문제:**
- 단일 함수에 20+ 엔드포인트 라우팅
- 전체 Lambda 코드의 57% 차지
- 배포 느림, 유지보수 어려움

**분리 계획:**
```
lambda/
├── chat-core-api/          # 채팅 기능
│   ├── POST /chat/stream
│   ├── GET /chat/session/{sessionId}
│   └── POST /chat/feedback
│
├── admin-api/              # 관리자 기능
│   ├── GET /admin/users
│   ├── POST /admin/users/update-role
│   ├── GET /admin/templates
│   ├── POST /admin/templates/create
│   └── GET /admin/usage
│
└── user-api/               # 사용자 기능
    ├── GET /users/{userId}
    ├── POST /users/update
    ├── GET /users/{userId}/competencies
    ├── GET /bots/templates
    ├── POST /bots/create
    ├── GET /quests/{userId}
    └── GET /achievements/{userId}
```

**마이그레이션 단계:**
1. 새 Lambda 함수 3개 생성
2. 기존 코드 복사 및 분리
3. API Gateway 라우팅 업데이트 (병렬 운영)
4. 테스트 후 기존 chat-api 제거

**예상 소요 시간**: 1-2일

---

#### 7. API 에러 응답 문서화
**현재 문제:**
- Exponential Backoff 로직은 있으나 API 응답 스펙 없음
- CORS 에러 처리 CLAUDE.md에만 분산 기록
- 클라이언트에서 에러 처리 일관성 부족

**생성할 문서:**
`docs/api-error-responses.md`

**포함 내용:**
```markdown
# API 에러 응답 규격

## 공통 에러 형식
{
  "error": {
    "code": "ERROR_CODE",
    "message": "사용자 친화적 메시지",
    "details": { /* 추가 정보 */ }
  }
}

## 에러 코드 목록
| 코드 | HTTP Status | 의미 | 재시도 |
|------|-------------|------|--------|
| AUTH_REQUIRED | 401 | 인증 필요 | ✗ |
| FORBIDDEN | 403 | 권한 없음 | ✗ |
| NOT_FOUND | 404 | 리소스 없음 | ✗ |
| RATE_LIMIT | 429 | 요청 제한 초과 | ✓ (Exponential Backoff) |
| GEMINI_ERROR | 502 | AI 모델 오류 | ✓ (최대 3회) |
| SERVER_ERROR | 500 | 서버 내부 오류 | ✓ (최대 1회) |

## Exponential Backoff 로직
- 초기 대기: 1초
- 최대 재시도: 3회
- 대기 시간: 1초 → 2초 → 4초
```

**Lambda 함수 표준화:**
```javascript
// 모든 Lambda에서 동일한 에러 응답 사용
function errorResponse(code, message, statusCode = 500) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    },
    body: JSON.stringify({
      error: { code, message }
    })
  };
}
```

**예상 소요 시간**: 4시간

---

#### 8. Lambda 환경 변수 통일
**현재 문제:**
- 일부 Lambda 함수가 테이블 이름 하드코딩
- 예: `'ai-co-learner-users'` (코드에 직접 작성)

**해결 방안:**
```javascript
// 환경 변수로 통일
const TABLE_USERS = process.env.TABLE_USERS || 'ai-co-learner-users';
const TABLE_BOTS = process.env.TABLE_BOTS || 'ai-co-learner-user-bots';
const TABLE_SESSIONS = process.env.TABLE_SESSIONS || 'ai-co-learner-chat-sessions';
```

**Lambda 환경 변수 설정 (AWS Console):**
```bash
# 또는 deploy.bat에서 자동 설정
aws lambda update-function-configuration \
  --function-name ai-co-learner-chat-core \
  --environment "Variables={
    TABLE_USERS=ai-co-learner-users,
    TABLE_BOTS=ai-co-learner-user-bots,
    TABLE_SESSIONS=ai-co-learner-chat-sessions,
    GEMINI_API_KEY=your-api-key
  }"
```

**체크리스트:**
- [ ] 8개 Lambda 함수 모두 환경 변수로 변경
- [ ] deploy.bat 스크립트에 환경 변수 설정 추가
- [ ] `docs/lambda-environment-variables.md` 문서 작성

**예상 소요 시간**: 3시간

---

#### 9. Husky Pre-commit Hook 설정
**목적:**
- 커밋 전 자동 lint 검사
- 테스트 실행 (빠른 테스트만)
- 코드 포맷팅 자동 적용

**설정 파일:**
```json
// package.json
{
  "scripts": {
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx}\"",
    "test:quick": "vitest run --reporter=dot"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "vitest related --run"
    ]
  }
}
```

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx lint-staged
```

**예상 소요 시간**: 2시간

---

### 🟢 **중장기 개선 (Medium Priority) - 분기 계획**

#### 10. 문서 구조 재정리
**현재 상태:**
- 루트에 5개 MD 파일 (CLAUDE.md, README.md, AI-Model-Comparison-2025.md, etc.)
- docs/ 디렉토리에 7개 파일
- docs/archive/에 8개 파일

**제안 구조:**
```
docs/
├── README.md                      # 문서 인덱스
├── setup/
│   ├── getting-started.md         # 초기 설정
│   ├── aws-setup.md               # AWS 인프라 설정
│   ├── gemini-setup.md            # Gemini API 설정
│   └── environment-variables.md   # 환경 변수 가이드
│
├── architecture/
│   ├── overview.md                # 시스템 개요
│   ├── aws-architecture.md        # AWS 아키텍처
│   ├── database-schema.md         # DynamoDB 테이블 스키마
│   └── ai-model-comparison.md     # AI 모델 비교
│
├── api/
│   ├── endpoints.md               # API 엔드포인트 목록
│   ├── error-responses.md         # 에러 응답 규격
│   └── authentication.md          # 인증 방식
│
├── features/
│   ├── competency-system.md       # 역량 분석 시스템
│   ├── bot-recommendation.md      # 봇 추천 알고리즘
│   ├── quest-system.md            # 퀘스트 시스템
│   └── achievement-system.md      # 업적/뱃지 시스템
│
├── development/
│   ├── development-roadmap.md     # 개발 로드맵
│   ├── ui-ux-guide.md             # UI/UX 가이드
│   ├── testing-guide.md           # 테스트 가이드 (신규)
│   └── deployment.md              # 배포 가이드
│
├── operations/
│   ├── usage-tracking.md          # 사용량 추적
│   ├── cost-management.md         # 비용 관리
│   └── monitoring.md              # 모니터링 (신규)
│
└── troubleshooting/
    ├── common-issues.md           # 일반 문제
    ├── cors-errors.md             # CORS 에러 해결
    └── lambda-debugging.md        # Lambda 디버깅
```

**마이그레이션 단계:**
1. 새 디렉토리 구조 생성
2. 기존 문서 재분류 및 이동
3. 루트 README.md에 문서 인덱스 추가
4. 중복 내용 통합
5. 아카이브 문서 정리

**예상 소요 시간**: 1일

---

#### 11. Lambda 통합 테스트 작성
**목표:**
- 각 Lambda 함수의 주요 엔드포인트 테스트
- DynamoDB 모킹 또는 로컬 DynamoDB 사용
- Gemini API 모킹

**테스트 구조:**
```
lambda/
├── chat-core-api/
│   ├── index.mjs
│   ├── index.test.mjs          # 신규
│   └── __mocks__/
│       ├── dynamodb.mjs        # DynamoDB 모킹
│       └── gemini.mjs          # Gemini API 모킹
│
├── admin-api/
│   └── index.test.mjs          # 신규
│
└── user-api/
    └── index.test.mjs          # 신규
```

**테스트 예시:**
```javascript
// lambda/chat-core-api/index.test.mjs
import { handler } from './index.mjs';
import { mockDynamoDB, mockGemini } from './__mocks__';

describe('Chat Core API', () => {
  test('POST /chat/stream - 정상 응답', async () => {
    mockGemini.mockStreamResponse('안녕하세요!');

    const event = {
      path: '/chat/stream',
      httpMethod: 'POST',
      body: JSON.stringify({
        userId: 'test-user',
        message: '안녕'
      })
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(200);
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  test('GET /chat/session/{id} - 세션 조회', async () => {
    mockDynamoDB.query.mockResolvedValue({
      Items: [{ message: '테스트 메시지' }]
    });

    const event = {
      path: '/chat/session/test-session-id',
      httpMethod: 'GET'
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(200);
  });
});
```

**예상 소요 시간**: 2-3일

---

#### 12. E2E 테스트 (Playwright)
**목표:**
- 주요 사용자 플로우 테스트
- 브라우저 자동화 테스트

**테스트 시나리오:**
```
e2e/
├── auth.spec.ts              # 로그인/로그아웃
├── initial-assessment.spec.ts # 초기 진단
├── chat.spec.ts              # AI 채팅
├── dashboard.spec.ts         # 대시보드
└── admin.spec.ts             # 관리자 기능
```

**설치:**
```bash
npm install -D @playwright/test
npx playwright install
```

**테스트 예시:**
```typescript
// e2e/chat.spec.ts
import { test, expect } from '@playwright/test';

test('AI 봇과 대화하기', async ({ page }) => {
  // 로그인
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'Test1234!');
  await page.click('button[type="submit"]');

  // 대시보드에서 봇 선택
  await page.waitForSelector('text=추천 AI 봇');
  await page.click('text=논리적 사고 코치');

  // 채팅 메시지 입력
  await page.fill('textarea[placeholder*="메시지"]', '안녕하세요');
  await page.click('button:has-text("전송")');

  // AI 응답 대기
  await page.waitForSelector('.chat-bubble.assistant', { timeout: 10000 });

  const response = await page.textContent('.chat-bubble.assistant');
  expect(response).toBeTruthy();
});
```

**예상 소요 시간**: 3일

---

#### 13. Lambda Layer로 공통 의존성 분리
**현재 문제:**
- 8개 Lambda 함수가 각각 `node_modules` 보유
- AWS SDK, DynamoDB Client 중복 설치
- 배포 패키지 크기 증가

**해결 방안:**
```
lambda-layers/
└── common-dependencies/
    ├── nodejs/
    │   └── node_modules/
    │       ├── @aws-sdk/client-dynamodb
    │       ├── @aws-sdk/lib-dynamodb
    │       └── @aws-sdk/client-cognito-identity-provider
    └── package.json
```

**Lambda Layer 생성:**
```bash
cd lambda-layers/common-dependencies
mkdir -p nodejs
cd nodejs
npm init -y
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb

# ZIP 생성
cd ..
zip -r common-dependencies.zip nodejs

# AWS에 업로드
aws lambda publish-layer-version \
  --layer-name ai-co-learner-common \
  --zip-file fileb://common-dependencies.zip \
  --compatible-runtimes nodejs20.x \
  --region ap-northeast-2
```

**각 Lambda에 Layer 연결:**
```bash
aws lambda update-function-configuration \
  --function-name ai-co-learner-chat-core \
  --layers arn:aws:lambda:ap-northeast-2:ACCOUNT_ID:layer:ai-co-learner-common:1
```

**예상 효과:**
- 배포 패키지 크기 50% 감소
- 배포 속도 향상
- 의존성 관리 일원화

**예상 소요 시간**: 1일

---

#### 14. CloudWatch 알림 설정
**목표:**
- Lambda 에러 자동 알림
- DynamoDB 사용량 모니터링
- Gemini API 비용 추적

**알림 항목:**
```
1. Lambda 에러율 > 5% (5분 평균)
2. Lambda 실행 시간 > 50초 (타임아웃 임박)
3. DynamoDB Read/Write Capacity 사용률 > 80%
4. Gemini API 일일 토큰 사용량 > 100만 토큰
5. 월간 예상 비용 > $20
```

**CloudWatch Alarm 생성 (예시):**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name ai-co-learner-lambda-errors \
  --alarm-description "Lambda 에러율 5% 초과" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Average \
  --period 300 \
  --threshold 0.05 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:ap-northeast-2:ACCOUNT_ID:alerts
```

**SNS 토픽 생성 (이메일 알림):**
```bash
aws sns create-topic --name ai-co-learner-alerts
aws sns subscribe \
  --topic-arn arn:aws:sns:ap-northeast-2:ACCOUNT_ID:ai-co-learner-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com
```

**예상 소요 시간**: 4시간

---

#### 15. KnowledgeBase 페이지 구현 또는 제거 결정
**현재 상태:**
- `src/pages/KnowledgeBase.tsx` 스텁 상태
- CLAUDE.md에 "학습 자료 (예정)" 표기
- 라우팅은 설정되어 있으나 기능 없음

**선택지:**

**Option A: 구현 (Phase 8-9)**
```typescript
// 학습 자료 시스템 설계
interface LearningResource {
  id: string;
  title: string;
  category: string; // 'tutorial', 'concept', 'exercise'
  competency: CompetencyType; // 연관 역량
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  content: string; // Markdown 형식
  estimatedTime: number; // 분
}

// DynamoDB 테이블
// ai-co-learner-learning-resources
```

**기능 요구사항:**
- 역량별 필터링
- 난이도별 추천
- 학습 진행도 추적
- AI 봇 연계 (자료 학습 후 관련 봇 추천)

**Option B: 제거**
- 현재 단계에서 우선순위 낮음
- Phase 10 이후로 연기
- 라우팅 및 메뉴에서 제거

**결정 기준:**
- 사용자 피드백 확인
- 개발 리소스 가용성
- 다른 기능 완성도 우선

**예상 소요 시간**:
- 구현: 5-7일
- 제거: 30분

---

#### 16. TypeScript 빌드 경고 수정
**확인 필요:**
```bash
npm run build
# 미사용 변수, 미사용 파라미터 경고 확인
```

**tsconfig.json 설정 (이미 활성화됨):**
```json
{
  "compilerOptions": {
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**예상 작업:**
- 미사용 import 제거
- 미사용 변수 제거 또는 `_` 접두사 추가
- 미사용 함수 파라미터 제거 또는 `_` 접두사

**예상 소요 시간**: 2시간

---

#### 17. 퀘스트 시스템 고도화 (AI 기반 동적 생성)
**현재 문제:**
- 고정된 8개 템플릿만 존재 (conversation 3개, challenge 2개, reflection 2개)
- 같은 역량이 계속 낮으면 동일한 퀘스트 반복 출제 가능
- 사용자 학습 이력, 관심사, 봇 사용 패턴 미반영
- 퀘스트 제목, 설명, 조건이 모두 하드코딩되어 있음

**개선 방안:**

**1. AI 기반 동적 퀘스트 생성**
```javascript
// quest-generator Lambda 개선
async function generatePersonalizedQuest(userId, targetCompetency) {
  // 최근 7일 대화 내용, 봇 사용 이력, 관심 주제 분석
  const userContext = await analyzeUserContext(userId);

  // Gemini API로 맞춤형 퀘스트 생성
  const prompt = `
    사용자 정보:
    - 약점 역량: ${targetCompetency}
    - 최근 대화 주제: ${userContext.topics}
    - 선호 학습 방식: ${userContext.learningStyle}

    이 사용자에게 적합한 일일 퀘스트를 생성하세요.
    (제목, 설명, 완료 조건, 보상)
  `;

  const generatedQuest = await callGeminiAPI(prompt);
  return generatedQuest;
}
```

**2. 난이도 자동 조절**
```javascript
// 최근 7일 퀘스트 완료율 기반 난이도 조정
async function adjustDifficulty(userId) {
  const recentQuests = await getRecentQuests(userId, 7);
  const completionRate = calculateCompletionRate(recentQuests);

  if (completionRate >= 0.8) {
    // 완료율 80% 이상 → 난이도 상승
    return {
      messageCount: currentDifficulty.messageCount + 2,
      minScore: currentDifficulty.minScore + 5,
      rewards: { xp: currentRewards.xp + 20 }
    };
  } else if (completionRate <= 0.3) {
    // 완료율 30% 이하 → 난이도 하락
    return {
      messageCount: Math.max(3, currentDifficulty.messageCount - 2),
      minScore: Math.max(60, currentDifficulty.minScore - 5),
      rewards: { xp: Math.max(30, currentRewards.xp - 20) }
    };
  }

  return currentDifficulty; // 유지
}
```

**3. 퀘스트 다양성 보장**
```javascript
// 최근 7일 퀘스트와 중복 방지
async function ensureQuestDiversity(userId, newQuests) {
  const recentQuests = await getRecentQuests(userId, 7);
  const recentTitles = recentQuests.map(q => q.title);

  // 같은 제목의 퀘스트가 있으면 재생성
  for (const quest of newQuests) {
    if (recentTitles.includes(quest.title)) {
      // AI로 새로운 퀘스트 생성 또는 템플릿 풀에서 다른 것 선택
      quest = await generateAlternativeQuest(userId, quest.targetCompetency);
    }
  }

  return newQuests;
}

// 템플릿 풀 확장 (8개 → 20개 이상)
const EXTENDED_QUEST_TEMPLATES = {
  conversation: [/* 기존 3개 + 신규 5개 */],
  challenge: [/* 기존 2개 + 신규 3개 */],
  reflection: [/* 기존 2개 + 신규 2개 */],
  collaboration: [/* 신규 3개 */],
  problem_solving: [/* 신규 4개 */]
};
```

**DynamoDB 스키마 확장:**
```javascript
// ai-co-learner-daily-quests 테이블에 필드 추가
{
  userId: 'user-123',
  questDate: '2025-01-02',
  quests: [...],
  targetCompetency: 'thinkingDepth',

  // 신규 필드
  userContext: {
    recentTopics: ['React', 'TypeScript', 'AWS'],
    preferredBots: ['bot-1', 'bot-3'],
    completionRate7d: 0.65,
    currentDifficulty: 'medium'
  },
  generatedBy: 'ai' | 'template', // 생성 방식 추적
  createdAt: '2025-01-02T09:00:00Z',
  expiresAt: 1735891200 // 7일 TTL
}
```

**Lambda 환경 변수 추가:**
- `QUEST_DIVERSITY_DAYS=7` - 중복 확인 기간
- `MIN_COMPLETION_RATE=0.3` - 난이도 하향 임계값
- `MAX_COMPLETION_RATE=0.8` - 난이도 상향 임계값

**테스트 시나리오:**
1. 신규 사용자: 기본 난이도 템플릿 퀘스트
2. 완료율 높은 사용자: 난이도 자동 증가 확인
3. 완료율 낮은 사용자: 난이도 자동 감소 확인
4. 최근 7일 중복 퀘스트: 다른 퀘스트로 대체 확인
5. AI 생성 퀘스트: Gemini API 호출 및 파싱 성공 확인

**예상 효과:**
- 사용자 참여도 30% 향상 (개인화된 퀘스트)
- 퀘스트 완료율 50% → 70% 향상 (적절한 난이도)
- 학습 지속성 증가 (다양한 퀘스트 경험)

**예상 소요 시간**: 3-5일
- AI 생성 로직 구현: 1-2일
- 난이도 조절 알고리즘: 1일
- 다양성 보장 로직: 1일
- 테스트 및 검증: 1일

---

## 📊 전체 작업 타임라인

### Sprint 1 (이번 주) - 5일
- [ ] 테스트 프레임워크 설정 (3일)
- [ ] console.log 제거 (2시간)
- [ ] Git 불필요 파일 제거 (30분)
- [ ] ESLint/Prettier 설정 (3시간)
- [ ] .env.example 업데이트 (1시간)

**총 소요 시간**: 약 24시간 (3일)

---

### Sprint 2 (다음 주) - 5일
- [ ] chat-api Lambda 분리 (2일)
- [ ] API 에러 응답 문서화 (4시간)
- [ ] Lambda 환경 변수 통일 (3시간)
- [ ] Husky pre-commit 설정 (2시간)

**총 소요 시간**: 약 17시간 (2-3일)

---

### Sprint 3-4 (분기 계획) - 10일
- [ ] 문서 구조 재정리 (1일)
- [ ] Lambda 통합 테스트 (3일)
- [ ] E2E 테스트 (3일)
- [ ] Lambda Layer 설정 (1일)
- [ ] CloudWatch 알림 (4시간)
- [ ] KnowledgeBase 결정 (TBD)
- [ ] TypeScript 빌드 경고 수정 (2시간)

**총 소요 시간**: 약 60시간 (8일)

---

## 🎯 성공 지표 (KPI)

### Sprint 1 완료 후
- ✅ 테스트 커버리지 > 30% (주요 함수)
- ✅ console.log 0개
- ✅ ESLint 에러 0개
- ✅ Git에 debug 파일 0개

### Sprint 2 완료 후
- ✅ Lambda 함수 3개로 분리 완료
- ✅ API 에러 응답 표준화
- ✅ 환경 변수 100% 외부화
- ✅ Pre-commit hook 동작 확인

### 분기 완료 후
- ✅ 테스트 커버리지 > 60%
- ✅ E2E 테스트 5개 시나리오 통과
- ✅ 문서 구조 완성
- ✅ Lambda 배포 시간 50% 단축
- ✅ CloudWatch 알림 설정 완료

---

## 💡 참고 문서

- [프로젝트 구조](../CLAUDE.md)
- [개발 로드맵](development-roadmap.md)
- [AWS 아키텍처](aws-architecture.md)
- [사용량 추적 가이드](usage-tracking-guide.md)

---

**최종 업데이트**: 2025-12-30
**다음 리뷰 예정일**: 2025-01-06 (Sprint 1 완료 후)
