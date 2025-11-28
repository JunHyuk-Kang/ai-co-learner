# AI 기반 메시지 자동 분석 구현 가이드

## 개요
Claude AI를 활용하여 사용자 메시지를 자동으로 분석하고 학습 역량을 수치화하는 시스템

---

## 1. AI 분석 자동화 전략

### 방식 A: **동기 분석** (실시간)
```
사용자 메시지 전송
    ↓
Claude API 호출 #1: 채팅 응답 생성
    ↓
Claude API 호출 #2: 메시지 분석 (별도)
    ↓
두 결과를 모두 DynamoDB에 저장
    ↓
응답 반환
```

**장점:**
- 실시간 분석
- 데이터 일관성 보장

**단점:**
- 응답 시간 증가 (약 2-3초 추가)
- API 비용 2배

---

### 방식 B: **비동기 분석** (추천 ✅)
```
사용자 메시지 전송
    ↓
Claude API 호출: 채팅 응답 생성
    ↓
chat-sessions에 저장 + SQS 큐에 메시지 발행
    ↓
즉시 응답 반환 (빠름!)
    ↓
[별도 Lambda] SQS 트리거
    ↓
Claude API 호출: 메시지 분석
    ↓
learning-analytics에 저장
```

**장점:**
- 빠른 응답 시간 (기존과 동일)
- 분석 실패해도 채팅은 정상 작동
- 배치 처리 가능 (비용 최적화)

**단점:**
- 약간의 지연 (1-2초)
- 아키텍처 복잡도 증가

---

### 방식 C: **배치 분석** (비용 최적화)
```
사용자 메시지들을 일단 저장
    ↓
EventBridge 스케줄러 (5분마다)
    ↓
최근 5분간의 메시지를 한 번에 분석
    ↓
Claude API에 여러 메시지를 한 번에 전송
    ↓
분석 결과 저장
```

**장점:**
- API 호출 수 90% 감소
- 비용 최소화

**단점:**
- 실시간 분석 아님 (최대 5분 지연)
- 대시보드 업데이트 지연

---

## 2. 추천 아키텍처: 방식 B (비동기)

### 시스템 구성도

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
└────────────────────────────┬────────────────────────────────┘
                             │
                    POST /chat (메시지 전송)
                             ↓
┌─────────────────────────────────────────────────────────────┐
│              API Gateway + Lambda (chat-api)                 │
│                                                               │
│  1. Claude API 호출 (채팅 응답)                              │
│  2. DynamoDB 저장 (chat-sessions)                            │
│  3. SQS 큐에 메시지 발행                                     │
│  4. 즉시 응답 반환 ✅                                        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ SQS Message
                 ↓
┌─────────────────────────────────────────────────────────────┐
│        Lambda: message-analyzer (SQS 트리거)                 │
│                                                               │
│  1. SQS에서 메시지 수신                                      │
│  2. Claude API 호출 (메시지 분석)                            │
│  3. 분석 결과 파싱                                           │
│  4. DynamoDB 저장 (learning-analytics)                       │
│  5. 역량 점수 업데이트 (선택적)                              │
└─────────────────────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────┐
│              DynamoDB Tables                                 │
│                                                               │
│  - ai-co-learner-chat-sessions (30일 TTL)                   │
│  - ai-co-learner-learning-analytics (1년 TTL)               │
│  - ai-co-learner-user-competencies                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Claude AI 분석 프롬프트 설계

### 핵심: JSON 모드 사용

Claude에게 **구조화된 JSON 응답**을 요청하여 파싱 오류 최소화

```javascript
const ANALYSIS_PROMPT = `
당신은 학습 행동 분석 전문가입니다. 사용자와 AI의 대화를 분석하여 학습 역량을 평가해주세요.

대화 내용:
- 사용자: "${userMessage}"
- AI 응답: "${aiMessage}"

다음 6가지 역량을 0-100점으로 평가하고, 반드시 JSON 형식으로만 응답하세요:

1. **질문 품질 (questionQuality)**
   - 질문이 명확하고 구체적인가?
   - 학습 의도가 분명한가?
   - 답변 가능한 형태로 질문했는가?

2. **사고 깊이 (thinkingDepth)**
   - 단순 암기를 넘어 깊이 있는 이해를 추구하는가?
   - 논리적 사고와 추론이 보이는가?
   - 왜(Why)와 어떻게(How)를 고민하는가?

3. **창의성 (creativity)**
   - 기존과 다른 관점이나 접근을 시도하는가?
   - 응용력과 확장적 사고가 보이는가?
   - 독창적인 아이디어나 연결을 만드는가?

4. **소통 명확성 (communicationClarity)**
   - 자신의 생각을 명확하게 표현하는가?
   - 문맥을 잘 이해하고 있는가?
   - 적절한 어휘와 문장 구조를 사용하는가?

5. **실행력 (executionOriented)**
   - 배운 내용을 실제로 적용하려는 의지가 보이는가?
   - 구체적인 행동 계획이나 실천 방안을 언급하는가?
   - 결과 지향적인 질문을 하는가?

6. **협업력 (collaborationSignal)**
   - AI의 피드백을 수용하고 반영하는가?
   - 대화를 발전적으로 이어가는가?
   - 상호작용에서 협력적 태도를 보이는가?

추가 정보:
- **메시지 타입**: "question" (질문), "answer" (답변), "followup" (후속 질문), "casual" (일상 대화)
- **학습 카테고리**: 이 대화가 어떤 주제인지 (예: "coding", "math", "science", "language", "general")

응답 형식 (JSON만):
{
  "questionQuality": 85,
  "thinkingDepth": 70,
  "creativity": 90,
  "communicationClarity": 75,
  "executionOriented": 80,
  "collaborationSignal": 65,
  "messageType": "question",
  "category": "coding",
  "reasoning": "사용자는 명확하고 구체적인 질문을 했으며, 깊이 있는 이해를 추구하고 있습니다."
}

중요: 반드시 위 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.
`;
```

---

## 4. 구현 코드

### Step 1: SQS 큐 생성 (AWS Console)

```
큐 이름: ai-co-learner-message-analysis-queue
타입: Standard
기본 가시성 제한 시간: 30초
메시지 보존 기간: 4일
최대 메시지 크기: 256KB
```

---

### Step 2: Lambda 함수 수정 (chat-api)

**파일: `lambda/chat-api/index.mjs`**

```javascript
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqsClient = new SQSClient({ region: "ap-northeast-2" });
const ANALYSIS_QUEUE_URL = "https://sqs.ap-northeast-2.amazonaws.com/YOUR_ACCOUNT_ID/ai-co-learner-message-analysis-queue";

// sendChatMessage 함수 수정
async function sendChatMessage(event, headers) {
  // ... 기존 코드 ...

  // 8. DynamoDB에 메시지 저장
  const timestamp = Date.now();
  const messageId = `${sessionId}-${timestamp}`;

  await dynamoClient.send(new PutCommand({
    TableName: SESSIONS_TABLE,
    Item: {
      sessionId,
      timestamp,
      messageId,
      userId,
      userMessage: message,
      aiMessage: aiMessage,
      createdAt: new Date().toISOString()
    }
  }));

  // ✨ 새로 추가: SQS에 분석 요청 메시지 발행
  try {
    await sqsClient.send(new SendMessageCommand({
      QueueUrl: ANALYSIS_QUEUE_URL,
      MessageBody: JSON.stringify({
        userId,
        sessionId,
        messageId,
        userMessage: message,
        aiMessage: aiMessage,
        timestamp
      })
    }));
    console.log("✅ Analysis request queued:", messageId);
  } catch (error) {
    console.error("⚠️ Failed to queue analysis (non-blocking):", error);
    // 분석 실패해도 채팅은 계속 진행
  }

  // 9. 클라이언트에 응답 반환
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      aiMessage: {
        id: messageId,
        sender: 'ai',
        text: aiMessage,
        timestamp
      }
    })
  };
}
```

---

### Step 3: 새 Lambda 함수 생성 (message-analyzer)

**파일: `lambda/message-analyzer/index.mjs`**

```javascript
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });
const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "ap-northeast-2" })
);

const ANALYTICS_TABLE = "ai-co-learner-learning-analytics";
const MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0"; // 빠르고 저렴

export const handler = async (event) => {
  console.log("Received SQS event:", JSON.stringify(event, null, 2));

  // SQS는 배치로 메시지를 전달 (최대 10개)
  const results = await Promise.allSettled(
    event.Records.map(record => analyzeMessage(record))
  );

  // 실패한 메시지는 자동으로 재시도됨
  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length > 0) {
    console.error(`❌ ${failed.length} messages failed analysis`);
    throw new Error(`Failed to analyze ${failed.length} messages`);
  }

  console.log(`✅ Successfully analyzed ${results.length} messages`);
  return { statusCode: 200 };
};

async function analyzeMessage(record) {
  const data = JSON.parse(record.body);
  const { userId, sessionId, messageId, userMessage, aiMessage, timestamp } = data;

  console.log(`Analyzing message: ${messageId}`);

  // 1. Claude에게 분석 요청
  const analysisPrompt = buildAnalysisPrompt(userMessage, aiMessage);

  const bedrockResponse = await bedrockClient.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 500,
      temperature: 0.3, // 일관성을 위해 낮은 temperature
      messages: [
        { role: "user", content: analysisPrompt }
      ]
    })
  }));

  // 2. 응답 파싱
  const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
  const analysisText = responseBody.content[0].text;

  // JSON 추출 (Claude가 가끔 추가 텍스트를 포함할 수 있음)
  const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to extract JSON from analysis response");
  }

  const analysis = JSON.parse(jsonMatch[0]);

  console.log("Analysis result:", analysis);

  // 3. DynamoDB에 저장
  await dynamoClient.send(new PutCommand({
    TableName: ANALYTICS_TABLE,
    Item: {
      userId,
      timestamp,
      sessionId,
      messageId,
      messageType: analysis.messageType || "question",
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
      category: analysis.category || "general",
      reasoning: analysis.reasoning || "",
      // 1년 후 자동 삭제 (TTL)
      expiresAt: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
    }
  }));

  console.log(`✅ Analysis saved for message: ${messageId}`);
}

function buildAnalysisPrompt(userMessage, aiMessage) {
  return `
당신은 학습 행동 분석 전문가입니다. 사용자와 AI의 대화를 분석하여 학습 역량을 평가해주세요.

대화 내용:
- 사용자: "${userMessage}"
- AI 응답: "${aiMessage}"

다음 6가지 역량을 0-100점으로 평가하고, 반드시 JSON 형식으로만 응답하세요:

1. **질문 품질 (questionQuality)**: 질문이 명확하고 구체적이며 학습 의도가 분명한가?
2. **사고 깊이 (thinkingDepth)**: 깊이 있는 이해를 추구하고 논리적 사고가 보이는가?
3. **창의성 (creativity)**: 독창적이고 확장적인 사고를 하는가?
4. **소통 명확성 (communicationClarity)**: 자신의 생각을 명확하게 표현하는가?
5. **실행력 (executionOriented)**: 배운 내용을 실제로 적용하려는 의지가 보이는가?
6. **협업력 (collaborationSignal)**: 피드백을 수용하고 대화를 발전적으로 이어가는가?

응답 형식 (JSON만):
{
  "questionQuality": 85,
  "thinkingDepth": 70,
  "creativity": 90,
  "communicationClarity": 75,
  "executionOriented": 80,
  "collaborationSignal": 65,
  "messageType": "question",
  "category": "coding",
  "reasoning": "사용자는 명확하고 구체적인 질문을 했으며, 깊이 있는 이해를 추구하고 있습니다."
}

중요: 반드시 위 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.
`;
}
```

---

### Step 4: DynamoDB 테이블 생성

**테이블명**: `ai-co-learner-learning-analytics`

```
파티션 키: userId (String)
정렬 키: timestamp (Number)

속성:
- sessionId (String)
- messageId (String)
- messageType (String)
- userMessage (String)
- aiMessage (String)
- analysisResult (Map)
  - questionQuality (Number)
  - thinkingDepth (Number)
  - creativity (Number)
  - communicationClarity (Number)
  - executionOriented (Number)
  - collaborationSignal (Number)
- category (String)
- reasoning (String)
- expiresAt (Number) - TTL 속성

TTL 설정:
- TTL 속성: expiresAt
- 1년 후 자동 삭제
```

---

### Step 5: Lambda 권한 설정

**chat-api Lambda 역할에 SQS 권한 추가:**
```json
{
  "Effect": "Allow",
  "Action": [
    "sqs:SendMessage"
  ],
  "Resource": "arn:aws:sqs:ap-northeast-2:YOUR_ACCOUNT_ID:ai-co-learner-message-analysis-queue"
}
```

**message-analyzer Lambda 역할 권한:**
```json
{
  "Effect": "Allow",
  "Action": [
    "sqs:ReceiveMessage",
    "sqs:DeleteMessage",
    "sqs:GetQueueAttributes"
  ],
  "Resource": "arn:aws:sqs:ap-northeast-2:YOUR_ACCOUNT_ID:ai-co-learner-message-analysis-queue"
},
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:PutItem"
  ],
  "Resource": "arn:aws:dynamodb:ap-northeast-2:YOUR_ACCOUNT_ID:table/ai-co-learner-learning-analytics"
},
{
  "Effect": "Allow",
  "Action": [
    "bedrock:InvokeModel"
  ],
  "Resource": "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
}
```

---

### Step 6: SQS 트리거 설정

**message-analyzer Lambda에 SQS 트리거 추가:**
```
트리거: SQS
큐: ai-co-learner-message-analysis-queue
배치 크기: 10 (한 번에 10개 메시지 처리)
배치 윈도우: 5초 (5초 동안 메시지 수집)
```

---

## 5. 비용 분석

### Claude API 비용
```
모델: Claude 3 Haiku
가격: $0.25 / 1M input tokens, $1.25 / 1M output tokens

분석 프롬프트 예상 토큰:
- Input: ~800 tokens (프롬프트 + 메시지)
- Output: ~200 tokens (JSON 응답)

메시지당 비용: ~$0.00045

월 10만 메시지:
- 분석 비용: 100,000 × $0.00045 = $45
- 채팅 응답 비용: 100,000 × $0.001 = $100
- 총 Claude 비용: $145
```

### AWS 서비스 비용
```
SQS:
- 무료 티어: 월 100만 요청
- 초과 비용: $0.40 / 100만 요청
- 월 10만 메시지: 무료

Lambda (message-analyzer):
- 무료 티어: 월 100만 요청, 400,000 GB-초
- 초과 비용: 거의 없음 (예상 월 $1 이하)

DynamoDB (learning-analytics):
- 쓰기: 100,000 × $1.25/100만 = $0.125
- 저장: 1GB × $0.25 = $0.25
- 총 DynamoDB 비용: ~$0.40
```

### 총 예상 비용
```
월 10만 메시지 기준:
- Claude API: $145
- AWS 서비스: $1.40
- 총 운영 비용: ~$150/월

메시지당 비용: $0.0015
```

---

## 6. 최적화 전략

### 옵션 1: 선택적 분석 (비용 50% 절감)
```javascript
// 중요한 메시지만 분석
const shouldAnalyze = (userMessage) => {
  // 질문 메시지만 분석
  if (userMessage.includes('?') || userMessage.includes('무엇') || userMessage.includes('어떻게')) {
    return true;
  }
  // 짧은 대화는 제외
  if (userMessage.length < 20) {
    return false;
  }
  // 10% 샘플링
  return Math.random() < 0.1;
};

if (shouldAnalyze(message)) {
  await sqsClient.send(new SendMessageCommand({ ... }));
}
```

### 옵션 2: 배치 분석 (비용 80% 절감)
```javascript
// 5분마다 최근 메시지들을 한 번에 분석
const BATCH_ANALYSIS_PROMPT = `
다음 10개의 대화를 한 번에 분석해주세요:

1. 사용자: "..." / AI: "..."
2. 사용자: "..." / AI: "..."
...

각 대화에 대해 JSON 배열로 응답:
[
  { "messageId": "...", "questionQuality": 85, ... },
  { "messageId": "...", "questionQuality": 70, ... }
]
`;
```

### 옵션 3: 캐싱 (중복 분석 방지)
```javascript
// 유사한 메시지는 재분석 생략
const messageHash = crypto.createHash('md5').update(userMessage).digest('hex');
const cachedAnalysis = await getCachedAnalysis(messageHash);

if (cachedAnalysis && similarity > 0.9) {
  return cachedAnalysis; // 캐시된 결과 사용
}
```

---

## 7. 테스트 계획

### 단위 테스트
```javascript
// test/message-analyzer.test.js
describe('Message Analyzer', () => {
  it('should analyze a question message', async () => {
    const result = await analyzeMessage({
      userMessage: "Python에서 리스트 컴프리헨션은 어떻게 작동하나요?",
      aiMessage: "리스트 컴프리헨션은..."
    });

    expect(result.questionQuality).toBeGreaterThan(70);
    expect(result.messageType).toBe('question');
    expect(result.category).toBe('coding');
  });

  it('should handle casual conversation', async () => {
    const result = await analyzeMessage({
      userMessage: "안녕하세요!",
      aiMessage: "안녕하세요! 무엇을 도와드릴까요?"
    });

    expect(result.messageType).toBe('casual');
  });
});
```

### 통합 테스트
```bash
# 1. SQS에 테스트 메시지 발행
aws sqs send-message \
  --queue-url https://sqs.ap-northeast-2.amazonaws.com/YOUR_ACCOUNT_ID/ai-co-learner-message-analysis-queue \
  --message-body '{
    "userId": "test-user-123",
    "sessionId": "bot-123",
    "messageId": "test-msg-1",
    "userMessage": "AI란 무엇인가요?",
    "aiMessage": "AI는 인공지능을 의미합니다...",
    "timestamp": 1234567890
  }'

# 2. DynamoDB에서 결과 확인
aws dynamodb query \
  --table-name ai-co-learner-learning-analytics \
  --key-condition-expression "userId = :userId" \
  --expression-attribute-values '{":userId":{"S":"test-user-123"}}'
```

---

## 8. 모니터링 및 알림

### CloudWatch 메트릭
```
- SQS 큐 깊이 (대기 중인 메시지 수)
- Lambda 에러율
- 분석 처리 시간
- Claude API 응답 시간
```

### 알림 설정
```
- SQS 큐에 100개 이상 메시지 쌓이면 알림
- Lambda 에러율 5% 초과 시 알림
- Claude API 실패 시 즉시 알림
```

---

## 9. 배포 체크리스트

- [ ] SQS 큐 생성
- [ ] DynamoDB 테이블 생성 (learning-analytics)
- [ ] TTL 설정 (expiresAt)
- [ ] message-analyzer Lambda 함수 생성
- [ ] Lambda 권한 설정 (SQS, DynamoDB, Bedrock)
- [ ] SQS 트리거 추가
- [ ] chat-api Lambda 코드 업데이트
- [ ] chat-api Lambda 권한 추가 (SQS SendMessage)
- [ ] 테스트 메시지 전송
- [ ] CloudWatch 로그 확인
- [ ] DynamoDB 데이터 확인
- [ ] 프론트엔드 대시보드 연동

---

## 10. 향후 개선 사항

### Phase 1: 기본 분석 (현재 문서)
- 메시지별 역량 점수 분석
- DynamoDB에 저장

### Phase 2: 집계 및 대시보드
- 일일 배치로 역량 점수 계산
- 프론트엔드 대시보드에 실시간 표시

### Phase 3: 고급 분석
- 학습 패턴 인식 (시간대별, 주제별)
- 성장 추세 분석
- 개인화된 추천

### Phase 4: AI 코칭
- 약점 역량 개선 제안
- 맞춤형 학습 경로 생성
- 실시간 피드백

---

## 참고 자료

- [AWS SQS 개발자 가이드](https://docs.aws.amazon.com/sqs/)
- [AWS Lambda SQS 트리거](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html)
- [Claude API Messages API](https://docs.anthropic.com/claude/reference/messages_post)
- [DynamoDB TTL](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html)

---

**작성일**: 2025-11-27
**버전**: 1.0
**상태**: 구현 준비 완료 ✅
