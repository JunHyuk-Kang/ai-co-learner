import { GetCommand, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "./clients.mjs";
import { TABLES, RETRY_CONFIG, PRICING, MODEL_ID } from "./config.mjs";

// Exponential Backoff 재시도 헬퍼 함수
export async function retryWithBackoff(fn, retries = RETRY_CONFIG.maxRetries) {
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

// 권한 체크 헬퍼 함수
export async function checkUserRole(userId, allowedRoles) {
  try {
    const result = await dynamoClient.send(new GetCommand({
      TableName: TABLES.USERS,
      Key: { userId }
    }));

    if (!result.Item) {
      return { authorized: false, error: "User not found" };
    }

    const userRole = result.Item.role || 'USER';
    if (!allowedRoles.includes(userRole)) {
      return { authorized: false, error: `Access denied. Required role: ${allowedRoles.join(' or ')}` };
    }

    return { authorized: true, role: userRole };
  } catch (error) {
    console.error("Error checking user role:", error);
    return { authorized: false, error: "Failed to verify user role" };
  }
}

// 조직별 템플릿 조회 헬퍼 (GLOBAL + 해당 조직 템플릿 반환)
export async function getTemplatesByOrganization(userOrganization) {
  const globalResult = await dynamoClient.send(new QueryCommand({
    TableName: TABLES.TEMPLATES,
    IndexName: 'organizationId-templateId-index',
    KeyConditionExpression: 'organizationId = :orgId',
    ExpressionAttributeValues: { ':orgId': 'GLOBAL' }
  }));

  let orgResult = { Items: [] };
  if (userOrganization && userOrganization !== '' && userOrganization !== '(미지정)') {
    orgResult = await dynamoClient.send(new QueryCommand({
      TableName: TABLES.TEMPLATES,
      IndexName: 'organizationId-templateId-index',
      KeyConditionExpression: 'organizationId = :orgId',
      ExpressionAttributeValues: { ':orgId': userOrganization }
    }));
  }

  return [...(globalResult.Items || []), ...(orgResult.Items || [])];
}

export function buildGeminiMessages(userMessage, conversationHistory) {
  const messages = [];

  // 대화 히스토리 추가
  conversationHistory.forEach(item => {
    messages.push({ role: "user", content: item.user });
    messages.push({ role: "assistant", content: item.assistant });
  });

  // 현재 사용자 메시지 추가
  messages.push({ role: "user", content: userMessage });

  return messages;
}

export async function trackUsage(userId, sessionId, inputTokens, outputTokens, modelId = MODEL_ID) {
  const totalTokens = inputTokens + outputTokens;
  const pricing = PRICING[modelId] || PRICING[MODEL_ID];

  const inputCost = (inputTokens / 1000000) * pricing.input;
  const outputCost = (outputTokens / 1000000) * pricing.output;
  const estimatedCost = inputCost + outputCost;

  const timestamp = Date.now();

  try {
    await dynamoClient.send(new PutCommand({
      TableName: TABLES.USAGE_TRACKING,
      Item: {
        userId,
        timestamp,
        sessionId,
        messageId: `${sessionId}-${timestamp}`,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost: parseFloat(estimatedCost.toFixed(6)),
        service: 'gemini',
        operation: 'chat',
        modelId,
        date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        createdAt: new Date().toISOString()
      }
    }));

    console.log(`✅ Usage tracked: ${userId} | ${totalTokens} tokens | $${estimatedCost.toFixed(6)}`);
  } catch (error) {
    console.error('❌ Failed to track usage:', error);
    // 사용량 추적 실패는 메인 로직에 영향을 주지 않도록 에러를 던지지 않음
  }
}
