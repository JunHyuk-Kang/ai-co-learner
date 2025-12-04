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
const ASSESSMENTS_TABLE = "ai-co-learner-assessments";
const COMPETENCIES_TABLE = "ai-co-learner-user-competencies";
// Claude 3 Haiku - 빠르고 저렴하며 한국어 성능 우수
const MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0";

// CORS headers defined at top level
const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
};

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
      return await getAllUsers(headers);
    }

    if (method === 'POST' && path.includes('/admin/users/update-role')) {
      return await updateUserRole(event, headers);
    }

    if (method === 'POST' && path.includes('/admin/users/block')) {
      return await blockUser(event, headers);
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

    // POST /chat - 채팅 메시지 전송 (기존 기능)
    if (method === 'POST' && path.includes('/chat')) {
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

// ===== ASSESSMENT APIs =====

// 역량 평가를 위한 질문 템플릿
const ASSESSMENT_QUESTIONS = [
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

// 답변 제출
async function submitAssessmentAnswer(event, headers) {
  const body = JSON.parse(event.body || "{}");
  const { userId, assessmentId, questionId, answer } = body;

  if (!userId || !assessmentId || !questionId || !answer) {
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

    // 2. Claude로 답변 분석
    const analysis = await analyzeAnswerWithClaude(question.question, answer);

    // 3. 답변 및 분석 결과 저장
    const answerData = {
      questionId,
      answer,
      analysis,
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
        analysis: analysis.analysis,
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

// 최종 점수 계산 (모든 답변의 평균)
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

  for (const competency of competencies) {
    const sum = answers.reduce((acc, answer) => {
      return acc + (answer.analysis[competency] || 0);
    }, 0);
    // 1-10 스케일을 10-100 스케일로 변환 (육각형 차트용)
    const avgScore = sum / answers.length;
    scores[competency] = Math.round(avgScore * 10); // 10배로 변환하여 정수로
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
