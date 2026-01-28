import { ScanCommand, GetCommand, PutCommand, DeleteCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { AdminSetUserPasswordCommand } from "@aws-sdk/client-cognito-identity-provider";
import { dynamoClient, cognitoClient } from "../lib/clients.mjs";
import { TABLES, COGNITO_USER_POOL_ID } from "../lib/config.mjs";
import { checkUserRole } from "../lib/utils.mjs";

export async function createTemplate(event, headers) {
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
      organizationId,
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
      TableName: TABLES.TEMPLATES,
      Item: {
        templateId,
        organizationId: organizationId || 'GLOBAL',
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
        organizationId: organizationId || 'GLOBAL',
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

export async function updateTemplate(event, headers) {
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
    if (body.organizationId !== undefined) {
      updateExpression.push("organizationId = :organizationId");
      expressionAttributeValues[":organizationId"] = body.organizationId;
    }

    updateExpression.push("updatedAt = :updatedAt");
    expressionAttributeValues[":updatedAt"] = new Date().toISOString();

    const result = await dynamoClient.send(new UpdateCommand({
      TableName: TABLES.TEMPLATES,
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

export async function deleteTemplate(event, headers) {
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
    TableName: TABLES.TEMPLATES,
    Key: { templateId }
  }));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ message: "Template deleted successfully", templateId })
  };
}

export async function getAllUsers(event, headers) {
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
    TableName: TABLES.USERS
  }));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(response.Items || [])
  };
}

export async function updateUserRole(event, headers) {
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
      TableName: TABLES.USERS,
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

export async function getUsageStats(event, headers) {
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
        TableName: TABLES.USAGE_TRACKING,
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
        TableName: TABLES.USAGE_TRACKING
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
          TableName: TABLES.USERS,
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

export async function getDashboardStats(event, headers) {
  try {
    // Query parameters
    const adminUserId = event.queryStringParameters?.adminUserId;

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

    const now = Date.now();
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

    // 1. 오늘 활성 사용자 수 (chat-sessions에서 오늘 메시지를 보낸 사용자)
    const sessionsResult = await dynamoClient.send(new ScanCommand({
      TableName: TABLES.SESSIONS,
      FilterExpression: '#timestamp >= :todayStart',
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':todayStart': todayStart
      }
    }));

    const todayMessages = sessionsResult.Items || [];
    const activeUsersToday = new Set(todayMessages.map(msg => msg.userId)).size;
    const totalMessagesToday = todayMessages.length;
    const avgMessagesPerUser = activeUsersToday > 0 ? (totalMessagesToday / activeUsersToday).toFixed(1) : 0;

    // 2. 전체 사용자 수 및 역량 평균
    const usersResult = await dynamoClient.send(new ScanCommand({
      TableName: TABLES.USERS
    }));

    const allUsers = usersResult.Items || [];
    const totalUsers = allUsers.length;

    // 7일 미접속 사용자 (이탈 위험)
    const inactiveUsers7d = allUsers.filter(user => {
      const lastLogin = user.lastLoginAt ? new Date(user.lastLoginAt).getTime() : 0;
      return (now - lastLogin) > sevenDaysAgo;
    }).length;

    // 3. 역량 평균 점수
    const competenciesResult = await dynamoClient.send(new ScanCommand({
      TableName: TABLES.COMPETENCIES
    }));

    const allCompetencies = competenciesResult.Items || [];
    let totalCompetencyScore = 0;
    let competencyCount = 0;

    allCompetencies.forEach(comp => {
      const scores = comp.competencyScores || {};
      const scoreValues = Object.values(scores).filter(s => typeof s === 'number');
      if (scoreValues.length > 0) {
        totalCompetencyScore += scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length;
        competencyCount++;
      }
    });

    const avgCompetencyScore = competencyCount > 0
      ? (totalCompetencyScore / competencyCount).toFixed(1)
      : 0;

    // 4. 인기 봇 Top 3 (user-bots 테이블에서 봇별 사용 빈도)
    const userBotsResult = await dynamoClient.send(new ScanCommand({
      TableName: TABLES.USER_BOTS
    }));

    const userBots = userBotsResult.Items || [];
    const botUsageCount = {};

    userBots.forEach(bot => {
      const templateId = bot.templateId;
      botUsageCount[templateId] = (botUsageCount[templateId] || 0) + 1;
    });

    // 봇 이름 조회
    const templatesResult = await dynamoClient.send(new ScanCommand({
      TableName: TABLES.TEMPLATES
    }));

    const templates = templatesResult.Items || [];
    const templateMap = {};
    templates.forEach(tmpl => {
      templateMap[tmpl.templateId] = tmpl.name;
    });

    const topBots = Object.entries(botUsageCount)
      .map(([botId, count]) => ({
        botId,
        name: templateMap[botId] || 'Unknown Bot',
        usageCount: count
      }))
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 3);

    // 5. 퀘스트 완료율 (오늘)
    const questsResult = await dynamoClient.send(new ScanCommand({
      TableName: TABLES.QUESTS
    }));

    const todayDate = new Date().toISOString().split('T')[0];
    const todayQuests = (questsResult.Items || []).filter(quest =>
      quest.questDate === todayDate
    );

    let totalQuests = 0;
    let completedQuests = 0;

    todayQuests.forEach(userQuest => {
      const quests = userQuest.quests || [];
      totalQuests += quests.length;
      completedQuests += quests.filter(q => q.completed).length;
    });

    const questCompletionRate = totalQuests > 0
      ? (completedQuests / totalQuests * 100).toFixed(0)
      : 0;

    // 6. 시간대별 활동 (최근 24시간)
    const hourlyActivity = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, '0')}:00`,
      activeUsers: 0,
      messages: 0
    }));

    todayMessages.forEach(msg => {
      const hour = new Date(msg.timestamp).getHours();
      if (hour >= 0 && hour < 24) {
        hourlyActivity[hour].messages++;
      }
    });

    // 시간대별 활성 사용자 수 계산
    const hourlyUserSets = Array.from({ length: 24 }, () => new Set());
    todayMessages.forEach(msg => {
      const hour = new Date(msg.timestamp).getHours();
      if (hour >= 0 && hour < 24) {
        hourlyUserSets[hour].add(msg.userId);
      }
    });

    hourlyActivity.forEach((item, i) => {
      item.activeUsers = hourlyUserSets[i].size;
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        today: {
          activeUsers: activeUsersToday,
          totalMessages: totalMessagesToday,
          avgMessagesPerUser: parseFloat(avgMessagesPerUser),
          questCompletionRate: parseFloat(questCompletionRate),
          completedQuests,
          totalQuests: totalQuests
        },
        overall: {
          totalUsers,
          avgCompetencyScore: parseFloat(avgCompetencyScore),
          inactiveUsers7d
        },
        topBots,
        hourlyActivity,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

export async function blockUser(event, headers) {
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
    TableName: TABLES.USERS,
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

export async function updateUserInfo(event, headers) {
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
        TableName: TABLES.USERS,
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

export async function getOrganizationList(event, headers) {
  try {
    const adminUserId = event.queryStringParameters?.adminUserId;

    console.log('Getting organization list, adminUserId:', adminUserId);

    // 관리자 권한 확인
    const adminUser = await dynamoClient.send(new GetCommand({
      TableName: TABLES.USERS,
      Key: { userId: adminUserId }
    }));

    if (!adminUser.Item || adminUser.Item.role !== 'ADMIN') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'FORBIDDEN', message: 'Admin access required' })
      };
    }

    // 모든 사용자 조회
    const usersResponse = await dynamoClient.send(new ScanCommand({
      TableName: TABLES.USERS
    }));

    const users = usersResponse.Items || [];

    // 조직별 사용자 집계
    const organizationMap = new Map();

    users.forEach(user => {
      const org = user.organization || '(미지정)';

      if (!organizationMap.has(org)) {
        organizationMap.set(org, {
          name: org,
          userCount: 0,
          tierDistribution: { FREE: 0, TRIAL: 0, PREMIUM: 0, UNLIMITED: 0 }
        });
      }

      const orgData = organizationMap.get(org);
      orgData.userCount++;

      const tier = user.subscriptionTier || 'UNLIMITED';
      orgData.tierDistribution[tier]++;
    });

    // Map을 배열로 변환하고 사용자 수로 정렬
    const organizations = Array.from(organizationMap.values())
      .sort((a, b) => b.userCount - a.userCount);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        organizations,
        totalOrganizations: organizations.length,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Get organization list error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'SERVER_ERROR', message: error.message })
    };
  }
}

export async function updateGroupTier(event, headers) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { adminUserId, organization, newTier } = body;

    console.log('Updating group tier:', { adminUserId, organization, newTier });

    // 관리자 권한 확인
    const adminUser = await dynamoClient.send(new GetCommand({
      TableName: TABLES.USERS,
      Key: { userId: adminUserId }
    }));

    if (!adminUser.Item || adminUser.Item.role !== 'ADMIN') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'FORBIDDEN', message: 'Admin access required' })
      };
    }

    // 유효한 티어인지 확인
    const validTiers = ['FREE', 'TRIAL', 'PREMIUM', 'UNLIMITED'];
    if (!validTiers.includes(newTier)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'VALIDATION_ERROR', message: `Invalid tier: ${newTier}` })
      };
    }

    // 해당 조직의 모든 사용자 조회
    const usersResponse = await dynamoClient.send(new ScanCommand({
      TableName: TABLES.USERS,
      FilterExpression: 'organization = :org',
      ExpressionAttributeValues: {
        ':org': organization
      }
    }));

    const users = usersResponse.Items || [];

    if (users.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: 'NOT_FOUND',
          message: `No users found in organization: ${organization}`
        })
      };
    }

    // 티어별 할당량 설정
    const tierLimits = {
      'FREE': 50,
      'TRIAL': 1000,
      'PREMIUM': 1500,
      'UNLIMITED': -1
    };

    const today = new Date().toISOString().split('T')[0];
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const firstDayNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1)
      .toISOString().split('T')[0];

    // 각 사용자의 티어 업데이트
    const updatePromises = users.map(async (user) => {
      const oldTier = user.subscriptionTier || 'UNLIMITED';

      // 이미 같은 티어면 스킵
      if (oldTier === newTier) {
        return { userId: user.userId, skipped: true, reason: 'Same tier' };
      }

      // 구독 티어 업데이트
      const updateExpression = [
        'subscriptionTier = :tier',
        'messageQuota = :quota',
        'subscriptionMetadata = :metadata'
      ];

      const expressionValues = {
        ':tier': newTier,
        ':quota': {
          monthlyLimit: tierLimits[newTier],
          currentMonthUsage: user.messageQuota?.currentMonthUsage || 0,
          lastResetDate: today,
          nextResetDate: firstDayNextMonth
        },
        ':metadata': {
          upgradedAt: new Date().toISOString(),
          upgradedFrom: oldTier,
          autoRenew: true,
          billingCycle: newTier === 'UNLIMITED' || newTier === 'PREMIUM' ? 'lifetime' : 'monthly'
        }
      };

      // TRIAL 티어인 경우 체험 기간 설정
      if (newTier === 'TRIAL') {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 30);

        updateExpression.push('trialPeriod = :trialPeriod');
        expressionValues[':trialPeriod'] = {
          startDate: new Date().toISOString(),
          endDate: trialEnd.toISOString(),
          isExpired: false,
          daysRemaining: 30
        };
      } else {
        // TRIAL이 아니면 체험 기간 제거
        updateExpression.push('trialPeriod = :null');
        expressionValues[':null'] = null;
      }

      await dynamoClient.send(new UpdateCommand({
        TableName: TABLES.USERS,
        Key: { userId: user.userId },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeValues: expressionValues
      }));

      return { userId: user.userId, oldTier, newTier, updated: true };
    });

    const results = await Promise.all(updatePromises);

    const updatedCount = results.filter(r => r.updated).length;
    const skippedCount = results.filter(r => r.skipped).length;

    console.log('Group tier update completed:', {
      organization,
      newTier,
      updatedCount,
      skippedCount
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Organization "${organization}" users updated to ${newTier}`,
        organization,
        newTier,
        totalUsers: users.length,
        updatedCount,
        skippedCount,
        results
      })
    };
  } catch (error) {
    console.error('Update group tier error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'SERVER_ERROR', message: error.message })
    };
  }
}
