import { BedrockRuntimeClient, InvokeModelCommand, InvokeModelWithResponseStreamCommand } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand, ScanCommand, DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { CognitoIdentityProviderClient, AdminSetUserPasswordCommand } from "@aws-sdk/client-cognito-identity-provider";

// Bedrock 클라이언트 (us-east-1 - Cross Region)
const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });

// DynamoDB 클라이언트 (ap-northeast-2 - 서울)
const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "ap-northeast-2" })
);

// Lambda 클라이언트 (ap-northeast-2 - 서울)
const lambdaClient = new LambdaClient({ region: "ap-northeast-2" });

// Cognito 클라이언트 (ap-northeast-2 - 서울)
const cognitoClient = new CognitoIdentityProviderClient({ region: "ap-northeast-2" });

const SESSIONS_TABLE = "ai-co-learner-chat-sessions";
const TEMPLATES_TABLE = "ai-co-learner-bot-templates";
const USERS_TABLE = "ai-co-learner-users";
const USER_BOTS_TABLE = "ai-co-learner-user-bots";
const ASSESSMENTS_TABLE = "ai-co-learner-assessments";
const COMPETENCIES_TABLE = "ai-co-learner-user-competencies";
const QUESTS_TABLE = "ai-co-learner-daily-quests";
const ANALYTICS_TABLE = "ai-co-learner-learning-analytics";
const ACHIEVEMENTS_TABLE = "ai-co-learner-user-achievements";
const USAGE_TRACKING_TABLE = "ai-co-learner-usage-tracking";
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || "ap-northeast-2_OCntQ228q";
// Claude 3 Haiku - 빠르고 저렴하며 한국어 성능 우수
const MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0";

// 비용 계산 상수 (USD per 1M tokens)
const PRICING = {
  "anthropic.claude-3-haiku-20240307-v1:0": {
    input: 0.25,
    output: 1.25
  }
};

// CORS headers defined at top level
const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
};

// 권한 체크 헬퍼 함수
async function checkUserRole(userId, allowedRoles) {
  try {
    const result = await dynamoClient.send(new GetCommand({
      TableName: USERS_TABLE,
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

export const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  // Always handle OPTIONS first for CORS preflight
  if (event.httpMethod === 'OPTIONS' || event.requestContext?.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'OK' })
    };
  }

  const headers = CORS_HEADERS;

  try {

    // 라우팅 처리
    const path = event.path || event.resource;
    const method = event.httpMethod;

    // GET /chat/session/{sessionId} - 세션 조회
    if (method === 'GET' && path.includes('/chat/session/')) {
      return await getSession(event, headers);
    }

    // GET /bots/templates - 봇 템플릿 조회
    if (method === 'GET' && path.includes('/bots/templates')) {
      return await getTemplates(headers);
    }

    // GET /bots/user/{userId} - 사용자 봇 조회
    if (method === 'GET' && path.includes('/bots/user/')) {
      return await getUserBots(event, headers);
    }

    // POST /bots/create - 사용자 봇 생성
    if (method === 'POST' && path.includes('/bots/create')) {
      return await createUserBot(event, headers);
    }

    // POST /bots/delete - 사용자 봇 삭제
    if (method === 'POST' && path.includes('/bots/delete')) {
      return await deleteUserBot(event, headers);
    }

    // GET /bots/recommended/{userId} - 추천 봇 조회
    if (method === 'GET' && path.includes('/bots/recommended/')) {
      return await getRecommendedTemplates(event, headers);
    }

    // Admin APIs (먼저 체크 - 더 구체적인 경로)
    if (method === 'POST' && path.includes('/admin/templates/create')) {
      return await createTemplate(event, headers);
    }

    if (method === 'POST' && path.includes('/admin/templates/update')) {
      return await updateTemplate(event, headers);
    }

    if (method === 'POST' && path.includes('/admin/templates/delete')) {
      return await deleteTemplate(event, headers);
    }

    if (method === 'GET' && path.includes('/admin/users')) {
      return await getAllUsers(event, headers);
    }

    if (method === 'POST' && path.includes('/admin/users/update-role')) {
      return await updateUserRole(event, headers);
    }

    if (method === 'POST' && path.includes('/admin/users/update-info')) {
      return await updateUserInfo(event, headers);
    }

    if (method === 'POST' && path.includes('/admin/users/block')) {
      return await blockUser(event, headers);
    }

    if (method === 'GET' && path.includes('/admin/usage')) {
      return await getUsageStats(event, headers);
    }

    // Assessment APIs
    if (method === 'POST' && path.includes('/assessment/start')) {
      return await startAssessment(event, headers);
    }

    if (method === 'POST' && path.includes('/assessment/submit')) {
      return await submitAssessmentAnswer(event, headers);
    }

    if (method === 'GET' && path.includes('/assessment/results')) {
      return await getAssessmentResults(event, headers);
    }

    // Quest APIs
    if (method === 'GET' && path.includes('/quests/')) {
      return await getUserQuests(event, headers);
    }

    // GET /achievements/{userId} - 사용자 배지 조회
    if (method === 'GET' && path.includes('/achievements/')) {
      return await getUserAchievements(event, headers);
    }

    // GET /analysis/{userId} - 학습 패턴 분석 조회
    if (method === 'GET' && path.includes('/analysis/')) {
      return await getLearningAnalysis(event, headers);
    }

    // GET /users/{userId}/competencies/history - 역량 히스토리 조회
    if (method === 'GET' && path.includes('/users/') && path.includes('/competencies/history')) {
      return await getCompetencyHistory(event, headers);
    }

    // GET /users/{userId}/competencies - 사용자 역량 조회
    if (method === 'GET' && path.includes('/users/') && path.includes('/competencies')) {
      return await getUserCompetencies(event, headers);
    }

    // GET /users/{userId} - 사용자 프로필 조회
    if (method === 'GET' && path.includes('/users/')) {
      return await getUserProfile(event, headers);
    }

    // POST /users - 사용자 프로필 생성
    if (method === 'POST' && path.includes('/users') && !path.includes('/update') && !path.includes('/admin')) {
      return await createUserProfile(event, headers);
    }

    // POST /users/update - 사용자 프로필 업데이트
    if (method === 'POST' && path.includes('/users/update') && !path.includes('/admin')) {
      return await updateUserProfile(event, headers);
    }

    // POST /chat/stream - 스트리밍 채팅 메시지 전송
    if (method === 'POST' && path.includes('/chat/stream')) {
      return await sendChatMessageStream(event, headers);
    }

    // POST /chat - 채팅 메시지 전송 (기존 기능)
    if (method === 'POST' && path.includes('/chat') && !path.includes('/stream')) {
      return await sendChatMessage(event, headers);
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Route not found' })
    };

  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS, // Always return CORS headers even on error
      body: JSON.stringify({
        error: error.message,
        type: error.name
      })
    };
  }
};

// 채팅 메시지 전송 (기존 로직)
async function sendChatMessage(event, headers) {
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
    TableName: TEMPLATES_TABLE
  }));

  const templateMap = {};
  (allTemplates.Items || []).forEach(t => {
    templateMap[t.templateId] = t.systemPrompt;
  });

  // 2. sessionId(botId)로 user bot 조회
  const allUserBots = await dynamoClient.send(new ScanCommand({
    TableName: USER_BOTS_TABLE,
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
    TableName: SESSIONS_TABLE,
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

  // 5. Claude용 메시지 생성
  const messages = buildClaudeMessages(message, conversationHistory);

  console.log("Sending to Claude:", JSON.stringify(messages).substring(0, 200) + "...");

  // 6. Bedrock 호출 (Claude API 형식)
  const bedrockResponse = await bedrockClient.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 500,
      temperature: 0.7,
      system: systemPrompt,
      messages: messages
    })
  }));

  // 7. Claude 응답 파싱
  const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
  const aiMessage = responseBody.content[0].text;

  console.log("Bedrock response:", aiMessage);

  // 7-1. 사용량 추적 (토큰 사용량)
  const inputTokens = responseBody.usage?.input_tokens || 0;
  const outputTokens = responseBody.usage?.output_tokens || 0;
  await trackUsage(userId, sessionId, inputTokens, outputTokens, MODEL_ID);

  // 8. DynamoDB에 메시지 저장
  const timestamp = Date.now();
  const messageId = `${sessionId}-${timestamp}`;
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

// 스트리밍 채팅 메시지 전송
async function sendChatMessageStream(event, headers) {
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
    // 1. 템플릿 및 봇 정보 조회 (기존 로직 재사용)
    const allTemplates = await dynamoClient.send(new ScanCommand({
      TableName: TEMPLATES_TABLE
    }));

    const templateMap = {};
    (allTemplates.Items || []).forEach(t => {
      templateMap[t.templateId] = t.systemPrompt;
    });

    const allUserBots = await dynamoClient.send(new ScanCommand({
      TableName: USER_BOTS_TABLE,
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
      TableName: SESSIONS_TABLE,
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

    // 3. Claude용 메시지 생성
    const messages = buildClaudeMessages(message, conversationHistory);

    console.log("Starting Bedrock streaming...");

    // 4. Bedrock 스트리밍 호출
    const enhancedSystemPrompt = `${systemPrompt}

응답 형식 지침:
- 응답은 반드시 마크다운 형식으로 작성하세요.
- 제목은 ## 또는 ###를 사용하세요.
- 목록은 번호(1., 2.) 또는 불릿(-) 형식을 사용하세요.
- 중요한 내용은 **굵게** 표시하세요.
- 예시나 코드는 \`백틱\`으로 감싸세요.
- 단락 구분을 명확히 하여 가독성을 높이세요.`;

    const streamCommand = new InvokeModelWithResponseStreamCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 500,
        temperature: 0.7,
        system: enhancedSystemPrompt,
        messages: messages
      })
    });

    const response = await bedrockClient.send(streamCommand);

    // 5. 스트림 처리 및 전체 응답 수집
    let fullAiMessage = "";
    let inputTokens = 0;
    let outputTokens = 0;
    const chunks = [];

    for await (const event of response.body) {
      if (event.chunk) {
        const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));

        if (chunk.type === 'content_block_delta') {
          const text = chunk.delta?.text || '';
          fullAiMessage += text;
          chunks.push({
            type: 'chunk',
            text: text
          });
        }

        // 토큰 사용량 수집
        if (chunk.type === 'message_start') {
          inputTokens = chunk.message?.usage?.input_tokens || 0;
        }
        if (chunk.type === 'message_delta') {
          outputTokens = chunk.usage?.output_tokens || 0;
        }
      }
    }

    console.log("Streaming completed. Full message:", fullAiMessage);

    // 5-1. 사용량 추적
    await trackUsage(userId, sessionId, inputTokens, outputTokens, MODEL_ID);

    // 6. DynamoDB에 메시지 저장 (스트림 완료 후)
    const timestamp = Date.now();
    const messageId = `${sessionId}-${timestamp}`;
    const TTL_30_DAYS = 30 * 24 * 60 * 60;

    await dynamoClient.send(new PutCommand({
      TableName: SESSIONS_TABLE,
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

    // 7. 스트리밍 응답 반환 (newline-delimited JSON)
    const streamResponse = chunks.map(c => JSON.stringify(c)).join('\n') +
      '\n' + JSON.stringify({ type: 'done', messageId, timestamp });

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/x-ndjson', // Newline-delimited JSON
        'Transfer-Encoding': 'chunked',
        'X-Accel-Buffering': 'no' // Disable proxy buffering
      },
      body: streamResponse
    };

  } catch (error) {
    console.error("Streaming error:", error);
    return {
      statusCode: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: error.message,
        type: error.name
      })
    };
  }
}

// 세션 조회
async function getSession(event, headers) {
  const sessionId = event.pathParameters?.sessionId || event.path.split('/').pop();

  const response = await dynamoClient.send(new QueryCommand({
    TableName: SESSIONS_TABLE,
    KeyConditionExpression: "sessionId = :sessionId",
    ExpressionAttributeValues: {
      ":sessionId": sessionId
    },
    ScanIndexForward: true // 오래된 순서
  }));

  const messages = (response.Items || []).flatMap((item, index) => {
    const msgs = [];
    if (index === 0) {
      // 첫 메시지는 AI 인사
      msgs.push({
        id: `${sessionId}-init`,
        sender: 'ai',
        text: '안녕하세요! 무엇을 도와드릴까요?',
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
      userId: response.Items?.[0]?.userId || 'unknown',
      messages
    })
  };
}

// 봇 템플릿 조회
async function getTemplates(headers) {
  try {
    const response = await dynamoClient.send(new ScanCommand({
      TableName: TEMPLATES_TABLE
    }));

    const templates = (response.Items || []).map(item => ({
      id: item.templateId,
      name: item.name,
      description: item.description,
      systemPrompt: item.systemPrompt,
      themeColor: item.themeColor
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(templates)
    };
  } catch (error) {
    console.error("Error fetching templates:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

// 사용자 봇 조회
async function getUserBots(event, headers) {
  try {
    const userId = event.pathParameters?.userId || event.path.split('/').pop();

    const USER_BOTS_TABLE = "ai-co-learner-user-bots";

    const response = await dynamoClient.send(new ScanCommand({
      TableName: USER_BOTS_TABLE,
      FilterExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId
      }
    }));

    const bots = (response.Items || []).map(item => ({
      id: item.botId,
      userId: item.userId,
      templateId: item.templateId,
      name: item.name,
      currentLevel: item.currentLevel || 1,
      createdAt: item.createdAt,
      templateName: item.templateName || item.name,
      themeColor: item.themeColor || 'blue',
      description: item.description || ''
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(bots)
    };
  } catch (error) {
    console.error("Error fetching user bots:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

// 사용자 봇 생성
async function createUserBot(event, headers) {
  try {
    const body = JSON.parse(event.body || "{}");
    const { userId, templateId, name } = body;

    if (!userId || !templateId || !name) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing required fields" })
      };
    }

    const USER_BOTS_TABLE = "ai-co-learner-user-bots";
    const botId = `bot-${Date.now()}`;

    // 템플릿 정보 가져오기
    const templateResponse = await dynamoClient.send(new GetCommand({
      TableName: TEMPLATES_TABLE,
      Key: { templateId }
    }));

    const template = templateResponse.Item;

    if (!template) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Template not found" })
      };
    }

    await dynamoClient.send(new PutCommand({
      TableName: USER_BOTS_TABLE,
      Item: {
        userId,
        botId,
        templateId,
        name,
        currentLevel: 1,
        createdAt: new Date().toISOString(),
        templateName: template.name,
        themeColor: template.themeColor || 'blue',
        description: template.description || '',
        primaryCompetencies: template.primaryCompetencies || []
      }
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        id: botId,
        userId,
        templateId,
        name,
        currentLevel: 1,
        createdAt: new Date().toISOString(),
        templateName: template.name,
        themeColor: template.themeColor || 'blue',
        description: template.description || '',
        primaryCompetencies: template.primaryCompetencies || []
      })
    };
  } catch (error) {
    console.error("Error creating user bot:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

// 사용자 봇 삭제
async function deleteUserBot(event, headers) {
  const body = JSON.parse(event.body || "{}");
  const { userId, botId } = body;

  if (!userId || !botId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing required fields: userId, botId" })
    };
  }

  try {
    // 봇이 존재하는지 확인
    const scanResult = await dynamoClient.send(new ScanCommand({
      TableName: USER_BOTS_TABLE,
      FilterExpression: "userId = :userId AND botId = :botId",
      ExpressionAttributeValues: {
        ":userId": userId,
        ":botId": botId
      }
    }));

    if (!scanResult.Items || scanResult.Items.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Bot not found" })
      };
    }

    // 봇 삭제
    await dynamoClient.send(new DeleteCommand({
      TableName: USER_BOTS_TABLE,
      Key: {
        userId,
        botId
      }
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "Bot deleted successfully",
        botId
      })
    };
  } catch (error) {
    console.error("Delete user bot error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

// 사용자 프로필 조회
async function getUserProfile(event, headers) {
  const userId = event.pathParameters?.userId || event.path.split('/').pop();
  const USERS_TABLE = "ai-co-learner-users";

  try {
    const response = await dynamoClient.send(new QueryCommand({
      TableName: USERS_TABLE,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId
      }
    }));

    if (!response.Items || response.Items.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "User not found" })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response.Items[0])
    };
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

// 사용자 프로필 생성/업데이트
async function createUserProfile(event, headers) {
  try {
    const body = JSON.parse(event.body || "{}");
    const { userId, username, name, organization, role = 'USER', level = 1, title = '초보 탐험가' } = body;

    if (!userId || !username) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing required fields: userId, username" })
      };
    }

    const USERS_TABLE = "ai-co-learner-users";

    await dynamoClient.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: {
        userId,
        username,
        name: name || username,
        organization: organization || '',
        role,
        level,
        title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        userId,
        username,
        name: name || username,
        role,
        level,
        title
      })
    };
  } catch (error) {
    console.error("Error creating user profile:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

// 사용자 프로필 업데이트
async function updateUserProfile(event, headers) {
  const body = JSON.parse(event.body || "{}");
  const { userId, name, organization } = body;

  if (!userId || !name) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing required fields: userId, name" })
    };
  }

  const USERS_TABLE = "ai-co-learner-users";

  try {
    // organization이 제공된 경우에만 업데이트
    const updateExpression = organization !== undefined
      ? "SET #name = :name, #organization = :organization, updatedAt = :updatedAt"
      : "SET #name = :name, updatedAt = :updatedAt";

    const expressionAttributeNames = organization !== undefined
      ? { "#name": "name", "#organization": "organization" }
      : { "#name": "name" };

    const expressionAttributeValues = organization !== undefined
      ? { ":name": name, ":organization": organization, ":updatedAt": new Date().toISOString() }
      : { ":name": name, ":updatedAt": new Date().toISOString() };

    const result = await dynamoClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW"
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result.Attributes)
    };
  } catch (error) {
    console.error("Error updating user profile:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

function buildClaudeMessages(userMessage, conversationHistory) {
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

// 사용량 추적 함수
async function trackUsage(userId, sessionId, inputTokens, outputTokens, modelId = MODEL_ID) {
  const totalTokens = inputTokens + outputTokens;
  const pricing = PRICING[modelId] || PRICING[MODEL_ID];

  const inputCost = (inputTokens / 1000000) * pricing.input;
  const outputCost = (outputTokens / 1000000) * pricing.output;
  const estimatedCost = inputCost + outputCost;

  const timestamp = Date.now();

  try {
    await dynamoClient.send(new PutCommand({
      TableName: USAGE_TRACKING_TABLE,
      Item: {
        userId,
        timestamp,
        sessionId,
        messageId: `${sessionId}-${timestamp}`,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost: parseFloat(estimatedCost.toFixed(6)),
        service: 'bedrock',
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

// ===== ADMIN APIs =====

// 템플릿 생성
async function createTemplate(event, headers) {
  try {
    const body = JSON.parse(event.body || "{}");
    const { userId } = body;

    // 권한 체크: SUPER_USER 또는 ADMIN만 가능
    const roleCheck = await checkUserRole(userId, ['SUPER_USER', 'ADMIN']);
    if (!roleCheck.authorized) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: roleCheck.error })
      };
    }

    const {
      name,
      description,
      systemPrompt,
      themeColor,
      baseType,
      primaryCompetencies,
      secondaryCompetencies,
      recommendedFor
    } = body;

    if (!name || !systemPrompt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing required fields: name, systemPrompt" })
      };
    }

    const templateId = `t${Date.now()}`;

    await dynamoClient.send(new PutCommand({
      TableName: TEMPLATES_TABLE,
      Item: {
        templateId,
        name,
        description: description || '',
        systemPrompt,
        themeColor: themeColor || 'blue',
        baseType: baseType || 'coaching',
        primaryCompetencies: primaryCompetencies || [],
        secondaryCompetencies: secondaryCompetencies || [],
        recommendedFor: recommendedFor || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        id: templateId,
        name,
        description,
        systemPrompt,
        themeColor,
        baseType,
        primaryCompetencies,
        secondaryCompetencies,
        recommendedFor
      })
    };
  } catch (error) {
    console.error("Error creating template:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

// 템플릿 수정
async function updateTemplate(event, headers) {
  try {
    const body = JSON.parse(event.body || "{}");
    const { userId } = body;

    // 권한 체크: SUPER_USER 또는 ADMIN만 가능
    const roleCheck = await checkUserRole(userId, ['SUPER_USER', 'ADMIN']);
    if (!roleCheck.authorized) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: roleCheck.error })
      };
    }

    const {
      templateId,
      name,
      description,
      systemPrompt,
      themeColor,
      baseType,
      primaryCompetencies,
      secondaryCompetencies,
      recommendedFor
    } = body;

    if (!templateId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing required field: templateId" })
      };
    }

    const updateExpression = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    if (name) {
      updateExpression.push("#name = :name");
      expressionAttributeNames["#name"] = "name";
      expressionAttributeValues[":name"] = name;
    }
    if (description !== undefined) {
      updateExpression.push("description = :description");
      expressionAttributeValues[":description"] = description;
    }
    if (systemPrompt) {
      updateExpression.push("systemPrompt = :systemPrompt");
      expressionAttributeValues[":systemPrompt"] = systemPrompt;
    }
    if (themeColor) {
      updateExpression.push("themeColor = :themeColor");
      expressionAttributeValues[":themeColor"] = themeColor;
    }
    if (baseType) {
      updateExpression.push("baseType = :baseType");
      expressionAttributeValues[":baseType"] = baseType;
    }
    if (primaryCompetencies !== undefined) {
      updateExpression.push("primaryCompetencies = :primaryCompetencies");
      expressionAttributeValues[":primaryCompetencies"] = primaryCompetencies;
    }
    if (secondaryCompetencies !== undefined) {
      updateExpression.push("secondaryCompetencies = :secondaryCompetencies");
      expressionAttributeValues[":secondaryCompetencies"] = secondaryCompetencies;
    }
    if (recommendedFor !== undefined) {
      updateExpression.push("recommendedFor = :recommendedFor");
      expressionAttributeValues[":recommendedFor"] = recommendedFor;
    }

    updateExpression.push("updatedAt = :updatedAt");
    expressionAttributeValues[":updatedAt"] = new Date().toISOString();

    const result = await dynamoClient.send(new UpdateCommand({
      TableName: TEMPLATES_TABLE,
      Key: { templateId },
      UpdateExpression: "SET " + updateExpression.join(", "),
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW"
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result.Attributes)
    };
  } catch (error) {
    console.error("Error updating template:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

// 템플릿 삭제
async function deleteTemplate(event, headers) {
  const body = JSON.parse(event.body || "{}");
  const { userId, templateId } = body;

  // 권한 체크: SUPER_USER 또는 ADMIN만 가능
  const roleCheck = await checkUserRole(userId, ['SUPER_USER', 'ADMIN']);
  if (!roleCheck.authorized) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: roleCheck.error })
    };
  }

  if (!templateId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing required field: templateId" })
    };
  }

  await dynamoClient.send(new DeleteCommand({
    TableName: TEMPLATES_TABLE,
    Key: { templateId }
  }));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ message: "Template deleted successfully", templateId })
  };
}

// 모든 사용자 조회
async function getAllUsers(event, headers) {
  // userId를 쿼리 파라미터에서 가져옴
  const userId = event.queryStringParameters?.userId;

  if (!userId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing userId parameter" })
    };
  }

  // 권한 체크: ADMIN만 가능
  const roleCheck = await checkUserRole(userId, ['ADMIN']);
  if (!roleCheck.authorized) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: roleCheck.error })
    };
  }

  const response = await dynamoClient.send(new ScanCommand({
    TableName: USERS_TABLE
  }));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(response.Items || [])
  };
}

// 사용자 역할 변경
async function updateUserRole(event, headers) {
  const body = JSON.parse(event.body || "{}");
  const { adminUserId, userId, role } = body;

  console.log("Admin userId:", adminUserId);
  console.log("Target userId:", userId);
  console.log("New role:", role);

  if (!adminUserId || !userId || !role) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing required fields: adminUserId, userId, role" })
    };
  }

  // 권한 체크: ADMIN만 가능
  const roleCheck = await checkUserRole(adminUserId, ['ADMIN']);
  if (!roleCheck.authorized) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: roleCheck.error })
    };
  }

  // Validate role value
  if (!['USER', 'SUPER_USER', 'ADMIN'].includes(role)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid role. Must be USER, SUPER_USER, or ADMIN" })
    };
  }

  try {
    const result = await dynamoClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: "SET #role = :role, updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#role": "role"
      },
      ExpressionAttributeValues: {
        ":role": role,
        ":updatedAt": new Date().toISOString()
      },
      ReturnValues: "ALL_NEW"
    }));

    console.log("✅ User role updated successfully:", result.Attributes);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result.Attributes)
    };
  } catch (error) {
    console.error("❌ Error updating user role:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to update user role",
        message: error.message,
        details: error.toString()
      })
    };
  }
}

// 사용량 통계 조회 (관리자용)
async function getUsageStats(event, headers) {
  try {
    // Query parameters
    const adminUserId = event.queryStringParameters?.adminUserId;
    const userId = event.queryStringParameters?.userId;
    const startDate = event.queryStringParameters?.startDate; // YYYY-MM-DD
    const endDate = event.queryStringParameters?.endDate; // YYYY-MM-DD
    const days = parseInt(event.queryStringParameters?.days || '30', 10);

    if (!adminUserId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing adminUserId parameter" })
      };
    }

    // 권한 체크: ADMIN만 가능
    const roleCheck = await checkUserRole(adminUserId, ['ADMIN']);
    if (!roleCheck.authorized) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: roleCheck.error })
      };
    }

    let allUsageData = [];

    if (userId) {
      // 특정 사용자 사용량 조회
      const endTimestamp = endDate
        ? new Date(endDate).getTime()
        : Date.now();
      const startTimestamp = startDate
        ? new Date(startDate).getTime()
        : endTimestamp - (days * 24 * 60 * 60 * 1000);

      const result = await dynamoClient.send(new QueryCommand({
        TableName: USAGE_TRACKING_TABLE,
        KeyConditionExpression: 'userId = :userId AND #timestamp BETWEEN :start AND :end',
        ExpressionAttributeNames: {
          '#timestamp': 'timestamp'
        },
        ExpressionAttributeValues: {
          ':userId': userId,
          ':start': startTimestamp,
          ':end': endTimestamp
        }
      }));

      allUsageData = result.Items || [];
    } else {
      // 전체 사용자 사용량 조회 (Scan)
      const result = await dynamoClient.send(new ScanCommand({
        TableName: USAGE_TRACKING_TABLE
      }));

      allUsageData = result.Items || [];

      // 날짜 필터링
      if (startDate || endDate || days) {
        const endTimestamp = endDate
          ? new Date(endDate).getTime()
          : Date.now();
        const startTimestamp = startDate
          ? new Date(startDate).getTime()
          : endTimestamp - (days * 24 * 60 * 60 * 1000);

        allUsageData = allUsageData.filter(item =>
          item.timestamp >= startTimestamp && item.timestamp <= endTimestamp
        );
      }
    }

    // 사용자별 집계
    const userStats = {};
    let totalCost = 0;
    let totalTokens = 0;
    let totalMessages = 0;

    allUsageData.forEach(item => {
      const uid = item.userId;

      if (!userStats[uid]) {
        userStats[uid] = {
          userId: uid,
          totalCost: 0,
          totalTokens: 0,
          totalMessages: 0,
          inputTokens: 0,
          outputTokens: 0
        };
      }

      userStats[uid].totalCost += item.estimatedCost || 0;
      userStats[uid].totalTokens += item.totalTokens || 0;
      userStats[uid].inputTokens += item.inputTokens || 0;
      userStats[uid].outputTokens += item.outputTokens || 0;
      userStats[uid].totalMessages += 1;

      totalCost += item.estimatedCost || 0;
      totalTokens += item.totalTokens || 0;
      totalMessages += 1;
    });

    // 사용자 정보 조회 (이름, 이메일)
    const userIds = Object.keys(userStats);
    const userInfoPromises = userIds.map(async (uid) => {
      try {
        const result = await dynamoClient.send(new GetCommand({
          TableName: USERS_TABLE,
          Key: { userId: uid }
        }));
        return {
          userId: uid,
          name: result.Item?.name || 'Unknown',
          email: result.Item?.email || result.Item?.username || 'N/A'
        };
      } catch (error) {
        console.error(`Failed to get user info for ${uid}:`, error);
        return {
          userId: uid,
          name: 'Unknown',
          email: 'N/A'
        };
      }
    });

    const userInfoList = await Promise.all(userInfoPromises);
    const userInfoMap = {};
    userInfoList.forEach(info => {
      userInfoMap[info.userId] = info;
    });

    // userStats에 사용자 정보 추가
    Object.keys(userStats).forEach(uid => {
      userStats[uid].name = userInfoMap[uid]?.name || 'Unknown';
      userStats[uid].email = userInfoMap[uid]?.email || 'N/A';
      userStats[uid].organization = userInfoMap[uid]?.organization || '';
    });

    // 일별 집계
    const dailyStats = {};
    allUsageData.forEach(item => {
      const date = item.date || new Date(item.timestamp).toISOString().split('T')[0];

      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          totalCost: 0,
          totalTokens: 0,
          totalMessages: 0
        };
      }

      dailyStats[date].totalCost += item.estimatedCost || 0;
      dailyStats[date].totalTokens += item.totalTokens || 0;
      dailyStats[date].totalMessages += 1;
    });

    // 배열로 변환 및 정렬
    const userStatsArray = Object.values(userStats)
      .map(stat => ({
        ...stat,
        totalCost: parseFloat(stat.totalCost.toFixed(6)),
        avgCostPerMessage: stat.totalMessages > 0
          ? parseFloat((stat.totalCost / stat.totalMessages).toFixed(6))
          : 0
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    const dailyStatsArray = Object.values(dailyStats)
      .map(stat => ({
        ...stat,
        totalCost: parseFloat(stat.totalCost.toFixed(6))
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        summary: {
          totalCost: parseFloat(totalCost.toFixed(6)),
          totalTokens,
          totalMessages,
          totalUsers: Object.keys(userStats).length,
          avgCostPerMessage: totalMessages > 0
            ? parseFloat((totalCost / totalMessages).toFixed(6))
            : 0,
          avgCostPerUser: Object.keys(userStats).length > 0
            ? parseFloat((totalCost / Object.keys(userStats).length).toFixed(6))
            : 0
        },
        userStats: userStatsArray,
        dailyStats: dailyStatsArray,
        period: {
          startDate: startDate || new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: endDate || new Date().toISOString().split('T')[0],
          days
        }
      })
    };
  } catch (error) {
    console.error('Get usage stats error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

// 사용자 차단/차단해제
async function blockUser(event, headers) {
  const body = JSON.parse(event.body || "{}");
  const { userId, blocked } = body;

  if (!userId || blocked === undefined) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing required fields: userId, blocked" })
    };
  }

  const result = await dynamoClient.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { userId },
    UpdateExpression: "SET blocked = :blocked, updatedAt = :updatedAt",
    ExpressionAttributeValues: {
      ":blocked": blocked,
      ":updatedAt": new Date().toISOString()
    },
    ReturnValues: "ALL_NEW"
  }));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(result.Attributes)
  };
}

// 관리자용 사용자 정보 업데이트 (이름, 소속, 비밀번호 변경)
async function updateUserInfo(event, headers) {
  const body = JSON.parse(event.body || "{}");
  const { userId, name, organization, password } = body;

  console.log("Admin updating user info for userId:", userId);
  console.log("New name:", name);
  console.log("New organization:", organization);
  console.log("Password reset requested:", !!password);

  if (!userId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing required field: userId" })
    };
  }

  // 최소 하나의 필드는 제공되어야 함
  if (!name && !organization && !password) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "At least one field (name, organization, or password) must be provided" })
    };
  }

  try {
    // 비밀번호 변경 (Cognito)
    if (password) {
      if (password.length < 8) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Password must be at least 8 characters long" })
        };
      }

      try {
        await cognitoClient.send(new AdminSetUserPasswordCommand({
          UserPoolId: COGNITO_USER_POOL_ID,
          Username: userId,
          Password: password,
          Permanent: true
        }));
        console.log("✅ Password updated successfully for userId:", userId);
      } catch (cognitoError) {
        console.error("❌ Error updating password in Cognito:", cognitoError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: "Failed to update password: " + cognitoError.message })
        };
      }
    }

    // DynamoDB 사용자 정보 업데이트 (이름, 소속)
    if (name || organization !== undefined) {
      const updateParts = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = { ":updatedAt": new Date().toISOString() };

      if (name) {
        updateParts.push("#name = :name");
        expressionAttributeNames["#name"] = "name";
        expressionAttributeValues[":name"] = name;
      }

      if (organization !== undefined) {
        updateParts.push("#organization = :organization");
        expressionAttributeNames["#organization"] = "organization";
        expressionAttributeValues[":organization"] = organization;
      }

      updateParts.push("updatedAt = :updatedAt");
      const updateExpression = "SET " + updateParts.join(", ");

      const result = await dynamoClient.send(new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { userId },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW"
      }));

      console.log("✅ User info updated successfully:", result.Attributes);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.Attributes)
      };
    }

    // 비밀번호만 변경한 경우
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Password updated successfully", userId })
    };
  } catch (error) {
    console.error("❌ Error updating user info:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

// 사용자 역량 조회
async function getUserCompetencies(event, headers) {
  const pathParts = event.path.split('/');
  const userId = pathParts[2]; // /users/{userId}/competencies

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
      trend: calculateTrend(item.historicalScores || [])
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

// ===== ASSESSMENT APIs =====

// 역량 평가를 위한 질문 템플릿 (주관식 - 주석 처리)
/*
const ASSESSMENT_QUESTIONS_SUBJECTIVE = [
  {
    id: "q1",
    question: "최근에 해결하고 싶었던 문제나 궁금했던 주제가 있나요? 그것에 대해 어떤 질문을 스스로에게 던졌는지 설명해주세요.",
    expectedCompetencies: ["questionQuality", "thinkingDepth"]
  },
  {
    id: "q2",
    question: "일상에서 마주친 평범한 상황이나 물건을 하나 떠올려보세요. 그것을 완전히 다른 방식으로 활용하거나 개선한다면 어떻게 하시겠어요?",
    expectedCompetencies: ["creativity", "thinkingDepth"]
  },
  {
    id: "q3",
    question: "복잡한 개념이나 아이디어를 다른 사람에게 설명해야 했던 경험이 있나요? 어떻게 설명했는지 구체적으로 말씀해주세요.",
    expectedCompetencies: ["communicationClarity", "thinkingDepth"]
  },
  {
    id: "q4",
    question: "최근에 계획을 세우고 실행에 옮긴 경험이 있나요? 어떤 단계를 거쳤고, 어떤 결과가 나왔나요?",
    expectedCompetencies: ["executionOriented", "thinkingDepth"]
  },
  {
    id: "q5",
    question: "다른 사람과 함께 무언가를 해결하거나 만들어낸 경험을 공유해주세요. 그 과정에서 어떤 역할을 하셨나요?",
    expectedCompetencies: ["collaborationSignal", "communicationClarity"]
  },
  {
    id: "q6",
    question: "어떤 문제를 깊이 파고들어 생각해본 적이 있나요? 표면적인 답 너머에서 발견한 것이 있다면 무엇인가요?",
    expectedCompetencies: ["thinkingDepth", "questionQuality"]
  },
  {
    id: "q7",
    question: "기존에 없던 새로운 것을 시도하거나 만들어본 경험이 있나요? 그 아이디어는 어디서 왔고, 어떻게 실현했나요?",
    expectedCompetencies: ["creativity", "executionOriented"]
  },
  {
    id: "q8",
    question: "복잡한 정보나 데이터를 단순하고 명확하게 정리해본 적이 있나요? 어떤 방법을 사용했나요?",
    expectedCompetencies: ["communicationClarity", "thinkingDepth"]
  }
];
*/

// 역량 평가를 위한 객관식 질문 (20문항)
const ASSESSMENT_QUESTIONS = [
  // questionQuality (질문력) - 4문항
  {
    id: "q1",
    question: "문제를 해결할 때 나의 접근 방식은?",
    options: [
      { text: "일단 시작하고 부딪히면서 배운다", score: 1 },
      { text: "기본적인 질문 몇 가지를 생각해본다", score: 2 },
      { text: "문제를 분석하고 핵심 질문들을 정리한다", score: 3 },
      { text: "다각도로 질문을 만들어 문제의 본질을 파악한다", score: 4 }
    ],
    competency: "questionQuality"
  },
  {
    id: "q2",
    question: "새로운 주제를 학습할 때 나는?",
    options: [
      { text: "주어진 내용을 그대로 받아들인다", score: 1 },
      { text: "이해가 안 되는 부분만 질문한다", score: 2 },
      { text: "'왜 그럴까?'라는 질문을 자주 던진다", score: 3 },
      { text: "연관된 질문들을 계속 만들어가며 깊이 탐구한다", score: 4 }
    ],
    competency: "questionQuality"
  },
  {
    id: "q3",
    question: "다른 사람의 의견을 들을 때 나는?",
    options: [
      { text: "경청하고 받아들인다", score: 1 },
      { text: "궁금한 점이 있으면 질문한다", score: 2 },
      { text: "의견의 근거가 무엇인지 파악하려 한다", score: 3 },
      { text: "질문을 통해 숨어있는 가정이나 전제를 발견한다", score: 4 }
    ],
    competency: "questionQuality"
  },

  // thinkingDepth (사고력) - 4문항
  {
    id: "q4",
    question: "복잡한 문제를 마주했을 때 나는?",
    options: [
      { text: "빠르게 해결책을 찾으려 한다", score: 1 },
      { text: "여러 가지 방법을 시도해본다", score: 2 },
      { text: "문제를 작은 부분으로 나누어 하나씩 분석한다", score: 3 },
      { text: "문제가 왜 발생했는지 근본 원인부터 깊이 파고든다", score: 4 }
    ],
    competency: "thinkingDepth"
  },
  {
    id: "q5",
    question: "새로운 정보를 학습할 때 나의 방식은?",
    options: [
      { text: "당장 필요한 핵심만 빠르게 파악한다", score: 1 },
      { text: "중요한 내용을 정리하고 요약한다", score: 2 },
      { text: "이미 알고 있는 지식과 연결지어 이해한다", score: 3 },
      { text: "여러 관점에서 깊이 분석하고 실제로 어떻게 활용할지 고민한다", score: 4 }
    ],
    competency: "thinkingDepth"
  },
  {
    id: "q6",
    question: "중요한 결정을 내릴 때 나는?",
    options: [
      { text: "직감을 믿고 빠르게 결정한다", score: 1 },
      { text: "좋은 점과 나쁜 점을 간단히 비교한다", score: 2 },
      { text: "여러 요소를 종합적으로 따져본다", score: 3 },
      { text: "나중에 미칠 영향까지 생각하며 신중히 판단한다", score: 4 }
    ],
    competency: "thinkingDepth"
  },

  // creativity (창의력) - 3문항
  {
    id: "q7",
    question: "문제 해결할 때 나의 아이디어 스타일은?",
    options: [
      { text: "이미 검증된 안전한 방법을 따른다", score: 1 },
      { text: "기존 방법을 조금 변형해본다", score: 2 },
      { text: "여러 방법을 새롭게 조합해본다", score: 3 },
      { text: "아무도 시도하지 않은 완전히 새로운 방법을 만든다", score: 4 }
    ],
    competency: "creativity"
  },
  {
    id: "q8",
    question: "일상에서 새로운 것을 접했을 때 나는?",
    options: [
      { text: "익숙한 방식을 선호한다", score: 1 },
      { text: "가끔 새로운 것을 시도한다", score: 2 },
      { text: "자주 새로운 방식을 실험해본다", score: 3 },
      { text: "항상 '이걸 다르게 하면 어떨까?' 상상한다", score: 4 }
    ],
    competency: "creativity"
  },
  {
    id: "q9",
    question: "아이디어를 떠올릴 때 나는?",
    options: [
      { text: "대부분 사람들이 하는 일반적인 생각을 한다", score: 1 },
      { text: "다른 사람의 좋은 아이디어를 참고한다", score: 2 },
      { text: "서로 다른 분야의 아이디어를 섞어본다", score: 3 },
      { text: "전혀 관련 없어 보이는 것들을 창의적으로 연결한다", score: 4 }
    ],
    competency: "creativity"
  },

  // communicationClarity (소통력) - 3문항
  {
    id: "q10",
    question: "복잡한 내용을 다른 사람에게 설명할 때 나는?",
    options: [
      { text: "내가 아는 대로 그대로 설명한다", score: 1 },
      { text: "핵심 내용만 간단히 전달한다", score: 2 },
      { text: "듣는 사람 수준에 맞춰 쉽게 풀어 설명한다", score: 3 },
      { text: "일상 속 비유와 예시를 들어 누구나 이해하도록 전달한다", score: 4 }
    ],
    competency: "communicationClarity"
  },
  {
    id: "q11",
    question: "내 의견을 전달할 때 나는?",
    options: [
      { text: "내 생각을 말한다", score: 1 },
      { text: "간결하게 핵심만 전달한다", score: 2 },
      { text: "왜 그렇게 생각하는지 근거와 함께 설명한다", score: 3 },
      { text: "상대방이 공감할 수 있게 논리적으로 구조화해서 전달한다", score: 4 }
    ],
    competency: "communicationClarity"
  },
  {
    id: "q12",
    question: "글이나 발표 자료를 만들 때 나는?",
    options: [
      { text: "생각나는 대로 내용을 나열한다", score: 1 },
      { text: "중요한 부분을 강조한다", score: 2 },
      { text: "논리적 흐름을 고려해서 구성한다", score: 3 },
      { text: "메시지가 명확히 전달되도록 체계적으로 설계한다", score: 4 }
    ],
    competency: "communicationClarity"
  },

  // executionOriented (실행력) - 3문항
  {
    id: "q13",
    question: "계획을 세운 후 나는?",
    options: [
      { text: "계획만 세우고 실행은 미루는 편이다", score: 1 },
      { text: "시작은 하지만 끝까지 하지 못하는 경우가 많다", score: 2 },
      { text: "대부분 계획한 것을 실행에 옮긴다", score: 3 },
      { text: "즉시 행동하고 반드시 끝까지 완수한다", score: 4 }
    ],
    competency: "executionOriented"
  },
  {
    id: "q14",
    question: "목표를 달성하는 과정에서 나는?",
    options: [
      { text: "흐름에 맡기고 자연스럽게 진행한다", score: 1 },
      { text: "기본적인 단계를 밟아간다", score: 2 },
      { text: "구체적인 실행 계획을 세우고 따라간다", score: 3 },
      { text: "중간 목표를 정하고 계속 점검하며 적극적으로 추진한다", score: 4 }
    ],
    competency: "executionOriented"
  },
  {
    id: "q15",
    question: "새로운 프로젝트를 시작할 때 나는?",
    options: [
      { text: "일단 머릿속으로만 생각해본다", score: 1 },
      { text: "모든 준비가 완벽해지면 시작한다", score: 2 },
      { text: "작은 것부터 빠르게 시작한다", score: 3 },
      { text: "핵심 기능만 빠르게 만들어 테스트하고 계속 개선한다", score: 4 }
    ],
    competency: "executionOriented"
  },

  // collaborationSignal (협업력) - 3문항
  {
    id: "q16",
    question: "팀 프로젝트에서 나는?",
    options: [
      { text: "내가 맡은 역할만 수행한다", score: 1 },
      { text: "필요할 때 다른 사람을 돕는다", score: 2 },
      { text: "적극적으로 협력하고 의견을 조율한다", score: 3 },
      { text: "팀 전체가 잘되도록 능동적으로 도우며 기여한다", score: 4 }
    ],
    competency: "collaborationSignal"
  },
  {
    id: "q17",
    question: "팀원과 의견이 충돌했을 때 나는?",
    options: [
      { text: "내 의견이 옳다고 주장한다", score: 1 },
      { text: "서로 양보할 점을 찾으려 한다", score: 2 },
      { text: "서로의 입장을 이해하고 조율한다", score: 3 },
      { text: "대화를 통해 더 나은 제3의 해결책을 함께 만든다", score: 4 }
    ],
    competency: "collaborationSignal"
  },
  {
    id: "q18",
    question: "팀원이 어려움을 겪는 것을 발견했을 때 나는?",
    options: [
      { text: "각자 알아서 해결할 문제라고 생각한다", score: 1 },
      { text: "도움을 요청하면 도와준다", score: 2 },
      { text: "먼저 다가가 도움을 제안한다", score: 3 },
      { text: "선제적으로 지원하고 함께 성장할 방법을 찾는다", score: 4 }
    ],
    competency: "collaborationSignal"
  },

  // 추가 균형 문항 (thinkingDepth)
  {
    id: "q19",
    question: "실패를 경험했을 때 나는?",
    options: [
      { text: "아쉽지만 빨리 잊고 넘어간다", score: 1 },
      { text: "무엇이 잘못되었는지 간단히 생각해본다", score: 2 },
      { text: "실패 원인을 분석하고 교훈을 얻는다", score: 3 },
      { text: "깊이 성찰해 근본 원인을 찾고 구체적인 개선 방안을 만든다", score: 4 }
    ],
    competency: "thinkingDepth"
  },
  {
    id: "q20",
    question: "처음 해보는 어려운 과제를 받았을 때 나는?",
    options: [
      { text: "부담스럽고 걱정된다", score: 1 },
      { text: "일단 해보면서 배운다", score: 2 },
      { text: "필요한 것을 학습하고 준비해서 도전한다", score: 3 },
      { text: "성장할 기회로 받아들이고 전략적으로 접근한다", score: 4 }
    ],
    competency: "thinkingDepth"
  }
];

// 진단 시작
async function startAssessment(event, headers) {
  const body = JSON.parse(event.body || "{}");
  const { userId } = body;

  if (!userId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing required field: userId" })
    };
  }

  const assessmentId = `assess-${Date.now()}`;

  const assessmentData = {
    userId,
    assessmentId,
    assessmentType: "initial",
    status: "in_progress",
    questions: ASSESSMENT_QUESTIONS,
    answers: [],
    currentQuestionIndex: 0,
    createdAt: Date.now()
  };

  await dynamoClient.send(new PutCommand({
    TableName: ASSESSMENTS_TABLE,
    Item: assessmentData
  }));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      assessmentId,
      firstQuestion: ASSESSMENT_QUESTIONS[0],
      totalQuestions: ASSESSMENT_QUESTIONS.length
    })
  };
}

// Claude를 사용하여 답변 분석
async function analyzeAnswerWithClaude(question, answer) {
  const prompt = `당신은 학습자의 역량을 분석하는 전문가입니다. 다음 질문과 답변을 분석하여 6가지 역량을 1-10점으로 평가해주세요.

질문: ${question}
답변: ${answer}

평가해야 할 6가지 역량:
1. questionQuality (질문의 질): 깊이 있고 핵심을 파고드는 질문을 하는 능력
2. thinkingDepth (사고의 깊이): 표면적이지 않고 본질을 파악하는 사고 능력
3. creativity (창의성): 새롭고 독창적인 관점이나 아이디어를 제시하는 능력
4. communicationClarity (소통 명확성): 명확하고 이해하기 쉽게 설명하는 능력
5. executionOriented (실행 지향성): 계획을 세우고 실제로 실행하는 능력
6. collaborationSignal (협업 신호): 타인과 협력하고 소통하는 능력

답변 형식:
{
  "questionQuality": <1-10 점수>,
  "thinkingDepth": <1-10 점수>,
  "creativity": <1-10 점수>,
  "communicationClarity": <1-10 점수>,
  "executionOriented": <1-10 점수>,
  "collaborationSignal": <1-10 점수>,
  "analysis": "<간단한 분석 코멘트>"
}

JSON만 반환해주세요.`;

  try {
    const response = await bedrockClient.send(new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1000,
        temperature: 0.3,
        messages: [
          { role: "user", content: prompt }
        ]
      })
    }));

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const analysisText = responseBody.content[0].text;

    // JSON 추출 (```json ``` 태그가 있을 수 있음)
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return JSON.parse(analysisText);
  } catch (error) {
    console.error("Claude analysis error:", error);
    throw error;
  }
}

// 답변 제출 (객관식)
async function submitAssessmentAnswer(event, headers) {
  const body = JSON.parse(event.body || "{}");
  const { userId, assessmentId, questionId, selectedOptionIndex } = body;

  if (!userId || !assessmentId || !questionId || selectedOptionIndex === undefined) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing required fields" })
    };
  }

  try {
    // 1. 진단 데이터 가져오기
    const getResult = await dynamoClient.send(new GetCommand({
      TableName: ASSESSMENTS_TABLE,
      Key: { userId, assessmentId }
    }));

    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Assessment not found" })
      };
    }

    const assessment = getResult.Item;
    const questionIndex = assessment.questions.findIndex(q => q.id === questionId);

    if (questionIndex === -1) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Question not found" })
      };
    }

    const question = assessment.questions[questionIndex];
    const selectedOption = question.options[selectedOptionIndex];

    if (!selectedOption) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid option index" })
      };
    }

    // 2. 객관식 답변 저장 (점수 포함)
    const answerData = {
      questionId,
      selectedOptionIndex,
      selectedText: selectedOption.text,
      score: selectedOption.score,
      competency: question.competency,
      timestamp: Date.now()
    };

    assessment.answers = assessment.answers || [];
    assessment.answers.push(answerData);
    assessment.currentQuestionIndex = questionIndex + 1;

    // 4. 모든 질문을 완료했는지 확인
    const isCompleted = assessment.currentQuestionIndex >= assessment.questions.length;

    if (isCompleted) {
      // 최종 점수 계산
      const finalScores = calculateAssessmentFinalScores(assessment.answers);
      assessment.status = "completed";
      assessment.results = finalScores;
      assessment.completedAt = Date.now();

      // 사용자 역량 테이블에 저장
      await saveCompetenciesToUserTable(userId, finalScores);
    }

    // 5. 진단 데이터 업데이트
    await dynamoClient.send(new PutCommand({
      TableName: ASSESSMENTS_TABLE,
      Item: assessment
    }));

    // 6. 다음 질문 반환
    const nextQuestion = isCompleted
      ? null
      : assessment.questions[assessment.currentQuestionIndex];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        isCompleted,
        nextQuestion,
        progress: {
          current: assessment.currentQuestionIndex,
          total: assessment.questions.length
        },
        results: isCompleted ? assessment.results : null
      })
    };
  } catch (error) {
    console.error("Submit answer error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

// 최종 점수 계산 (객관식 - 역량별 평균)
function calculateAssessmentFinalScores(answers) {
  const competencies = [
    "questionQuality",
    "thinkingDepth",
    "creativity",
    "communicationClarity",
    "executionOriented",
    "collaborationSignal"
  ];

  const scores = {};
  const competencyCounts = {};

  // 각 역량별 점수 합계 및 문항 수 계산
  for (const competency of competencies) {
    scores[competency] = 0;
    competencyCounts[competency] = 0;
  }

  for (const answer of answers) {
    const comp = answer.competency;
    if (scores[comp] !== undefined) {
      scores[comp] += answer.score; // 1-4 점수
      competencyCounts[comp]++;
    }
  }

  // 평균 계산 및 10점 만점으로 변환
  for (const competency of competencies) {
    if (competencyCounts[competency] > 0) {
      const avgScore = scores[competency] / competencyCounts[competency];
      // 1-4점을 1-10점으로 변환: (score - 1) / 3 * 9 + 1
      scores[competency] = Math.round(((avgScore - 1) / 3) * 9 + 1);
    } else {
      scores[competency] = 5; // 기본값
    }
  }

  return scores;
}

// 사용자 역량 테이블에 저장
async function saveCompetenciesToUserTable(userId, scores) {
  const competencies = Object.keys(scores);

  for (const competency of competencies) {
    await dynamoClient.send(new PutCommand({
      TableName: COMPETENCIES_TABLE,
      Item: {
        userId,
        competency,
        score: scores[competency],
        updatedAt: Date.now(),
        totalMessages: 0,
        historicalScores: [
          {
            score: scores[competency],
            timestamp: Date.now(),
            source: "initial_assessment"
          }
        ]
      }
    }));
  }
}

// 진단 결과 조회
async function getAssessmentResults(event, headers) {
  const pathParts = event.path.split('/');
  const userId = pathParts[3]; // /assessment/results/{userId}

  try {
    // 사용자의 가장 최근 진단 결과 조회
    const result = await dynamoClient.send(new QueryCommand({
      TableName: ASSESSMENTS_TABLE,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId
      },
      ScanIndexForward: false, // 최신순
      Limit: 1
    }));

    if (!result.Items || result.Items.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "No assessment found for this user" })
      };
    }

    const assessment = result.Items[0];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        assessmentId: assessment.assessmentId,
        status: assessment.status,
        results: assessment.results,
        completedAt: assessment.completedAt,
        createdAt: assessment.createdAt
      })
    };
  } catch (error) {
    console.error("Get assessment results error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

// 추천 봇 조회
async function getRecommendedTemplates(event, headers) {
  const pathParts = event.path.split('/');
  const userId = pathParts[pathParts.length - 1]; // /bots/recommended/{userId}

  // Query parameter로 추천 모드 선택 (competency | pattern | hybrid)
  const mode = event.queryStringParameters?.mode || 'hybrid';

  try {
    // 1. 사용자 역량 조회
    const competenciesResult = await dynamoClient.send(new QueryCommand({
      TableName: COMPETENCIES_TABLE,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId
      }
    }));

    // 역량 데이터를 객체로 변환
    const userCompetencies = {};
    if (competenciesResult.Items) {
      for (const item of competenciesResult.Items) {
        userCompetencies[item.competency] = item.score;
      }
    }

    // 역량 데이터가 없으면 빈 배열 반환
    if (Object.keys(userCompetencies).length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify([])
      };
    }

    // 2. 모든 템플릿 조회
    const templatesResult = await dynamoClient.send(new ScanCommand({
      TableName: TEMPLATES_TABLE
    }));

    const templates = templatesResult.Items || [];

    // 3. 패턴 기반 추천을 위한 학습 패턴 데이터 조회 (pattern 또는 hybrid 모드)
    let botPreferences = null;
    if (mode === 'pattern' || mode === 'hybrid') {
      try {
        const invokeCommand = new InvokeCommand({
          FunctionName: 'ai-co-learner-learning-pattern-analyzer',
          InvocationType: 'RequestResponse',
          Payload: JSON.stringify({ userId }),
        });

        const lambdaResponse = await lambdaClient.send(invokeCommand);
        const responsePayload = JSON.parse(new TextDecoder().decode(lambdaResponse.Payload));

        if (responsePayload.statusCode === 200) {
          const analysisData = JSON.parse(responsePayload.body);
          botPreferences = analysisData.botPreferences;
        }
      } catch (error) {
        console.error('Failed to fetch bot preferences:', error);
        // 패턴 데이터를 가져올 수 없으면 역량 기반으로 폴백
      }
    }

    // 4. 각 템플릿의 추천 점수 계산
    const scoredTemplates = templates.map(template => {
      let competencyScore = 0;
      let patternScore = 0;

      // 4-1. 역량 기반 점수 (기존 로직)
      if (mode === 'competency' || mode === 'hybrid') {
        if (template.recommendedFor && template.recommendedFor.competencyBelow) {
          const conditions = template.recommendedFor.competencyBelow;

          // 조건을 만족하는 역량이 있으면 점수 증가
          for (const [competency, threshold] of Object.entries(conditions)) {
            const userScore = userCompetencies[competency] || 0;
            if (userScore < threshold) {
              // 역량이 낮을수록 높은 점수 (추천 우선순위)
              competencyScore += (threshold - userScore);
            }
          }
        }
      }

      // 4-2. 패턴 기반 점수
      if ((mode === 'pattern' || mode === 'hybrid') && botPreferences) {
        // 선호 봇 타입 일치 (+30점)
        if (botPreferences.preferredBotTypes && template.baseType) {
          const preferredType = botPreferences.preferredBotTypes.find(
            bt => bt.baseType === template.baseType
          );
          if (preferredType) {
            patternScore += 30;
          }
        }

        // 선호 주제(역량) 일치 (+20점)
        if (botPreferences.preferredTopics && template.primaryCompetencies) {
          const templateCompetencies = template.primaryCompetencies || [];
          const matchingTopics = botPreferences.preferredTopics.filter(topic =>
            templateCompetencies.includes(topic.competency)
          );
          if (matchingTopics.length > 0) {
            patternScore += 20 * matchingTopics.length;
          }
        }

        // 학습 시간대 일치 (+10점)
        // 예: 아침형 사용자에게 "모닝 코치" 봇 추천
        if (botPreferences.learningTimePattern && template.recommendedTimePattern) {
          if (template.recommendedTimePattern === botPreferences.learningTimePattern) {
            patternScore += 10;
          }
        }

        // 대화 길이 선호도 일치 (+10점)
        if (botPreferences.conversationLengthPreference && template.conversationStyle) {
          if (template.conversationStyle === botPreferences.conversationLengthPreference) {
            patternScore += 10;
          }
        }
      }

      // 최종 점수 계산
      let finalScore = 0;
      if (mode === 'competency') {
        finalScore = competencyScore;
      } else if (mode === 'pattern') {
        finalScore = patternScore;
      } else { // hybrid
        finalScore = (competencyScore * 0.6) + (patternScore * 0.4);
      }

      return {
        ...template,
        recommendationScore: finalScore,
        competencyScore,
        patternScore
      };
    });

    // 5. 점수순으로 정렬하고 상위 3개 반환
    const recommendedTemplates = scoredTemplates
      .filter(t => t.recommendationScore > 0)
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .slice(0, 3)
      .map(({ templateId, name, description, themeColor, baseType, primaryCompetencies, secondaryCompetencies, recommendationScore }) => ({
        id: templateId,
        templateId,
        name,
        description,
        themeColor,
        baseType,
        primaryCompetencies,
        secondaryCompetencies,
        recommendationScore: Math.round(recommendationScore)
      }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(recommendedTemplates)
    };
  } catch (error) {
    console.error("Get recommended templates error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

// Quest 관련 함수
async function getUserQuests(event, headers) {
  try {
    const userId = event.pathParameters?.userId || event.path.split('/').pop();
    const today = new Date().toISOString().split('T')[0];

    console.log('Getting quests for userId:', userId, 'date:', today);

    const response = await dynamoClient.send(new QueryCommand({
      TableName: QUESTS_TABLE,
      KeyConditionExpression: 'userId = :userId AND questDate = :date',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':date': today
      }
    }));

    if (!response.Items || response.Items.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          quests: [],
          message: 'No quests available for today'
        })
      };
    }

    const questData = response.Items[0];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(questData)
    };
  } catch (error) {
    console.error("Get user quests error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

// 역량 히스토리 조회 함수
async function getCompetencyHistory(event, headers) {
  try {
    const pathParts = event.path.split('/');
    const userId = pathParts[pathParts.indexOf('users') + 1];
    const days = parseInt(event.queryStringParameters?.days || '30', 10);

    console.log('Getting competency history for userId:', userId, 'days:', days);

    // 시작 날짜 계산 (days일 전)
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    const endTimestamp = Math.floor(endDate.getTime() / 1000);

    // learning-analytics 테이블에서 분석 데이터 조회
    const response = await dynamoClient.send(new QueryCommand({
      TableName: ANALYTICS_TABLE,
      KeyConditionExpression: 'userId = :userId AND #timestamp BETWEEN :start AND :end',
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':start': startTimestamp,
        ':end': endTimestamp
      },
      ScanIndexForward: true // 오래된 것부터 정렬
    }));

    if (!response.Items || response.Items.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          history: [],
          message: 'No competency history data available'
        })
      };
    }

    // 일별로 역량 점수 집계
    const dailyAverages = {};

    response.Items.forEach(item => {
      const date = new Date(item.timestamp * 1000).toISOString().split('T')[0]; // YYYY-MM-DD
      const scores = item.competencyScores || {};

      if (!dailyAverages[date]) {
        dailyAverages[date] = {
          date,
          competencies: {},
          count: {}
        };
      }

      // 각 역량별 점수 누적
      Object.entries(scores).forEach(([competency, score]) => {
        if (!dailyAverages[date].competencies[competency]) {
          dailyAverages[date].competencies[competency] = 0;
          dailyAverages[date].count[competency] = 0;
        }
        dailyAverages[date].competencies[competency] += score;
        dailyAverages[date].count[competency] += 1;
      });
    });

    // 평균 계산 및 포맷팅
    const history = Object.values(dailyAverages).map(day => {
      const avgScores = {};
      Object.entries(day.competencies).forEach(([competency, total]) => {
        avgScores[competency] = Math.round(total / day.count[competency]);
      });

      return {
        date: day.date,
        competencies: avgScores,
        messageCount: Object.values(day.count).reduce((sum, c) => sum + c, 0)
      };
    });

    // 날짜순 정렬
    history.sort((a, b) => a.date.localeCompare(b.date));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        history,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        totalDays: history.length
      })
    };
  } catch (error) {
    console.error("Get competency history error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

// 사용자 배지 조회 함수
async function getUserAchievements(event, headers) {
  try {
    const userId = event.pathParameters?.userId || event.path.split('/').pop();

    console.log('Getting achievements for userId:', userId);

    // 배지 정의 (achievement-evaluator와 동일)
    const ACHIEVEMENTS = {
      // 메시지 관련
      'first-message': {
        id: 'first-message',
        name: 'First Steps',
        description: '첫 메시지를 보냈습니다',
        icon: 'MessageSquare',
        type: 'milestone',
        tier: 'bronze',
        criteria: { messageCount: 1 }
      },
      'chatty-learner': {
        id: 'chatty-learner',
        name: 'Chatty Learner',
        description: '100개의 메시지를 보냈습니다',
        icon: 'MessageSquare',
        type: 'milestone',
        tier: 'silver',
        criteria: { messageCount: 100 }
      },
      'conversation-master': {
        id: 'conversation-master',
        name: 'Conversation Master',
        description: '1000개의 메시지를 보냈습니다',
        icon: 'MessageSquare',
        type: 'milestone',
        tier: 'gold',
        criteria: { messageCount: 1000 }
      },
      // 퀘스트 관련
      'quest-starter': {
        id: 'quest-starter',
        name: 'Quest Starter',
        description: '첫 퀘스트를 완료했습니다',
        icon: 'Target',
        type: 'milestone',
        tier: 'bronze',
        criteria: { questsCompleted: 1 }
      },
      'quest-warrior': {
        id: 'quest-warrior',
        name: 'Quest Warrior',
        description: '10개의 퀘스트를 완료했습니다',
        icon: 'Target',
        type: 'milestone',
        tier: 'silver',
        criteria: { questsCompleted: 10 }
      },
      'quest-legend': {
        id: 'quest-legend',
        name: 'Quest Legend',
        description: '50개의 퀘스트를 완료했습니다',
        icon: 'Target',
        type: 'milestone',
        tier: 'gold',
        criteria: { questsCompleted: 50 }
      },
      // 역량 관련
      'question-king': {
        id: 'question-king',
        name: 'Question King',
        description: '질문력 80점 이상 달성',
        icon: 'Crown',
        type: 'competency',
        tier: 'gold',
        criteria: { competency: 'questionQuality', score: 80 }
      },
      'deep-thinker': {
        id: 'deep-thinker',
        name: 'Deep Thinker',
        description: '사고력 80점 이상 달성',
        icon: 'Brain',
        type: 'competency',
        tier: 'gold',
        criteria: { competency: 'thinkingDepth', score: 80 }
      },
      'creative-genius': {
        id: 'creative-genius',
        name: 'Creative Genius',
        description: '창의력 80점 이상 달성',
        icon: 'Sparkles',
        type: 'competency',
        tier: 'gold',
        criteria: { competency: 'creativity', score: 80 }
      },
      'great-communicator': {
        id: 'great-communicator',
        name: 'Great Communicator',
        description: '소통력 80점 이상 달성',
        icon: 'MessageCircle',
        type: 'competency',
        tier: 'gold',
        criteria: { competency: 'communicationClarity', score: 80 }
      },
      'action-taker': {
        id: 'action-taker',
        name: 'Action Taker',
        description: '실행력 80점 이상 달성',
        icon: 'Rocket',
        type: 'competency',
        tier: 'gold',
        criteria: { competency: 'executionOriented', score: 80 }
      },
      'team-player': {
        id: 'team-player',
        name: 'Team Player',
        description: '협업력 80점 이상 달성',
        icon: 'Users',
        type: 'competency',
        tier: 'gold',
        criteria: { competency: 'collaborationSignal', score: 80 }
      },
      // 연속 활동
      'week-warrior': {
        id: 'week-warrior',
        name: 'Week Warrior',
        description: '7일 연속 활동',
        icon: 'Flame',
        type: 'streak',
        tier: 'silver',
        criteria: { consecutiveDays: 7 }
      },
      'month-master': {
        id: 'month-master',
        name: 'Month Master',
        description: '30일 연속 활동',
        icon: 'Flame',
        type: 'streak',
        tier: 'gold',
        criteria: { consecutiveDays: 30 }
      }
    };

    // 사용자가 획득한 배지 조회
    const response = await dynamoClient.send(new QueryCommand({
      TableName: ACHIEVEMENTS_TABLE,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    }));

    const unlockedAchievements = (response.Items || []).map(item => ({
      ...ACHIEVEMENTS[item.achievementId],
      unlockedAt: item.unlockedAt,
      progress: item.progress || 100
    }));

    // 전체 배지 목록 (획득 여부 표시)
    const allAchievements = Object.values(ACHIEVEMENTS).map(achievement => {
      const unlocked = response.Items?.find(item => item.achievementId === achievement.id);
      return {
        ...achievement,
        unlocked: !!unlocked,
        unlockedAt: unlocked?.unlockedAt,
        progress: unlocked?.progress || 0
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        unlockedAchievements,
        allAchievements,
        totalUnlocked: unlockedAchievements.length,
        totalAchievements: Object.keys(ACHIEVEMENTS).length
      })
    };
  } catch (error) {
    console.error("Get user achievements error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

// 학습 패턴 분석 조회 함수
async function getLearningAnalysis(event, headers) {
  try {
    const userId = event.pathParameters?.userId || event.path.split('/').pop();

    console.log('Getting learning analysis for userId:', userId);

    // learning-pattern-analyzer Lambda 함수 호출
    const invokeCommand = new InvokeCommand({
      FunctionName: 'ai-co-learner-learning-pattern-analyzer',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({ userId }),
    });

    const lambdaResponse = await lambdaClient.send(invokeCommand);
    const responsePayload = JSON.parse(new TextDecoder().decode(lambdaResponse.Payload));

    // Lambda 함수가 에러를 반환한 경우
    if (responsePayload.statusCode && responsePayload.statusCode !== 200) {
      return {
        statusCode: responsePayload.statusCode,
        headers,
        body: responsePayload.body,
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(responsePayload),
    };
  } catch (error) {
    console.error("Get learning analysis error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}
