import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand, ScanCommand, DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

// Bedrock 클라이언트 (us-east-1 - Cross Region)
const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });

// DynamoDB 클라이언트 (ap-northeast-2 - 서울)
const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "ap-northeast-2" })
);

const SESSIONS_TABLE = "ai-co-learner-chat-sessions";
const TEMPLATES_TABLE = "ai-co-learner-bot-templates";
const USERS_TABLE = "ai-co-learner-users";
const USER_BOTS_TABLE = "ai-co-learner-user-bots";
// Claude 3 Haiku - 빠르고 저렴하며 한국어 성능 우수
const MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0";

export const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  };

  try {
    // OPTIONS 요청 처리 (CORS preflight)
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'OK' })
      };
    }

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

    // GET /users/{userId}/competencies - 사용자 역량 조회
    if (method === 'GET' && path.includes('/users/') && path.includes('/competencies')) {
      return await getUserCompetencies(event, headers);
    }

    // GET /users/{userId} - 사용자 프로필 조회
    if (method === 'GET' && path.includes('/users/')) {
      return await getUserProfile(event, headers);
    }

    // POST /users - 사용자 프로필 생성
    if (method === 'POST' && path.includes('/users') && !path.includes('/update')) {
      return await createUserProfile(event, headers);
    }

    // POST /users/update - 사용자 프로필 업데이트
    if (method === 'POST' && path.includes('/users/update')) {
      return await updateUserProfile(event, headers);
    }

    // POST /chat - 채팅 메시지 전송 (기존 기능)
    if (method === 'POST' && path.includes('/chat')) {
      return await sendChatMessage(event, headers);
    }

    // Admin APIs
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
      return await getAllUsers(headers);
    }

    if (method === 'POST' && path.includes('/admin/users/update-role')) {
      return await updateUserRole(event, headers);
    }

    if (method === 'POST' && path.includes('/admin/users/block')) {
      return await blockUser(event, headers);
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
      headers,
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
}

// 사용자 봇 생성
async function createUserBot(event, headers) {
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
      description: template.description || ''
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
      description: template.description || ''
    })
  };
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
  const body = JSON.parse(event.body || "{}");
  const { userId, username, name, role = 'USER', level = 1, title = '초보 탐험가' } = body;

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
}

// 사용자 프로필 업데이트
async function updateUserProfile(event, headers) {
  const body = JSON.parse(event.body || "{}");
  const { userId, name } = body;

  if (!userId || !name) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing required fields: userId, name" })
    };
  }

  const USERS_TABLE = "ai-co-learner-users";

  try {
    const result = await dynamoClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: "SET #name = :name, updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#name": "name"
      },
      ExpressionAttributeValues: {
        ":name": name,
        ":updatedAt": new Date().toISOString()
      },
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

// ===== ADMIN APIs =====

// 템플릿 생성
async function createTemplate(event, headers) {
  const body = JSON.parse(event.body || "{}");
  const { name, description, systemPrompt, themeColor } = body;

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
      createdAt: new Date().toISOString()
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
      themeColor
    })
  };
}

// 템플릿 수정
async function updateTemplate(event, headers) {
  const body = JSON.parse(event.body || "{}");
  const { templateId, name, description, systemPrompt, themeColor } = body;

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
}

// 템플릿 삭제
async function deleteTemplate(event, headers) {
  const body = JSON.parse(event.body || "{}");
  const { templateId } = body;

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
async function getAllUsers(headers) {
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
  const { userId, role } = body;

  console.log("Looking for userId:", userId);
  console.log("New role:", role);

  if (!userId || !role) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing required fields: userId, role" })
    };
  }

  // Validate role value
  if (!['USER', 'ADMIN'].includes(role)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid role. Must be USER or ADMIN" })
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
