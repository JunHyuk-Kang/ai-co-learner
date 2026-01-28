import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { InvokeCommand } from "@aws-sdk/client-lambda";
import { dynamoClient, lambdaClient } from "../lib/clients.mjs";
import { TABLES } from "../lib/config.mjs";

export async function getUserQuests(event, headers) {
  try {
    const userId = event.pathParameters?.userId || event.path.split('/').pop();
    const today = new Date().toISOString().split('T')[0];

    console.log('Getting quests for userId:', userId, 'date:', today);

    const response = await dynamoClient.send(new QueryCommand({
      TableName: TABLES.QUESTS,
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

export async function getCompetencyHistory(event, headers) {
  try {
    const pathParts = event.path.split('/');
    const userId = pathParts[pathParts.indexOf('users') + 1];
    const days = parseInt(event.queryStringParameters?.days || '30', 10);

    console.log('Getting competency history for userId:', userId, 'days:', days);

    // 시작 날짜 계산 (days일 전)
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    // learning-analytics 테이블의 timestamp는 밀리초 단위
    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime();

    // learning-analytics 테이블에서 분석 데이터 조회
    const response = await dynamoClient.send(new QueryCommand({
      TableName: TABLES.ANALYTICS,
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
      // timestamp는 이미 밀리초 단위이므로 변환 불필요
      const date = new Date(item.timestamp).toISOString().split('T')[0]; // YYYY-MM-DD
      // 하위 호환성: competencyScores(신규) 또는 analysisResult(기존) 사용
      const scores = item.competencyScores || item.analysisResult || {};

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

export async function getUserAchievements(event, headers) {
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
      TableName: TABLES.ACHIEVEMENTS,
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

export async function getLearningAnalysis(event, headers) {
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

    // responsePayload.body는 이미 JSON 문자열이므로 그대로 반환
    return {
      statusCode: 200,
      headers,
      body: responsePayload.body,
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

export async function getUserCompetencies(event, headers) {
  const pathParts = event.path.split('/');
  const userId = pathParts[2]; // /users/{userId}/competencies

  try {
    const result = await dynamoClient.send(new QueryCommand({
      TableName: TABLES.COMPETENCIES,
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
