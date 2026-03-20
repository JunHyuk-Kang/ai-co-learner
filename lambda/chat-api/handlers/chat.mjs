import { ScanCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient, genAI } from "../lib/clients.mjs";
import { TABLES, SAFETY_SETTINGS, SYSTEM_PROMPT_PROTECTION, MODEL_ID } from "../lib/config.mjs";
import { retryWithBackoff, trackUsage } from "../lib/utils.mjs";

export async function getSession(event, headers) {
  const sessionId = event.pathParameters?.sessionId || event.path.split('/').pop();

  const response = await dynamoClient.send(new QueryCommand({
    TableName: TABLES.SESSIONS,
    KeyConditionExpression: "sessionId = :sessionId",
    ExpressionAttributeValues: {
      ":sessionId": sessionId
    },
    ScanIndexForward: true // 오래된 순서
  }));

  // 템플릿 openingMessage 조회
  let openingText = null;
  try {
    const userBotsResponse = await dynamoClient.send(new ScanCommand({
      TableName: TABLES.USER_BOTS,
      FilterExpression: "botId = :botId",
      ExpressionAttributeValues: { ":botId": sessionId }
    }));
    const userBot = userBotsResponse.Items?.[0];
    if (userBot?.templateId) {
      const templateResponse = await dynamoClient.send(new GetCommand({
        TableName: TABLES.TEMPLATES,
        Key: { templateId: userBot.templateId }
      }));
      if (templateResponse.Item?.openingMessage) {
        openingText = templateResponse.Item.openingMessage;
      }
    }
  } catch (_e) {
    // openingText remains null — fallback below
  }

  const fallbackText = '안녕하세요! 무엇을 도와드릴까요?';

  // 새 세션 (대화 기록 없음): openingMessage만 반환
  if (!response.Items || response.Items.length === 0) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        id: sessionId,
        botId: sessionId,
        userId: 'unknown',
        messages: [{
          id: `${sessionId}-init`,
          sender: 'ai',
          text: openingText || fallbackText,
          timestamp: Date.now()
        }]
      })
    };
  }

  const messages = response.Items.flatMap((item, index) => {
    const msgs = [];
    if (index === 0) {
      msgs.push({
        id: `${sessionId}-init`,
        sender: 'ai',
        text: openingText || fallbackText,
        timestamp: item.timestamp - 1000
      });
    }
    msgs.push({
      id: `${item.messageId}-user`,
      sender: 'user',
      text: item.userMessage,
      timestamp: item.timestamp
    });
    msgs.push({
      id: item.messageId,
      sender: 'ai',
      text: item.aiMessage,
      timestamp: item.timestamp + 100
    });
    return msgs;
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      id: sessionId,
      botId: sessionId,
      userId: response.Items[0]?.userId || 'unknown',
      messages
    })
  };
}

export async function sendChatMessage(event, headers) {
  const body = JSON.parse(event.body || "{}");
  const { userId, sessionId, message } = body;

  // 입력 검증
  if (!userId || !sessionId || !message) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: "Missing required fields: userId, sessionId, message"
      })
    };
  }

  // 1. 모든 템플릿을 캐시에 로드 (한 번만 조회)
  const allTemplates = await dynamoClient.send(new ScanCommand({
    TableName: TABLES.TEMPLATES
  }));

  const templateMap = {};
  (allTemplates.Items || []).forEach(t => {
    templateMap[t.templateId] = t.systemPrompt;
  });

  // 2. sessionId(botId)로 user bot 조회
  const allUserBots = await dynamoClient.send(new ScanCommand({
    TableName: TABLES.USER_BOTS,
    FilterExpression: "userId = :userId",
    ExpressionAttributeValues: {
      ":userId": userId
    }
  }));

  const userBot = (allUserBots.Items || []).find(bot => bot.botId === sessionId);

  if (!userBot || !userBot.templateId) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: "Bot not found" })
    };
  }

  const systemPrompt = templateMap[userBot.templateId];

  if (!systemPrompt) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: "Template not found for this bot" })
    };
  }

  console.log("✅ Using template:", userBot.templateId, "prompt:", systemPrompt?.substring(0, 50));

  // 3. DynamoDB에서 대화 히스토리 조회 (최근 10개)
  const historyResponse = await dynamoClient.send(new QueryCommand({
    TableName: TABLES.SESSIONS,
    KeyConditionExpression: "sessionId = :sessionId",
    ExpressionAttributeValues: {
      ":sessionId": sessionId
    },
    Limit: 10,
    ScanIndexForward: false // 최신순 정렬
  }));

  // 4. 대화 히스토리 포맷팅
  const conversationHistory = (historyResponse.Items || [])
    .reverse() // 오래된 순서로 변경
    .map(item => ({
      user: item.userMessage,
      assistant: item.aiMessage
    }));

  // 5. Gemini용 대화 히스토리 구성
  const geminiHistory = conversationHistory.flatMap(item => [
    { role: "user", parts: [{ text: item.user }] },
    { role: "model", parts: [{ text: item.assistant }] }
  ]);

  console.log("Sending to Gemini:", message.substring(0, 100) + "...");
  console.log("System Prompt:", systemPrompt.substring(0, 100) + "...");

  // 6. Gemini 호출 (시스템 프롬프트 + 보호 문구 적용)
  const protectedSystemPrompt = SYSTEM_PROMPT_PROTECTION + systemPrompt;
  const model = genAI.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: protectedSystemPrompt,  // 보호 문구 + 봇 템플릿 시스템 프롬프트
    safetySettings: SAFETY_SETTINGS,  // Safety filter 완화
  });

  const chat = model.startChat({
    history: geminiHistory,
    generationConfig: {
      maxOutputTokens: 2000,
      temperature: 0.7,
    },
  });

  const result = await chat.sendMessage(message);

  // 7. Gemini 응답 파싱
  const aiMessage = result.response.text();

  console.log("Gemini response:", aiMessage);

  // 7-1. 사용량 추적 (토큰 사용량)
  const inputTokens = result.response.usageMetadata?.promptTokenCount || 0;
  const outputTokens = result.response.usageMetadata?.candidatesTokenCount || 0;
  await trackUsage(userId, sessionId, inputTokens, outputTokens, MODEL_ID);

  // 8. DynamoDB에 메시지 저장
  const timestamp = Date.now();
  const messageId = `${sessionId}-${timestamp}`;
  const TTL_30_DAYS = 30 * 24 * 60 * 60; // 30일 (초 단위)

  await dynamoClient.send(new PutCommand({
    TableName: TABLES.SESSIONS,
    Item: {
      sessionId,
      timestamp,
      messageId,
      userId,
      userMessage: message,
      aiMessage: aiMessage,
      createdAt: new Date().toISOString(),
      expiresAt: Math.floor(Date.now() / 1000) + TTL_30_DAYS
    }
  }));

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

export async function sendChatMessageStream(event, headers) {
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (parseError) {
    console.error("Failed to parse request body:", parseError);
    return {
      statusCode: 400,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: "Invalid JSON in request body"
      })
    };
  }

  const { userId, sessionId, message } = body;

  // 입력 검증 - 더 자세한 로깅
  console.log("Stream request received:", { userId, sessionId, messageLength: message?.length });

  if (!userId || !sessionId || !message) {
    console.error("Missing required fields:", {
      hasUserId: !!userId,
      hasSessionId: !!sessionId,
      hasMessage: !!message,
      body: JSON.stringify(body)
    });
    return {
      statusCode: 400,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: "Missing required fields: userId, sessionId, message",
        received: {
          hasUserId: !!userId,
          hasSessionId: !!sessionId,
          hasMessage: !!message
        }
      })
    };
  }

  try {
    // 0. 사용자 정보 조회 및 구독 체크
    const userResponse = await dynamoClient.send(new GetCommand({
      TableName: TABLES.USERS,
      Key: { userId }
    }));

    if (!userResponse.Item) {
      return {
        statusCode: 404,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: "User not found" })
      };
    }

    const user = userResponse.Item;

    // 구독 티어 확인 (없으면 기본값 UNLIMITED - 기존 사용자)
    const subscriptionTier = user.subscriptionTier || 'UNLIMITED';
    const messageQuota = user.messageQuota || { monthlyLimit: -1, currentMonthUsage: 0 };
    const trialPeriod = user.trialPeriod;

    console.log("User subscription check:", {
      userId,
      tier: subscriptionTier,
      quota: messageQuota
    });

    // TRIAL 티어: 체험 기간 만료 체크
    if (subscriptionTier === 'TRIAL' && trialPeriod) {
      const now = new Date();
      const endDate = new Date(trialPeriod.endDate);

      if (now > endDate) {
        console.warn("Trial expired for user:", userId);
        return {
          statusCode: 403,
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            error: 'TRIAL_EXPIRED',
            message: '30일 체험 기간이 종료되었습니다. 업그레이드하여 계속 사용하세요.',
            expiredDate: trialPeriod.endDate,
            tier: subscriptionTier
          })
        };
      }
    }

    // UNLIMITED가 아닌 경우: 메시지 할당량 체크
    if (subscriptionTier !== 'UNLIMITED') {
      const monthlyLimit = messageQuota.monthlyLimit;
      const currentUsage = messageQuota.currentMonthUsage || 0;

      // 할당량 초과 체크
      if (currentUsage >= monthlyLimit) {
        console.warn("Quota exceeded for user:", userId, {
          usage: currentUsage,
          limit: monthlyLimit,
          tier: subscriptionTier
        });

        return {
          statusCode: 403,
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            error: 'QUOTA_EXCEEDED',
            message: `월 메시지 한도(${monthlyLimit}개)에 도달했습니다. 다음 달에 초기화됩니다.`, // Note: This string contains a backtick, which is valid in JS template literals.
            currentUsage,
            monthlyLimit,
            resetDate: messageQuota.nextResetDate,
            tier: subscriptionTier
          })
        };
      }
    }

    // 1. 템플릿 및 봇 정보 조회 (기존 로직 재사용)
    const allTemplates = await dynamoClient.send(new ScanCommand({
      TableName: TABLES.TEMPLATES
    }));

    const templateMap = {};
    (allTemplates.Items || []).forEach(t => {
      templateMap[t.templateId] = t.systemPrompt;
    });

    const allUserBots = await dynamoClient.send(new ScanCommand({
      TableName: TABLES.USER_BOTS,
      FilterExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId
      }
    }));

    const userBot = (allUserBots.Items || []).find(bot => bot.botId === sessionId);

    if (!userBot || !userBot.templateId) {
      return {
        statusCode: 404,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: "Bot not found" })
      };
    }

    const systemPrompt = templateMap[userBot.templateId];

    if (!systemPrompt) {
      return {
        statusCode: 404,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: "Template not found for this bot" })
      };
    }

    // 2. 대화 히스토리 조회
    const historyResponse = await dynamoClient.send(new QueryCommand({
      TableName: TABLES.SESSIONS,
      KeyConditionExpression: "sessionId = :sessionId",
      ExpressionAttributeValues: {
        ":sessionId": sessionId
      },
      Limit: 10,
      ScanIndexForward: false
    }));

    const conversationHistory = (historyResponse.Items || [])
      .reverse()
      .map(item => ({
        user: item.userMessage,
        assistant: item.aiMessage
      }));

    // 3. Gemini용 대화 히스토리 구성
    const geminiHistory = conversationHistory.flatMap(item => [
      { role: "user", parts: [{ text: item.user }] },
      { role: "model", parts: [{ text: item.assistant }] }
    ]);

    console.log("Starting Gemini streaming...");
    console.log("System Prompt:", systemPrompt.substring(0, 100) + "...");

    // 4. Gemini 스트리밍 호출
    const protectedSystemPrompt = SYSTEM_PROMPT_PROTECTION + systemPrompt;
    const model = genAI.getGenerativeModel({
      model: MODEL_ID,
      systemInstruction: protectedSystemPrompt,
      safetySettings: SAFETY_SETTINGS,
    });

    const chat = model.startChat({
      history: geminiHistory,
      generationConfig: {
        maxOutputTokens: 2000,
        temperature: 0.7,
      },
    });

    // 재시도 로직으로 감싸서 스트리밍 호출
    const { fullAiMessage, inputTokens, outputTokens, chunks } = await retryWithBackoff(async () => {
      const result = await chat.sendMessageStream(message);

      // 5. 스트림 처리 및 전체 응답 수집
      let fullMsg = "";
      let inTokens = 0;
      let outTokens = 0;
      const chunkList = [];
      let chunkCount = 0;

      console.log("📡 Starting to receive chunks...");
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullMsg += chunkText;
        chunkCount++;
        chunkList.push({
          type: 'chunk',
          text: chunkText
        });

        if (chunkCount <= 3 || chunkCount % 10 === 0) {
          console.log(`📦 Chunk #${chunkCount}: ${chunkText.substring(0, 50)}...`);
        }
      }
      console.log(`✅ Stream finished. Total chunks: ${chunkCount}, Total length: ${fullMsg.length} chars`);

      // 토큰 사용량 수집
      const response = await result.response;
      if (response.usageMetadata) {
        inTokens = response.usageMetadata.promptTokenCount || 0;
        outTokens = response.usageMetadata.candidatesTokenCount || 0;
      }

      if (response.promptFeedback?.blockReason) {
        console.warn("⚠️ Response blocked by safety filter:", response.promptFeedback.blockReason);
      }

      return {
        fullAiMessage: fullMsg,
        inputTokens: inTokens,
        outputTokens: outTokens,
        chunks: chunkList
      };
    });

    console.log("Streaming completed. Full message length:", fullAiMessage.length, "chars");

    // 6. DynamoDB에 메시지 저장
    const timestamp = Date.now();
    const messageId = `${sessionId}-${timestamp}`;
    const TTL_30_DAYS = 30 * 24 * 60 * 60;

    await dynamoClient.send(new PutCommand({
      TableName: TABLES.SESSIONS,
      Item: {
        sessionId,
        timestamp,
        messageId,
        userId,
        userMessage: message,
        aiMessage: fullAiMessage,
        createdAt: new Date().toISOString(),
        expiresAt: Math.floor(Date.now() / 1000) + TTL_30_DAYS
      }
    }));

    // 7. 메시지 할당량 증가
    if (subscriptionTier !== 'UNLIMITED') {
      try {
        const today = new Date().toISOString().split('T')[0];
        const lastResetDate = messageQuota.lastResetDate || today;

        const shouldReset = lastResetDate < today.substring(0, 7); // Check if the month has changed

        if (shouldReset) {
          const nextMonth = new Date(today);
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          const firstDayNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1)
            .toISOString().split('T')[0];

          await dynamoClient.send(new UpdateCommand({
            TableName: TABLES.USERS,
            Key: { userId },
            UpdateExpression: `
              SET messageQuota.currentMonthUsage = :one,
                  messageQuota.lastResetDate = :today,
                  messageQuota.nextResetDate = :nextMonth
            `,
            ExpressionAttributeValues: {
              ':one': 1,
              ':today': today,
              ':nextMonth': firstDayNextMonth
            }
          }));

          console.log("Quota reset and incremented for new month:", userId);
        } else {
          await dynamoClient.send(new UpdateCommand({
            TableName: TABLES.USERS,
            Key: { userId },
            UpdateExpression: 'ADD messageQuota.currentMonthUsage :inc',
            ExpressionAttributeValues: {
              ':inc': 1
            }
          }));

          console.log("Quota incremented:", {
            userId,
            newUsage: (messageQuota.currentMonthUsage || 0) + 1,
            limit: messageQuota.monthlyLimit
          });
        }
      } catch (quotaError) {
        console.error("Failed to update quota (non-blocking):", quotaError);
      }
    }

    // 8. 사용량 추적
    trackUsage(userId, sessionId, inputTokens, outputTokens, MODEL_ID).catch(err => {
      console.error("Failed to track usage (non-blocking):", err);
    });

    // 9. 스트리밍 응답 반환
    const streamResponse = chunks.map(c => JSON.stringify(c)).join('\n') +
      '\n' + JSON.stringify({ type: 'done', messageId, timestamp });

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/x-ndjson',
        'Transfer-Encoding': 'chunked',
        'X-Accel-Buffering': 'no'
      },
      body: streamResponse
    };

  } catch (error) {
    console.error("Streaming error:", error);

    if (error.message?.includes('API key')) {
      return {
        statusCode: 401,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Gemini API 키가 유효하지 않습니다.',
          errorCode: 'INVALID_API_KEY',
          type: error.name
        })
      };
    }

    if (error.message?.includes('quota') || error.message?.includes('limit')) {
      return {
        statusCode: 429,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'AI 서비스 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.',
          errorCode: 'QUOTA_EXCEEDED',
          type: error.name
        })
      };
    }

    return {
      statusCode: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: error.message || 'AI 응답 생성 중 오류가 발생했습니다.',
        type: error.name
      })
    };
  }
}
