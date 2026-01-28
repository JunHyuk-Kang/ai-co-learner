// Gemini imports
import { GoogleGenerativeAI } from "@google/generative-ai";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand, UpdateCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

// Google Gemini 클라이언트
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "ap-northeast-2" })
);

const SESSIONS_TABLE = process.env.SESSIONS_TABLE || "ai-co-learner-chat-sessions";
const ANALYTICS_TABLE = process.env.ANALYTICS_TABLE || "ai-co-learner-learning-analytics";
const MODEL_ID = "gemini-2.5-flash";

const BATCH_SIZE = 30; // 한 번에 분석할 메시지 수
const LOOKBACK_MINUTES = 10; // 최근 10분간 메시지 조회 (5분 스케줄 + 여유분)
const USAGE_TRACKING_TABLE = process.env.USAGE_TRACKING_TABLE || "ai-co-learner-usage-tracking";

// Exponential Backoff 재시도 설정
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000,  // 1초
  maxDelay: 10000,     // 10초
  backoffMultiplier: 2
};

// Exponential Backoff 재시도 헬퍼 함수
async function retryWithBackoff(fn, retries = RETRY_CONFIG.maxRetries) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 재시도 가능한 에러인지 확인
      const isRetryable =
        error.message?.includes('quota') ||
        error.message?.includes('limit') ||
        error.message?.includes('RESOURCE_EXHAUSTED') ||
        error.status === 429 ||
        error.status === 503;

      // 재시도 불가능한 에러이거나 마지막 시도인 경우
      if (!isRetryable || attempt === retries) {
        throw error;
      }

      // Exponential backoff 계산
      const delay = Math.min(
        RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt),
        RETRY_CONFIG.maxDelay
      );

      console.log(`Retry attempt ${attempt + 1}/${retries} after ${delay}ms delay. Error: ${error.message}`);

      // 대기
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

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

  console.log(`📤 Sending batch to Gemini (${messages.length} messages)...`);

  let inputTokens = 0;
  let outputTokens = 0;

  const analysisResults = await retryWithBackoff(async () => {
    const model = genAI.getGenerativeModel({
      model: MODEL_ID,
      generationConfig: {
        maxOutputTokens: 4000,
        temperature: 0.3
      }
    });

    const result = await model.generateContent(batchPrompt);
    const response = await result.response;
    const analysisText = response.text();

    // 토큰 사용량 수집
    if (response.usageMetadata) {
      inputTokens = response.usageMetadata.promptTokenCount || 0;
      outputTokens = response.usageMetadata.candidatesTokenCount || 0;
      console.log(`📊 Token usage: ${inputTokens} input, ${outputTokens} output`);
    }

    console.log(`📥 Received analysis from Gemini`);

    // JSON 배열 추출
    const jsonMatch = analysisText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("Failed to extract JSON array from response:", analysisText.substring(0, 200));
      throw new Error("Failed to parse batch analysis response");
    }

    return JSON.parse(jsonMatch[0]);
  });

  // 사용량 추적
  if (inputTokens > 0 || outputTokens > 0) {
    await trackUsage(inputTokens, outputTokens, messages.length);
  }

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
    // learning-analytics 테이블에 저장 (BatchWrite 사용)
    const analyticsRequests = chunk.map(result => ({
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
        [ANALYTICS_TABLE]: analyticsRequests
      }
    }));

    // chat-sessions 테이블에 analyzed 플래그 설정 (UpdateCommand 사용)
    // BatchWrite의 PutRequest는 전체 아이템을 교체하므로, 기존 데이터가 손실될 수 있음
    // UpdateCommand를 사용하여 analyzed 플래그만 추가
    for (const result of chunk) {
      await dynamoClient.send(new UpdateCommand({
        TableName: SESSIONS_TABLE,
        Key: {
          sessionId: result.sessionId,
          timestamp: result.timestamp
        },
        UpdateExpression: "SET analyzed = :analyzed, analysisTimestamp = :analysisTimestamp",
        ExpressionAttributeValues: {
          ":analyzed": true,
          ":analysisTimestamp": Date.now()
        }
      }));
    }
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

// 사용량 추적 함수
async function trackUsage(inputTokens, outputTokens, batchSize) {
  // Gemini 2.5 Flash 가격 (2026년 1월 기준)
  const PRICING = {
    inputPer1M: 0.30,  // $0.30 per 1M input tokens
    outputPer1M: 2.50  // $2.50 per 1M output tokens
  };

  const estimatedCost =
    (inputTokens / 1_000_000) * PRICING.inputPer1M +
    (outputTokens / 1_000_000) * PRICING.outputPer1M;

  const timestamp = Date.now();
  const date = new Date().toISOString().split('T')[0];

  try {
    await dynamoClient.send(new PutCommand({
      TableName: USAGE_TRACKING_TABLE,
      Item: {
        userId: "SYSTEM_BATCH_ANALYZER",  // 시스템 사용량으로 기록
        timestamp,
        messageId: `batch-analyzer-${timestamp}`,
        sessionId: `batch-${date}`,
        date,
        service: "gemini",
        modelId: MODEL_ID,
        operation: "batch-analysis",
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedCost,
        batchSize,  // 분석한 메시지 수
        createdAt: new Date().toISOString()
      }
    }));
    console.log(`📊 Usage tracked: ${inputTokens} input + ${outputTokens} output tokens, cost: $${estimatedCost.toFixed(4)}`);
  } catch (error) {
    console.error("⚠️ Failed to track usage:", error.message);
    // 사용량 추적 실패해도 메인 로직은 계속 진행
  }
}
