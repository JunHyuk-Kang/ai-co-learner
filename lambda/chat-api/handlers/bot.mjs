import { ScanCommand, GetCommand, PutCommand, DeleteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { InvokeCommand } from "@aws-sdk/client-lambda";
import { dynamoClient, lambdaClient } from "../lib/clients.mjs";
import { TABLES } from "../lib/config.mjs";
import { getTemplatesByOrganization } from "../lib/utils.mjs";

export async function getTemplates(event, headers) {
  try {
    const userId = event.queryStringParameters?.userId;
    let items;

    if (userId) {
      // userId가 있으면 사용자 조직 조회 후 해당 조직 + GLOBAL 템플릿만 반환
      const userResult = await dynamoClient.send(new GetCommand({
        TableName: TABLES.USERS,
        Key: { userId }
      }));
      const userOrganization = userResult.Item?.organization || null;
      items = await getTemplatesByOrganization(userOrganization);
    } else {
      // userId가 없으면 전체 반환 (관리자 호환)
      const response = await dynamoClient.send(new ScanCommand({
        TableName: TABLES.TEMPLATES
      }));
      items = response.Items || [];
    }

    const templates = items.map(item => ({
      id: item.templateId,
      name: item.name,
      description: item.description,
      systemPrompt: item.systemPrompt,
      themeColor: item.themeColor,
      organizationId: item.organizationId || 'GLOBAL',
      baseType: item.baseType,
      primaryCompetencies: item.primaryCompetencies,
      secondaryCompetencies: item.secondaryCompetencies,
      recommendedFor: item.recommendedFor
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

export async function getUserBots(event, headers) {
  try {
    const userId = event.pathParameters?.userId || event.path.split('/').pop();

    const response = await dynamoClient.send(new ScanCommand({
      TableName: TABLES.USER_BOTS,
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

export async function createUserBot(event, headers) {
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

    const botId = `bot-${Date.now()}`;

    // 템플릿 정보 가져오기
    const templateResponse = await dynamoClient.send(new GetCommand({
      TableName: TABLES.TEMPLATES,
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

    // 조직별 템플릿 접근 검증
    if (template.organizationId && template.organizationId !== 'GLOBAL') {
      const userResult = await dynamoClient.send(new GetCommand({
        TableName: TABLES.USERS,
        Key: { userId }
      }));
      const userOrg = userResult.Item?.organization;
      if (userOrg !== template.organizationId) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: "You don't have access to this template" })
        };
      }
    }

    await dynamoClient.send(new PutCommand({
      TableName: TABLES.USER_BOTS,
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

export async function deleteUserBot(event, headers) {
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
      TableName: TABLES.USER_BOTS,
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
      TableName: TABLES.USER_BOTS,
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

export async function getRecommendedTemplates(event, headers) {
  const pathParts = event.path.split('/');
  const userId = pathParts[pathParts.length - 1]; // /bots/recommended/{userId}

  // Query parameter로 추천 모드 선택 (competency | pattern | hybrid)
  const mode = event.queryStringParameters?.mode || 'hybrid';

  try {
    // 1. 사용자 역량 조회
    const competenciesResult = await dynamoClient.send(new QueryCommand({
      TableName: TABLES.COMPETENCIES,
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

    // 2. 사용자 조직 기반 템플릿 조회 (GLOBAL + 소속 조직)
    const userResult = await dynamoClient.send(new GetCommand({
      TableName: TABLES.USERS,
      Key: { userId }
    }));
    const userOrganization = userResult.Item?.organization || null;
    const templates = await getTemplatesByOrganization(userOrganization);

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
