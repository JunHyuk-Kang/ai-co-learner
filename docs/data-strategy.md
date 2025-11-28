# AI Co-Learner 데이터 전략 문서

## 개요
사용자의 학습 패턴 분석 및 역량 수치화를 위한 2단계 데이터 보관 전략

---

## 문제 정의

### 현재 상황
- **모든 채팅 데이터를 영구 저장** → DynamoDB 비용 증가
- **역량 평가 시스템 미구현** → 하드코딩된 데이터만 표시
- **학습 분석 로직 없음** → 사용자 성장 추적 불가능

### 목표
1. DynamoDB 비용 최적화 (80% 절감 목표)
2. 사용자 학습 패턴 분석 및 역량 수치화
3. 개인화된 학습 추천 시스템 구축

---

## 2단계 데이터 전략

### 📊 1단계: 분석용 데이터 (장기 보관)

**새 테이블: `ai-co-learner-learning-analytics`**

```
스키마:
- userId (String, PK): 사용자 고유 ID
- timestamp (Number, SK): Unix timestamp
- sessionId (String): 봇 세션 ID (어느 봇과의 대화인지)
- messageId (String): 원본 메시지 참조 ID
- messageType (String): "question" | "answer" | "followup"
- userMessage (String): 사용자 메시지 원본
- aiMessage (String): AI 응답 원본
- analysisResult (Map): {
    questionQuality: Number,      // 질문 품질 점수 (0-100)
    thinkingDepth: Number,        // 사고 깊이 (0-100)
    creativity: Number,           // 창의성 (0-100)
    communicationClarity: Number, // 소통 명확성 (0-100)
    executionOriented: Number,    // 실행력 (0-100)
    collaborationSignal: Number   // 협업력 신호 (0-100)
  }
- learningDuration (Number): 메시지 작성 시간 (초)
- category (String): 학습 카테고리 (예: "coding", "math", "science", "language")
- expiresAt (Number): TTL (1년 후 자동 삭제) - 선택적
```

**보관 정책:**
- 1년 TTL 또는 영구 보관 (선택)
- 역량 변화 추적 및 장기 학습 패턴 분석에 사용

**용도:**
- 사용자 역량 점수 계산
- 학습 진도 및 성장 추적
- 개인화된 학습 추천
- 배지 달성 조건 판정

---

### 💬 2단계: 채팅 데이터 (단기 보관)

**기존 테이블: `ai-co-learner-chat-sessions`**

```
스키마 (기존):
- sessionId (String, PK): 봇 세션 ID
- timestamp (Number, SK): 메시지 타임스탬프
- messageId (String): 메시지 고유 ID
- userId (String): 사용자 ID
- userMessage (String): 사용자 메시지
- aiMessage (String): AI 응답
- createdAt (String): ISO 형식 생성 시간

추가 필요:
- expiresAt (Number): TTL (30일 후 자동 삭제)
```

**보관 정책:**
- 30일 TTL 적용
- DynamoDB가 자동으로 오래된 데이터 삭제

**용도:**
- 사용자 경험 (최근 대화 확인)
- 대화 컨텍스트 유지
- Claude API 호출 시 최근 10개 메시지 참조

---

## 데이터 흐름 다이어그램

```
사용자 메시지 전송
    ↓
Lambda: sendChatMessage()
    ↓
1. Claude API 호출 (채팅 응답 생성)
    ↓
2. Claude API 호출 (메시지 분석)
   프롬프트: "이 메시지의 학습 품질을 다음 기준으로 평가:
             - 질문 품질 (명확성, 구체성)
             - 사고 깊이 (분석력, 논리성)
             - 창의성 (독창성, 다양한 관점)
             - 소통 명확성 (표현력, 문맥 이해)
             - 실행력 (구체적 행동 계획)
             - 협업력 (피드백 수용, 협력 의지)"
    ↓
3. 두 가지 테이블에 동시 저장
   ├─ chat-sessions 테이블 (30일 TTL)
   │  └─ 일반 채팅 데이터
   └─ learning-analytics 테이블 (1년 TTL)
      └─ 분석 결과 + 메시지 복사본
    ↓
4. 응답 반환
```

---

## 역량 계산 시스템

### 새 테이블: `ai-co-learner-user-competencies`

```
스키마:
- userId (String, PK): 사용자 고유 ID
- competency (String, SK): 역량명
  - "questionQuality" (질문력)
  - "thinkingDepth" (사고력)
  - "creativity" (창의력)
  - "executionOriented" (실행력)
  - "communicationClarity" (소통력)
  - "collaborationSignal" (협업력)
- score (Number): 현재 점수 (0-100)
- historicalScores (List): 과거 점수 이력 [
    { timestamp: 1234567890, score: 75 },
    { timestamp: 1234567900, score: 78 }
  ]
- updatedAt (Number): 마지막 업데이트 시간
- totalMessages (Number): 분석된 총 메시지 수
```

### 역량 점수 계산 로직

**주기:** 매일 1회 실행 (EventBridge Scheduler)

**Lambda 함수: `calculateUserCompetencies`**

```javascript
1. 모든 활성 사용자 조회
2. 각 사용자별로:
   a. 최근 30일 learning-analytics 데이터 조회
   b. 각 역량별 점수 평균 계산
   c. 가중 평균 적용 (최근 데이터에 더 높은 가중치)
   d. user-competencies 테이블 업데이트
   e. 필요시 사용자 level, title 자동 업그레이드
3. 배지 달성 조건 확인 및 업데이트
```

**가중 평균 공식:**
```
최근 7일: 가중치 0.5
최근 8-14일: 가중치 0.3
최근 15-30일: 가중치 0.2

최종 점수 = (최근7일평균 × 0.5) + (최근8-14일평균 × 0.3) + (최근15-30일평균 × 0.2)
```

---

## 배지 시스템

### 새 테이블: `ai-co-learner-user-badges`

```
스키마:
- userId (String, PK): 사용자 고유 ID
- badgeId (String, SK): 배지 고유 ID
- badgeName (String): 배지 이름
- description (String): 배지 설명
- achieved (Boolean): 달성 여부
- achievedAt (Number): 달성 시간 (Unix timestamp)
- progress (Number): 진행률 (0-100)
- criteria (Map): 달성 조건
```

### 배지 정의 예시

```javascript
const BADGES = [
  {
    badgeId: "innovation-master",
    name: "Innovation Master",
    description: "창의력 점수 90점 이상 달성",
    criteria: {
      competency: "creativity",
      threshold: 90,
      duration: 7 // 7일 연속
    }
  },
  {
    badgeId: "deep-thinker",
    name: "Deep Thinker",
    description: "사고력 점수 85점 이상 달성",
    criteria: {
      competency: "thinkingDepth",
      threshold: 85,
      duration: 7
    }
  },
  {
    badgeId: "question-king",
    name: "Question King",
    description: "100개 이상의 고품질 질문 작성",
    criteria: {
      competency: "questionQuality",
      threshold: 80,
      minMessages: 100
    }
  },
  {
    badgeId: "team-player",
    name: "Team Player",
    description: "협업력 점수 80점 이상 달성",
    criteria: {
      competency: "collaborationSignal",
      threshold: 80,
      duration: 14
    }
  }
];
```

---

## AI 기반 메시지 분석 자동화

### Claude API를 이용한 자동 분석

**Lambda 함수: `analyzeMessage`**

```javascript
async function analyzeMessage(userMessage, aiMessage) {
  const analysisPrompt = `
다음 학습 대화를 분석하고 각 항목을 0-100점으로 평가해주세요.

사용자 메시지: "${userMessage}"
AI 응답: "${aiMessage}"

평가 기준:
1. 질문 품질 (questionQuality): 명확성, 구체성, 적절성
2. 사고 깊이 (thinkingDepth): 분석력, 논리성, 추론 능력
3. 창의성 (creativity): 독창성, 다양한 관점, 새로운 시도
4. 소통 명확성 (communicationClarity): 표현력, 문맥 이해, 명료함
5. 실행력 (executionOriented): 구체적 행동 계획, 실천 의지
6. 협업력 (collaborationSignal): 피드백 수용성, 협력 의지

JSON 형식으로만 응답해주세요:
{
  "questionQuality": 85,
  "thinkingDepth": 70,
  "creativity": 90,
  "communicationClarity": 75,
  "executionOriented": 80,
  "collaborationSignal": 65,
  "category": "coding",
  "messageType": "question"
}
`;

  const response = await invokeBedrockClaude({
    messages: [{ role: "user", content: analysisPrompt }],
    max_tokens: 500,
    temperature: 0.3 // 일관성을 위해 낮은 temperature
  });

  return JSON.parse(response.content[0].text);
}
```

### 분석 결과 저장

```javascript
async function saveChatWithAnalysis(userId, sessionId, userMessage, aiMessage) {
  const timestamp = Date.now();
  const messageId = `${sessionId}-${timestamp}`;

  // 1. AI 분석 수행
  const analysis = await analyzeMessage(userMessage, aiMessage);

  // 2. chat-sessions 테이블에 저장 (30일 TTL)
  await dynamoClient.send(new PutCommand({
    TableName: 'ai-co-learner-chat-sessions',
    Item: {
      sessionId,
      timestamp,
      messageId,
      userId,
      userMessage,
      aiMessage,
      createdAt: new Date().toISOString(),
      expiresAt: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30일 후
    }
  }));

  // 3. learning-analytics 테이블에 저장 (1년 TTL)
  await dynamoClient.send(new PutCommand({
    TableName: 'ai-co-learner-learning-analytics',
    Item: {
      userId,
      timestamp,
      sessionId,
      messageId,
      messageType: analysis.messageType,
      userMessage,
      aiMessage,
      analysisResult: {
        questionQuality: analysis.questionQuality,
        thinkingDepth: analysis.thinkingDepth,
        creativity: analysis.creativity,
        communicationClarity: analysis.communicationClarity,
        executionOriented: analysis.executionOriented,
        collaborationSignal: analysis.collaborationSignal
      },
      category: analysis.category,
      expiresAt: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1년 후
    }
  }));
}
```

---

## 비용 분석

### 현재 구조 (개선 전)
```
가정:
- 사용자 1,000명
- 사용자당 평균 5개 봇
- 봇당 평균 500개 메시지
- 메시지당 평균 1KB

총 아이템 수: 1,000 × 5 × 500 = 2,500,000개
저장 용량: 2,500,000 × 1KB = 2.5GB
DynamoDB 비용: 약 $0.625/월 (저장) + 읽기/쓰기 비용
```

### 개선 후
```
chat-sessions (30일 TTL):
- 아이템 수: 1,000 × 5 × 100 = 500,000개 (80% 감소)
- 저장 용량: 0.5GB
- 비용: $0.125/월

learning-analytics (1년 TTL):
- 아이템 수: 2,500,000개 (동일)
- 저장 용량: 2.5GB (분석 데이터 포함)
- 비용: $0.625/월

총 비용: $0.75/월
추가 비용: Claude API 분석 호출 ($0.003/메시지 × 월 5만 메시지 = $150)

총 운영 비용: 약 $150.75/월
```

**트레이드오프:**
- 채팅 저장 비용은 감소하지만 Claude API 분석 비용 증가
- 하지만 **역량 분석, 개인화 추천** 등 부가 가치 창출

### 비용 최적화 옵션

1. **배치 분석**: 메시지 10개씩 모아서 한 번에 분석 (API 호출 90% 감소)
2. **선택적 분석**: 중요한 메시지만 분석 (예: 5개 메시지당 1개)
3. **캐싱**: 유사한 메시지는 재분석 생략

---

## 구현 단계

### Phase 1: 메시지 분석 시스템 (1-2주)
- [ ] `ai-co-learner-learning-analytics` 테이블 생성
- [ ] Lambda에 `analyzeMessage` 함수 추가
- [ ] `sendChatMessage` 함수 수정 (분석 로직 통합)
- [ ] 테스트 및 검증

### Phase 2: 역량 계산 시스템 (1-2주)
- [ ] `ai-co-learner-user-competencies` 테이블 생성
- [ ] `calculateUserCompetencies` Lambda 함수 작성
- [ ] EventBridge 스케줄러 설정 (매일 1회 실행)
- [ ] 프론트엔드 대시보드에 실시간 데이터 연동

### Phase 3: 배지 시스템 (1주)
- [ ] `ai-co-learner-user-badges` 테이블 생성
- [ ] 배지 달성 조건 정의
- [ ] `checkBadgeAchievements` Lambda 함수 작성
- [ ] 프론트엔드 배지 UI 업데이트

### Phase 4: 채팅 데이터 정리 (1일)
- [ ] `chat-sessions` 테이블에 TTL 설정
- [ ] 기존 메시지에 `expiresAt` 필드 추가 (마이그레이션)
- [ ] 모니터링 및 검증

### Phase 5: 최적화 및 모니터링 (지속)
- [ ] 분석 정확도 개선
- [ ] 비용 모니터링 대시보드 구축
- [ ] 사용자 피드백 수집 및 반영

---

## API 엔드포인트 추가 필요

### 사용자 역량 조회
```
GET /users/{userId}/competencies

응답:
{
  "userId": "abc123",
  "competencies": [
    { "name": "questionQuality", "score": 85, "trend": "+5" },
    { "name": "thinkingDepth", "score": 70, "trend": "+2" },
    { "name": "creativity", "score": 90, "trend": "-1" },
    { "name": "communicationClarity", "score": 75, "trend": "+8" },
    { "name": "executionOriented", "score": 80, "trend": "+3" },
    { "name": "collaborationSignal", "score": 65, "trend": "+1" }
  ],
  "lastUpdated": 1234567890
}
```

### 사용자 배지 조회
```
GET /users/{userId}/badges

응답:
{
  "userId": "abc123",
  "badges": [
    {
      "badgeId": "innovation-master",
      "name": "Innovation Master",
      "achieved": true,
      "achievedAt": 1234567890,
      "progress": 100
    },
    {
      "badgeId": "deep-thinker",
      "name": "Deep Thinker",
      "achieved": false,
      "progress": 70
    }
  ]
}
```

### 학습 통계 조회
```
GET /users/{userId}/learning-stats?period=30d

응답:
{
  "userId": "abc123",
  "period": "30d",
  "totalMessages": 250,
  "totalSessions": 45,
  "averageSessionLength": 12.5,
  "totalLearningTime": 3600,
  "competencyTrends": {
    "questionQuality": [75, 78, 80, 82, 85],
    "thinkingDepth": [65, 66, 68, 69, 70]
  },
  "topCategories": ["coding", "math", "science"]
}
```

---

## 보안 및 프라이버시

### 데이터 보호
- 모든 테이블에 사용자별 접근 제어 (Cognito userId 기반)
- 민감한 메시지 내용은 암호화 저장 (선택적)
- GDPR 준수: 사용자 데이터 삭제 API 제공

### 삭제 API
```
DELETE /users/{userId}/data?type=all|chat|analytics

기능:
- all: 모든 사용자 데이터 삭제
- chat: 채팅 이력만 삭제
- analytics: 학습 분석 데이터만 삭제
```

---

## 성공 지표 (KPI)

### 시스템 성능
- 메시지 분석 정확도: 85% 이상
- API 응답 시간: 2초 이하
- 일일 분석 처리량: 10만 메시지

### 비즈니스 성과
- 사용자 참여도 증가: 30% 이상
- 평균 세션 길이 증가: 20% 이상
- 사용자 만족도: 4.5/5.0 이상

### 비용 효율성
- DynamoDB 저장 비용: 80% 절감
- 총 운영 비용: 월 $200 이하
- 사용자당 비용: $0.20 이하

---

## 향후 확장 계획

### AI 코칭 시스템
- 역량이 낮은 영역에 대한 자동 추천
- 개인화된 학습 경로 생성
- 실시간 피드백 제공

### 소셜 기능
- 사용자 간 역량 비교 (익명)
- 리더보드 및 랭킹 시스템
- 팀 학습 및 협업 기능

### 고급 분석
- 머신러닝 기반 학습 패턴 예측
- 맞춤형 난이도 조절
- 학습 효율성 최적화

---

## 참고 자료

- [DynamoDB TTL 설정 가이드](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html)
- [AWS Lambda EventBridge 스케줄러](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-rule-schedule.html)
- [Claude API 문서](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
- [DynamoDB 비용 계산기](https://calculator.aws/)

---

**문서 작성일**: 2025-11-27
**작성자**: AI Co-Learner Development Team
**버전**: 1.0
