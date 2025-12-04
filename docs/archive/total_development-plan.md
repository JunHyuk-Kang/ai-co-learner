# AI Co-Learner 개발 계획서
## 배치 분석 기반 학습 데이터 수집 및 역량 평가 시스템

---

## 📋 프로젝트 개요

### 목표
1. 채팅 데이터 30일 TTL 적용으로 DynamoDB 비용 80% 절감
2. 학습 분석 데이터 장기 보관 (1년)
3. 배치 방식으로 메시지 자동 분석 (5분마다)
4. 사용자 역량 수치화 및 대시보드 표시

### 최종 아키텍처
```
사용자 메시지
    ↓
chat-sessions 테이블 저장 (30일 TTL)
    ↓
즉시 응답 반환 (기존과 동일)
    ↓
[EventBridge: 5분마다]
    ↓
최근 5분 메시지 조회 (10-50개)
    ↓
Claude API 배치 분석 (1회 호출)
    ↓
learning-analytics 테이블 저장 (1년 TTL)
    ↓
[EventBridge: 1일 1회]
    ↓
역량 점수 집계 및 업데이트
    ↓
대시보드에 표시
```

---

## 🎯 개발 우선순위 및 단계

### Phase 1: 인프라 구축 (기반 작업)
데이터베이스 및 AWS 리소스 생성

### Phase 2: 채팅 데이터 정리
기존 시스템에 TTL 적용

### Phase 3: 분석 데이터 수집
배치 분석 시스템 구축

### Phase 4: 역량 계산 및 표시
집계 및 프론트엔드 연동

---

## ✅ 상세 개발 TODO 리스트

---

## **Phase 1: 인프라 구축** (예상 소요: 1일)

### 1.1 DynamoDB 테이블 생성

#### ✅ TODO 1-1: learning-analytics 테이블 생성
**파일**: AWS Console 또는 IaC (Terraform/CloudFormation)

**테이블 설정:**
```
테이블명: ai-co-learner-learning-analytics
파티션 키: userId (String)
정렬 키: timestamp (Number)
청구 모드: On-Demand (또는 Provisioned 1 RCU / 1 WCU)
```

**속성 정의:**
```javascript
{
  userId: "user-123",           // PK
  timestamp: 1732704000000,     // SK (Unix timestamp)
  sessionId: "bot-456",
  messageId: "bot-456-1732704000000",
  messageType: "question",      // question | answer | followup | casual
  userMessage: "Python이란?",
  aiMessage: "Python은...",
  analysisResult: {
    questionQuality: 85,
    thinkingDepth: 70,
    creativity: 90,
    communicationClarity: 75,
    executionOriented: 80,
    collaborationSignal: 65
  },
  category: "coding",           // coding | math | science | language | general
  reasoning: "명확한 질문...",
  expiresAt: 1764240000         // TTL (1년 후)
}
```

**검증 방법:**
```bash
aws dynamodb describe-table \
  --table-name ai-co-learner-learning-analytics \
  --region ap-northeast-2
```

---

#### ✅ TODO 1-2: user-competencies 테이블 생성

**테이블 설정:**
```
테이블명: ai-co-learner-user-competencies
파티션 키: userId (String)
정렬 키: competency (String)
청구 모드: On-Demand
```

**속성 정의:**
```javascript
{
  userId: "user-123",                    // PK
  competency: "questionQuality",         // SK
  score: 85,                             // 현재 점수 (0-100)
  historicalScores: [                    // 과거 점수 이력
    { timestamp: 1732704000000, score: 75 },
    { timestamp: 1732790400000, score: 78 },
    { timestamp: 1732876800000, score: 85 }
  ],
  updatedAt: 1732876800000,
  totalMessages: 156                     // 분석된 총 메시지 수
}
```

**6개 역량 타입:**
- questionQuality (질문력)
- thinkingDepth (사고력)
- creativity (창의력)
- communicationClarity (소통력)
- executionOriented (실행력)
- collaborationSignal (협업력)

---

#### ✅ TODO 1-3: TTL 설정

**learning-analytics 테이블 TTL:**
```bash
aws dynamodb update-time-to-live \
  --table-name ai-co-learner-learning-analytics \
  --time-to-live-specification "Enabled=true, AttributeName=expiresAt" \
  --region ap-northeast-2
```

**chat-sessions 테이블 TTL:**
```bash
aws dynamodb update-time-to-live \
  --table-name ai-co-learner-chat-sessions \
  --time-to-live-specification "Enabled=true, AttributeName=expiresAt" \
  --region ap-northeast-2
```

**검증:**
```bash
aws dynamodb describe-time-to-live \
  --table-name ai-co-learner-learning-analytics \
  --region ap-northeast-2
```

---

### 1.2 Lambda 함수 생성

#### ✅ TODO 1-4: message-batch-analyzer Lambda 생성

**파일 위치:** `lambda/message-batch-analyzer/index.mjs`

**함수 설정:**
```
함수명: ai-co-learner-message-batch-analyzer
런타임: Node.js 20.x
아키텍처: arm64 (Graviton2 - 20% 비용 절감)
메모리: 512 MB
타임아웃: 2분
환경 변수:
  - ANALYTICS_TABLE=ai-co-learner-learning-analytics
  - SESSIONS_TABLE=ai-co-learner-chat-sessions
  - MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
```

**IAM 역할 권한:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:ap-northeast-2:*:table/ai-co-learner-chat-sessions"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": "arn:aws:dynamodb:ap-northeast-2:*:table/ai-co-learner-learning-analytics"
    },
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

---

#### ✅ TODO 1-5: competency-aggregator Lambda 생성

**파일 위치:** `lambda/competency-aggregator/index.mjs`

**함수 설정:**
```
함수명: ai-co-learner-competency-aggregator
런타임: Node.js 20.x
아키텍처: arm64
메모리: 512 MB
타임아웃: 5분
환경 변수:
  - ANALYTICS_TABLE=ai-co-learner-learning-analytics
  - COMPETENCIES_TABLE=ai-co-learner-user-competencies
  - USERS_TABLE=ai-co-learner-users
```

**IAM 역할 권한:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:ap-northeast-2:*:table/ai-co-learner-learning-analytics",
        "arn:aws:dynamodb:ap-northeast-2:*:table/ai-co-learner-users"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": "arn:aws:dynamodb:ap-northeast-2:*:table/ai-co-learner-user-competencies"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

---

### 1.3 EventBridge 스케줄러 설정

#### ✅ TODO 1-6: 배치 분석 스케줄 생성 (5분마다)

**EventBridge Rule 설정:**
```
규칙명: ai-co-learner-batch-analysis-schedule
스케줄 표현식: rate(5 minutes)
타겟: Lambda (ai-co-learner-message-batch-analyzer)
상태: Enabled
```

**AWS CLI 명령:**
```bash
aws events put-rule \
  --name ai-co-learner-batch-analysis-schedule \
  --schedule-expression "rate(5 minutes)" \
  --region ap-northeast-2

aws lambda add-permission \
  --function-name ai-co-learner-message-batch-analyzer \
  --statement-id EventBridgeInvoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:ap-northeast-2:YOUR_ACCOUNT_ID:rule/ai-co-learner-batch-analysis-schedule \
  --region ap-northeast-2

aws events put-targets \
  --rule ai-co-learner-batch-analysis-schedule \
  --targets "Id"="1","Arn"="arn:aws:lambda:ap-northeast-2:YOUR_ACCOUNT_ID:function:ai-co-learner-message-batch-analyzer" \
  --region ap-northeast-2
```

---

#### ✅ TODO 1-7: 역량 집계 스케줄 생성 (1일 1회)

**EventBridge Rule 설정:**
```
규칙명: ai-co-learner-competency-aggregation-schedule
스케줄 표현식: cron(0 2 * * ? *)  # 매일 오전 2시 (KST 11시)
타겟: Lambda (ai-co-learner-competency-aggregator)
상태: Enabled
```

**AWS CLI 명령:**
```bash
aws events put-rule \
  --name ai-co-learner-competency-aggregation-schedule \
  --schedule-expression "cron(0 2 * * ? *)" \
  --region ap-northeast-2

aws lambda add-permission \
  --function-name ai-co-learner-competency-aggregator \
  --statement-id EventBridgeInvoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:ap-northeast-2:YOUR_ACCOUNT_ID:rule/ai-co-learner-competency-aggregation-schedule \
  --region ap-northeast-2

aws events put-targets \
  --rule ai-co-learner-competency-aggregation-schedule \
  --targets "Id"="1","Arn"="arn:aws:lambda:ap-northeast-2:YOUR_ACCOUNT_ID:function:ai-co-learner-competency-aggregator" \
  --region ap-northeast-2
```

---

## **Phase 2: 채팅 데이터 정리** (예상 소요: 2시간)

### 2.1 기존 Lambda 수정

#### ✅ TODO 2-1: chat-api Lambda에 TTL 필드 추가

**파일:** `lambda/chat-api/index.mjs`

**수정 위치:** `sendChatMessage` 함수 (233-244줄)

**변경 전:**
```javascript
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
```

**변경 후:**
```javascript
const TTL_30_DAYS = 30 * 24 * 60 * 60; // 30일 (초 단위)

await dynamoClient.send(new PutCommand({
  TableName: SESSIONS_TABLE,
  Item: {
    sessionId,
    timestamp,
    messageId,
    userId,
    userMessage: message,
    aiMessage: aiMessage,
    createdAt: new Date().toISOString(),
    expiresAt: Math.floor(Date.now() / 1000) + TTL_30_DAYS  // ✨ 추가
  }
}));
```

---

#### ✅ TODO 2-2: 기존 데이터 마이그레이션 (선택적)

**목적:** 이미 저장된 메시지에 `expiresAt` 추가

**마이그레이션 스크립트:** `scripts/add-ttl-to-existing-messages.mjs`

```javascript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "ap-northeast-2" })
);

const SESSIONS_TABLE = "ai-co-learner-chat-sessions";
const TTL_30_DAYS = 30 * 24 * 60 * 60;

async function addTTLToExistingMessages() {
  let lastEvaluatedKey = null;
  let updatedCount = 0;

  do {
    const scanParams = {
      TableName: SESSIONS_TABLE,
      Limit: 100,
      ExclusiveStartKey: lastEvaluatedKey
    };

    const result = await dynamoClient.send(new ScanCommand(scanParams));

    for (const item of result.Items || []) {
      if (!item.expiresAt) {
        const expiresAt = Math.floor(item.timestamp / 1000) + TTL_30_DAYS;

        await dynamoClient.send(new UpdateCommand({
          TableName: SESSIONS_TABLE,
          Key: {
            sessionId: item.sessionId,
            timestamp: item.timestamp
          },
          UpdateExpression: "SET expiresAt = :expiresAt",
          ExpressionAttributeValues: {
            ":expiresAt": expiresAt
          }
        }));

        updatedCount++;
        console.log(`Updated ${updatedCount}: ${item.messageId}`);
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`✅ Migration complete. Updated ${updatedCount} messages.`);
}

addTTLToExistingMessages().catch(console.error);
```

**실행 방법:**
```bash
cd lambda/chat-api
node scripts/add-ttl-to-existing-messages.mjs
```

---

#### ✅ TODO 2-3: 배포 및 테스트

**배포:**
```bash
cd lambda/chat-api
zip -r lambda.zip .
aws lambda update-function-code \
  --function-name ai-co-learner-chat \
  --zip-file fileb://lambda.zip \
  --region ap-northeast-2
```

**테스트:**
1. 프론트엔드에서 새 메시지 전송
2. DynamoDB에서 `expiresAt` 필드 확인:
```bash
aws dynamodb scan \
  --table-name ai-co-learner-chat-sessions \
  --limit 1 \
  --region ap-northeast-2
```

---

## **Phase 3: 배치 분석 시스템 구축** (예상 소요: 1-2일)

### 3.1 Lambda 함수 구현

#### ✅ TODO 3-1: message-batch-analyzer Lambda 코드 작성

**파일:** `lambda/message-batch-analyzer/index.mjs`

**전체 코드:**
```javascript
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });
const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "ap-northeast-2" })
);

const SESSIONS_TABLE = process.env.SESSIONS_TABLE || "ai-co-learner-chat-sessions";
const ANALYTICS_TABLE = process.env.ANALYTICS_TABLE || "ai-co-learner-learning-analytics";
const MODEL_ID = process.env.MODEL_ID || "anthropic.claude-3-haiku-20240307-v1:0";

const BATCH_SIZE = 30; // 한 번에 분석할 메시지 수
const LOOKBACK_MINUTES = 5; // 최근 5분간 메시지 조회

export const handler = async (event) => {
  console.log("🚀 Starting batch message analysis...");

  try {
    // 1. 최근 5분간 메시지 조회
    const recentMessages = await getRecentMessages();

    if (recentMessages.length === 0) {
      console.log("ℹ️ No recent messages to analyze");
      return { statusCode: 200, message: "No messages to analyze" };
    }

    console.log(`📊 Found ${recentMessages.length} messages to analyze`);

    // 2. 배치로 그룹화 (최대 30개씩)
    const batches = chunkArray(recentMessages, BATCH_SIZE);

    console.log(`📦 Created ${batches.length} batches`);

    // 3. 각 배치 분석
    let totalAnalyzed = 0;
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`🔍 Analyzing batch ${i + 1}/${batches.length} (${batch.length} messages)`);

      const analysisResults = await analyzeBatch(batch);
      await saveAnalysisResults(analysisResults);

      totalAnalyzed += analysisResults.length;
      console.log(`✅ Batch ${i + 1} complete: ${analysisResults.length} analyzed`);
    }

    console.log(`🎉 Batch analysis complete! Total analyzed: ${totalAnalyzed}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Batch analysis complete",
        totalAnalyzed,
        batches: batches.length
      })
    };

  } catch (error) {
    console.error("❌ Error in batch analysis:", error);
    throw error;
  }
};

// 최근 N분간 메시지 조회
async function getRecentMessages() {
  const now = Date.now();
  const lookbackTime = now - (LOOKBACK_MINUTES * 60 * 1000);

  console.log(`⏰ Querying messages from ${new Date(lookbackTime).toISOString()} to ${new Date(now).toISOString()}`);

  const result = await dynamoClient.send(new ScanCommand({
    TableName: SESSIONS_TABLE,
    FilterExpression: "#ts >= :lookbackTime AND attribute_not_exists(analyzed)",
    ExpressionAttributeNames: {
      "#ts": "timestamp"
    },
    ExpressionAttributeValues: {
      ":lookbackTime": lookbackTime
    }
  }));

  return result.Items || [];
}

// 배치 분석
async function analyzeBatch(messages) {
  const batchPrompt = buildBatchAnalysisPrompt(messages);

  console.log(`📤 Sending batch to Claude (${messages.length} messages)...`);

  const bedrockResponse = await bedrockClient.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 4000,
      temperature: 0.3,
      messages: [
        { role: "user", content: batchPrompt }
      ]
    })
  }));

  const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
  const analysisText = responseBody.content[0].text;

  console.log(`📥 Received analysis from Claude`);

  // JSON 배열 추출
  const jsonMatch = analysisText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error("Failed to extract JSON array from response:", analysisText.substring(0, 200));
    throw new Error("Failed to parse batch analysis response");
  }

  const analysisResults = JSON.parse(jsonMatch[0]);

  // 메시지 정보와 분석 결과 매핑
  return analysisResults.map((result, index) => ({
    ...messages[index],
    analysis: result
  }));
}

// 배치 분석 프롬프트 생성
function buildBatchAnalysisPrompt(messages) {
  const messagesList = messages.map((msg, index) =>
    `${index + 1}. [messageId: ${msg.messageId}] 사용자: "${msg.userMessage}" / AI: "${msg.aiMessage}"`
  ).join('\n');

  return `
당신은 학습 행동 분석 전문가입니다. 다음 ${messages.length}개의 대화를 분석하여 각각의 학습 역량을 평가해주세요.

대화 목록:
${messagesList}

각 대화에 대해 다음 6가지 역량을 0-100점으로 평가하고, JSON 배열로 응답하세요:

1. **질문 품질 (questionQuality)**: 질문이 명확하고 구체적이며 학습 의도가 분명한가?
2. **사고 깊이 (thinkingDepth)**: 깊이 있는 이해를 추구하고 논리적 사고가 보이는가?
3. **창의성 (creativity)**: 독창적이고 확장적인 사고를 하는가?
4. **소통 명확성 (communicationClarity)**: 자신의 생각을 명확하게 표현하는가?
5. **실행력 (executionOriented)**: 배운 내용을 실제로 적용하려는 의지가 보이는가?
6. **협업력 (collaborationSignal)**: 피드백을 수용하고 대화를 발전적으로 이어가는가?

추가 정보:
- **메시지 타입**: "question", "answer", "followup", "casual"
- **학습 카테고리**: "coding", "math", "science", "language", "general"

응답 형식 (JSON 배열만, 다른 텍스트 포함 금지):
[
  {
    "messageId": "bot-123-1234567890",
    "questionQuality": 85,
    "thinkingDepth": 70,
    "creativity": 90,
    "communicationClarity": 75,
    "executionOriented": 80,
    "collaborationSignal": 65,
    "messageType": "question",
    "category": "coding"
  },
  {
    "messageId": "bot-456-1234567891",
    "questionQuality": 60,
    "thinkingDepth": 50,
    "creativity": 55,
    "communicationClarity": 70,
    "executionOriented": 40,
    "collaborationSignal": 60,
    "messageType": "casual",
    "category": "general"
  }
]

중요: 반드시 위 형식의 JSON 배열로만 응답하세요. 설명이나 다른 텍스트는 포함하지 마세요.
`;
}

// 분석 결과 저장
async function saveAnalysisResults(results) {
  const TTL_1_YEAR = 365 * 24 * 60 * 60;

  // BatchWriteItem은 최대 25개 제한
  const chunks = chunkArray(results, 25);

  for (const chunk of chunks) {
    const putRequests = chunk.map(result => ({
      PutRequest: {
        Item: {
          userId: result.userId,
          timestamp: result.timestamp,
          sessionId: result.sessionId,
          messageId: result.messageId,
          messageType: result.analysis.messageType || "question",
          userMessage: result.userMessage,
          aiMessage: result.aiMessage,
          analysisResult: {
            questionQuality: result.analysis.questionQuality,
            thinkingDepth: result.analysis.thinkingDepth,
            creativity: result.analysis.creativity,
            communicationClarity: result.analysis.communicationClarity,
            executionOriented: result.analysis.executionOriented,
            collaborationSignal: result.analysis.collaborationSignal
          },
          category: result.analysis.category || "general",
          expiresAt: Math.floor(Date.now() / 1000) + TTL_1_YEAR
        }
      }
    }));

    await dynamoClient.send(new BatchWriteCommand({
      RequestItems: {
        [ANALYTICS_TABLE]: putRequests
      }
    }));
  }

  console.log(`💾 Saved ${results.length} analysis results to DynamoDB`);
}

// 배열을 청크로 나누기
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
```

---

#### ✅ TODO 3-2: package.json 생성

**파일:** `lambda/message-batch-analyzer/package.json`

```json
{
  "name": "message-batch-analyzer",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@aws-sdk/client-bedrock-runtime": "^3.600.0",
    "@aws-sdk/client-dynamodb": "^3.600.0",
    "@aws-sdk/lib-dynamodb": "^3.600.0"
  }
}
```

---

#### ✅ TODO 3-3: 의존성 설치 및 배포

**로컬에서 테스트:**
```bash
cd lambda/message-batch-analyzer
npm install
node --experimental-modules index.mjs  # 로컬 테스트용 (이벤트 모킹 필요)
```

**Lambda 배포:**
```bash
cd lambda/message-batch-analyzer
npm install --production
zip -r ../message-batch-analyzer.zip .
cd ..

aws lambda update-function-code \
  --function-name ai-co-learner-message-batch-analyzer \
  --zip-file fileb://message-batch-analyzer.zip \
  --region ap-northeast-2
```

---

#### ✅ TODO 3-4: 수동 테스트 실행

**Lambda 콘솔에서 테스트 이벤트 생성:**
```json
{
  "source": "aws.events",
  "detail-type": "Scheduled Event"
}
```

**또는 AWS CLI:**
```bash
aws lambda invoke \
  --function-name ai-co-learner-message-batch-analyzer \
  --payload '{}' \
  --region ap-northeast-2 \
  response.json

cat response.json
```

**검증:**
1. CloudWatch Logs 확인
2. DynamoDB learning-analytics 테이블에 데이터 확인:
```bash
aws dynamodb scan \
  --table-name ai-co-learner-learning-analytics \
  --limit 5 \
  --region ap-northeast-2
```

---

## **Phase 4: 역량 집계 및 대시보드 연동** (예상 소요: 1-2일)

### 4.1 역량 집계 Lambda 구현

#### ✅ TODO 4-1: competency-aggregator Lambda 코드 작성

**파일:** `lambda/competency-aggregator/index.mjs`

```javascript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, QueryCommand, PutCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "ap-northeast-2" })
);

const ANALYTICS_TABLE = process.env.ANALYTICS_TABLE || "ai-co-learner-learning-analytics";
const COMPETENCIES_TABLE = process.env.COMPETENCIES_TABLE || "ai-co-learner-user-competencies";
const USERS_TABLE = process.env.USERS_TABLE || "ai-co-learner-users";

const COMPETENCY_TYPES = [
  'questionQuality',
  'thinkingDepth',
  'creativity',
  'communicationClarity',
  'executionOriented',
  'collaborationSignal'
];

export const handler = async (event) => {
  console.log("🚀 Starting competency aggregation...");

  try {
    // 1. 모든 활성 사용자 조회
    const users = await getAllUsers();
    console.log(`👥 Found ${users.length} users`);

    let processedCount = 0;

    // 2. 각 사용자별 역량 계산
    for (const user of users) {
      await calculateUserCompetencies(user.userId);
      processedCount++;

      if (processedCount % 10 === 0) {
        console.log(`📊 Processed ${processedCount}/${users.length} users`);
      }
    }

    console.log(`🎉 Competency aggregation complete! Processed ${processedCount} users`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Competency aggregation complete",
        usersProcessed: processedCount
      })
    };

  } catch (error) {
    console.error("❌ Error in competency aggregation:", error);
    throw error;
  }
};

// 모든 사용자 조회
async function getAllUsers() {
  const result = await dynamoClient.send(new ScanCommand({
    TableName: USERS_TABLE,
    ProjectionExpression: "userId"
  }));

  return result.Items || [];
}

// 사용자 역량 계산
async function calculateUserCompetencies(userId) {
  console.log(`🧮 Calculating competencies for user: ${userId}`);

  // 최근 30일 데이터 조회
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

  const result = await dynamoClient.send(new QueryCommand({
    TableName: ANALYTICS_TABLE,
    KeyConditionExpression: "userId = :userId AND #ts >= :thirtyDaysAgo",
    ExpressionAttributeNames: {
      "#ts": "timestamp"
    },
    ExpressionAttributeValues: {
      ":userId": userId,
      ":thirtyDaysAgo": thirtyDaysAgo
    }
  }));

  const analyticsData = result.Items || [];

  if (analyticsData.length === 0) {
    console.log(`ℹ️ No analytics data for user ${userId}`);
    return;
  }

  console.log(`📈 Found ${analyticsData.length} analytics records for user ${userId}`);

  // 각 역량별 점수 계산
  const competencyScores = {};

  for (const competency of COMPETENCY_TYPES) {
    const score = calculateWeightedScore(analyticsData, competency);
    competencyScores[competency] = score;
  }

  // DynamoDB에 저장
  await saveCompetencies(userId, competencyScores, analyticsData.length);

  console.log(`✅ Saved competencies for user ${userId}:`, competencyScores);
}

// 가중 평균 계산
function calculateWeightedScore(data, competency) {
  const now = Date.now();

  // 최근 데이터에 더 높은 가중치
  const weights = data.map(item => {
    const daysAgo = (now - item.timestamp) / (1000 * 60 * 60 * 24);

    if (daysAgo <= 7) return 0.5;       // 최근 7일: 50% 가중치
    if (daysAgo <= 14) return 0.3;      // 8-14일: 30% 가중치
    return 0.2;                         // 15-30일: 20% 가중치
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const weightedSum = data.reduce((sum, item, index) => {
    const score = item.analysisResult?.[competency] || 0;
    return sum + (score * weights[index]);
  }, 0);

  return Math.round(weightedSum / totalWeight);
}

// 역량 점수 저장
async function saveCompetencies(userId, scores, totalMessages) {
  const timestamp = Date.now();

  const putRequests = COMPETENCY_TYPES.map(competency => ({
    PutRequest: {
      Item: {
        userId,
        competency,
        score: scores[competency],
        historicalScores: [
          { timestamp, score: scores[competency] }
        ],
        updatedAt: timestamp,
        totalMessages
      }
    }
  }));

  // BatchWriteItem (최대 25개)
  await dynamoClient.send(new BatchWriteCommand({
    RequestItems: {
      [COMPETENCIES_TABLE]: putRequests
    }
  }));
}
```

---

#### ✅ TODO 4-2: package.json 및 배포

**파일:** `lambda/competency-aggregator/package.json`

```json
{
  "name": "competency-aggregator",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.600.0",
    "@aws-sdk/lib-dynamodb": "^3.600.0"
  }
}
```

**배포:**
```bash
cd lambda/competency-aggregator
npm install --production
zip -r ../competency-aggregator.zip .
cd ..

aws lambda update-function-code \
  --function-name ai-co-learner-competency-aggregator \
  --zip-file fileb://competency-aggregator.zip \
  --region ap-northeast-2
```

---

#### ✅ TODO 4-3: 수동 테스트

```bash
aws lambda invoke \
  --function-name ai-co-learner-competency-aggregator \
  --payload '{}' \
  --region ap-northeast-2 \
  response.json

cat response.json
```

**검증:**
```bash
aws dynamodb scan \
  --table-name ai-co-learner-user-competencies \
  --limit 10 \
  --region ap-northeast-2
```

---

### 4.2 API 엔드포인트 추가

#### ✅ TODO 4-4: chat-api Lambda에 역량 조회 API 추가

**파일:** `lambda/chat-api/index.mjs`

**라우팅 추가 (40-113줄 근처):**
```javascript
// GET /users/{userId}/competencies - 사용자 역량 조회
if (method === 'GET' && path.includes('/users/') && path.includes('/competencies')) {
  return await getUserCompetencies(event, headers);
}
```

**함수 추가 (파일 끝):**
```javascript
// 사용자 역량 조회
async function getUserCompetencies(event, headers) {
  const userId = event.pathParameters?.userId || event.path.split('/')[2];

  const COMPETENCIES_TABLE = "ai-co-learner-user-competencies";

  try {
    const result = await dynamoClient.send(new QueryCommand({
      TableName: COMPETENCIES_TABLE,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId
      }
    }));

    const competencies = (result.Items || []).map(item => ({
      name: item.competency,
      score: item.score,
      updatedAt: item.updatedAt,
      totalMessages: item.totalMessages,
      trend: calculateTrend(item.historicalScores)
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        userId,
        competencies,
        lastUpdated: competencies[0]?.updatedAt || Date.now()
      })
    };

  } catch (error) {
    console.error("Error fetching competencies:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

// 추세 계산 (최근 2개 점수 비교)
function calculateTrend(historicalScores) {
  if (!historicalScores || historicalScores.length < 2) {
    return 0;
  }

  const sorted = [...historicalScores].sort((a, b) => b.timestamp - a.timestamp);
  const latest = sorted[0].score;
  const previous = sorted[1].score;

  return latest - previous;
}
```

---

#### ✅ TODO 4-5: API Gateway 라우트 추가

**AWS Console에서:**
1. API Gateway 콘솔 열기
2. `ai-co-learner-api` 선택
3. 리소스 `/users/{userId}` 선택
4. "리소스 생성" → `/competencies` 추가
5. GET 메서드 생성 → Lambda `ai-co-learner-chat` 연결
6. CORS 활성화
7. API 배포

**또는 AWS CLI:**
```bash
# 리소스 ID 확인 필요
aws apigateway get-resources \
  --rest-api-id YOUR_API_ID \
  --region ap-northeast-2
```

---

### 4.3 프론트엔드 연동

#### ✅ TODO 4-6: 역량 데이터 API 연동

**파일:** `services/awsBackend.ts`

**추가:**
```typescript
export const UserService = {
  // 기존 함수들...

  // 사용자 역량 조회
  getCompetencies: async (userId: string): Promise<UserCompetencies> => {
    const token = await getAuthToken();

    const restOperation = get({
      apiName: API_NAME,
      path: `/users/${userId}/competencies`,
      options: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { body } = await restOperation.response;
    const data = await body.json();

    return data as UserCompetencies;
  },
};
```

**타입 정의 추가:**
```typescript
export interface Competency {
  name: string;
  score: number;
  updatedAt: number;
  totalMessages: number;
  trend: number;
}

export interface UserCompetencies {
  userId: string;
  competencies: Competency[];
  lastUpdated: number;
}
```

---

#### ✅ TODO 4-7: 대시보드 컴포넌트 수정

**파일:** `components/dashboard/CompetencyRadar.tsx`

**변경 전 (하드코딩):**
```typescript
const data: CompetencyData[] = [
  { subject: '질문력', A: 85, fullMark: 100 },
  { subject: '사고력', A: 65, fullMark: 100 },
  // ...
];
```

**변경 후 (실제 데이터):**
```typescript
import { useEffect, useState } from 'react';
import { UserService } from '@/services/awsBackend';

interface CompetencyRadarProps {
  userId: string;
}

export default function CompetencyRadar({ userId }: CompetencyRadarProps) {
  const [data, setData] = useState<CompetencyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompetencies();
  }, [userId]);

  const loadCompetencies = async () => {
    try {
      const result = await UserService.getCompetencies(userId);

      const competencyMap: Record<string, string> = {
        questionQuality: '질문력',
        thinkingDepth: '사고력',
        creativity: '창의력',
        communicationClarity: '소통력',
        executionOriented: '실행력',
        collaborationSignal: '협업력',
      };

      const chartData = result.competencies.map(c => ({
        subject: competencyMap[c.name] || c.name,
        A: c.score,
        fullMark: 100
      }));

      setData(chartData);
    } catch (error) {
      console.error('Failed to load competencies:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>로딩 중...</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        {/* 기존 차트 코드 */}
      </RadarChart>
    </ResponsiveContainer>
  );
}
```

---

#### ✅ TODO 4-8: Dashboard 페이지 수정

**파일:** `pages/Dashboard.tsx`

**수정:**
```typescript
// userId 전달
<CompetencyRadar userId={user?.userId || ''} />
```

---

#### ✅ TODO 4-9: 프론트엔드 배포

```bash
npm run build
aws s3 sync dist s3://ai-co-learner-frontend-synnex --region ap-northeast-2 --delete
```

---

## **Phase 5: 테스트 및 모니터링** (예상 소요: 1일)

### 5.1 통합 테스트

#### ✅ TODO 5-1: 엔드투엔드 테스트

**테스트 시나리오:**
```
1. 프론트엔드에서 새 메시지 5개 전송
2. 5분 대기
3. CloudWatch Logs에서 batch-analyzer 실행 확인
4. DynamoDB learning-analytics 테이블 확인
5. 1일 대기 (또는 수동 실행)
6. competency-aggregator 실행
7. DynamoDB user-competencies 테이블 확인
8. 프론트엔드 대시보드에서 역량 차트 확인
```

**수동 테스트 스크립트:** `scripts/end-to-end-test.sh`
```bash
#!/bin/bash

echo "🧪 Starting end-to-end test..."

# 1. 배치 분석 수동 실행
echo "1️⃣ Running batch analyzer..."
aws lambda invoke \
  --function-name ai-co-learner-message-batch-analyzer \
  --region ap-northeast-2 \
  batch-response.json

cat batch-response.json
echo ""

# 2. 분석 결과 확인
echo "2️⃣ Checking analytics data..."
aws dynamodb scan \
  --table-name ai-co-learner-learning-analytics \
  --limit 3 \
  --region ap-northeast-2

# 3. 역량 집계 수동 실행
echo "3️⃣ Running competency aggregator..."
aws lambda invoke \
  --function-name ai-co-learner-competency-aggregator \
  --region ap-northeast-2 \
  competency-response.json

cat competency-response.json
echo ""

# 4. 역량 데이터 확인
echo "4️⃣ Checking competency data..."
aws dynamodb scan \
  --table-name ai-co-learner-user-competencies \
  --limit 6 \
  --region ap-northeast-2

echo "✅ End-to-end test complete!"
```

---

#### ✅ TODO 5-2: CloudWatch 대시보드 생성

**메트릭 추가:**
```
- Lambda batch-analyzer:
  - Invocations
  - Errors
  - Duration
  - Throttles

- Lambda competency-aggregator:
  - Invocations
  - Errors
  - Duration

- DynamoDB:
  - ConsumedReadCapacityUnits
  - ConsumedWriteCapacityUnits
  - UserErrors
```

---

#### ✅ TODO 5-3: CloudWatch 알람 설정

**알람 1: 배치 분석 실패**
```
이름: BatchAnalyzerErrors
메트릭: Lambda Errors
임계값: 1 (5분 내)
알림: SNS 토픽 또는 이메일
```

**알람 2: DynamoDB 쓰기 제한**
```
이름: DynamoDBThrottling
메트릭: UserErrors
임계값: 10 (5분 내)
```

---

### 5.2 성능 최적화

#### ✅ TODO 5-4: Lambda 메모리 최적화

**테스트:**
```bash
# 512MB, 1024MB, 2048MB 각각 테스트
aws lambda update-function-configuration \
  --function-name ai-co-learner-message-batch-analyzer \
  --memory-size 1024 \
  --region ap-northeast-2

# 실행 시간 및 비용 비교
```

---

#### ✅ TODO 5-5: 배치 크기 최적화

**실험:**
- 배치 크기: 10, 20, 30, 50
- Claude API 응답 시간 측정
- 정확도 비교

**최적값 선정 후 환경 변수 업데이트**

---

## **Phase 6: 문서화 및 운영** (예상 소요: 반나절)

#### ✅ TODO 6-1: 운영 가이드 작성

**파일:** `docs/operations-guide.md`

**내용:**
- 배포 절차
- 모니터링 방법
- 트러블슈팅 가이드
- 비용 최적화 팁

---

#### ✅ TODO 6-2: API 문서 업데이트

**파일:** `docs/api-reference.md`

**추가 엔드포인트:**
```
GET /users/{userId}/competencies
Response:
{
  "userId": "string",
  "competencies": [
    {
      "name": "questionQuality",
      "score": 85,
      "trend": 5,
      "updatedAt": 1732704000000,
      "totalMessages": 120
    }
  ],
  "lastUpdated": 1732704000000
}
```

---

#### ✅ TODO 6-3: 팀 온보딩 자료

**파일:** `docs/onboarding.md`

**내용:**
- 시스템 아키텍처 설명
- 개발 환경 설정
- 로컬 테스트 방법
- 배포 프로세스

---

## 📊 전체 타임라인

| Phase | 작업 내용 | 예상 소요 | 의존성 |
|-------|---------|---------|--------|
| **Phase 1** | 인프라 구축 | 1일 | - |
| **Phase 2** | 채팅 데이터 정리 | 2시간 | Phase 1 |
| **Phase 3** | 배치 분석 시스템 | 1-2일 | Phase 1, 2 |
| **Phase 4** | 역량 집계 및 대시보드 | 1-2일 | Phase 3 |
| **Phase 5** | 테스트 및 모니터링 | 1일 | Phase 4 |
| **Phase 6** | 문서화 및 운영 | 반나절 | Phase 5 |
| **총계** | | **5-7일** | |

---

## 🎯 우선순위 체크리스트

### 🔴 Critical (즉시 시작)
- [x] TODO 1-1: learning-analytics 테이블 생성 ✅ 완료 (2025-11-27)
- [x] TODO 1-2: user-competencies 테이블 생성 ✅ 완료 (2025-11-27)
- [x] TODO 1-3: TTL 설정 ✅ 완료 (2025-11-27)
- [x] TODO 2-1: chat-api Lambda TTL 필드 추가 ✅ 완료 (2025-11-27)

### 🟡 High (1주일 내)
- [x] TODO 1-4: message-batch-analyzer Lambda 생성 ✅ 완료 (2025-11-27)
- [x] TODO 1-6: 배치 분석 스케줄 생성 ✅ 완료 (2025-11-27)
- [x] TODO 3-1: batch-analyzer 코드 작성 ✅ 완료 (2025-11-27)
- [x] TODO 3-4: 수동 테스트 ✅ 완료 (2025-11-27)

### 🟢 Medium (2주일 내)
- [x] TODO 1-5: competency-aggregator Lambda 생성 ✅ 완료 (2025-11-27)
- [x] TODO 4-1: aggregator 코드 작성 ✅ 완료 (2025-11-27)
- [x] TODO 4-4: 역량 조회 API 추가 ✅ 완료 (2025-11-27)
- [x] TODO 4-7: 대시보드 연동 ✅ 완료 (2025-11-27)

### 🔵 Low (여유 있을 때)
- [ ] TODO 5-2: CloudWatch 대시보드
- [ ] TODO 5-3: CloudWatch 알람
- [ ] TODO 6-1: 운영 가이드 작성

---

## 💰 예상 비용 (월 10만 메시지 기준)

| 서비스 | 항목 | 비용 |
|--------|------|------|
| **DynamoDB** | learning-analytics 저장 (1GB) | $0.25 |
| | user-competencies 저장 (0.1GB) | $0.03 |
| | chat-sessions 저장 (0.5GB) | $0.13 |
| | 읽기/쓰기 요청 | $1.00 |
| **Lambda** | batch-analyzer (8,640회/월) | $0.50 |
| | competency-aggregator (30회/월) | $0.01 |
| **Claude API** | 배치 분석 (8,640회) | $26.00 |
| **EventBridge** | 스케줄러 | 무료 |
| **총계** | | **~$28/월** |

**절감 효과:**
- 실시간 분석 대비: $45 → $26 (42% 절감)
- 채팅 저장 비용: 80% 절감 (TTL 적용)

---

## 🚀 빠른 시작 가이드

```bash
# 1. 저장소 클론
git clone <repo-url>
cd ai-co-learner

# 2. Phase 1 시작
# AWS Console에서 DynamoDB 테이블 생성
# 또는 Terraform 사용

# 3. Lambda 함수 배포
cd lambda/message-batch-analyzer
npm install
zip -r ../message-batch-analyzer.zip .
aws lambda create-function ...

# 4. 테스트
bash scripts/end-to-end-test.sh

# 5. 프론트엔드 배포
npm run build
aws s3 sync dist s3://...
```

---

## 📞 문제 발생 시

### 분석이 실행되지 않는 경우
1. EventBridge 규칙 활성화 확인
2. Lambda 권한 확인 (DynamoDB, Bedrock)
3. CloudWatch Logs 확인

### 역량 점수가 표시되지 않는 경우
1. competency-aggregator 실행 확인
2. API 엔드포인트 테스트
3. 프론트엔드 네트워크 탭 확인

---

**작성일**: 2025-11-27
**버전**: 1.0
**상태**: 개발 준비 완료 ✅
