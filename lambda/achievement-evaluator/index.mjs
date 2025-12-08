import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'ap-northeast-2' });
const docClient = DynamoDBDocumentClient.from(client);

// 배지 정의
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

// 사용자 통계 계산
async function getUserStats(userId) {
  try {
    // 총 메시지 수 계산 (learning-analytics 테이블)
    const analyticsResponse = await docClient.send(new QueryCommand({
      TableName: 'ai-co-learner-learning-analytics',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      Select: 'COUNT'
    }));
    const messageCount = analyticsResponse.Count || 0;

    // 완료된 퀘스트 수 계산 (daily-quests 테이블)
    const questsResponse = await docClient.send(new QueryCommand({
      TableName: 'ai-co-learner-daily-quests',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    }));

    let questsCompleted = 0;
    if (questsResponse.Items) {
      questsResponse.Items.forEach(dayQuests => {
        if (dayQuests.quests) {
          questsCompleted += dayQuests.quests.filter(q => q.status === 'completed').length;
        }
      });
    }

    // 역량 점수 조회
    const competenciesResponse = await docClient.send(new QueryCommand({
      TableName: 'ai-co-learner-user-competencies',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    }));

    const competencies = {};
    if (competenciesResponse.Items) {
      competenciesResponse.Items.forEach(item => {
        competencies[item.competency] = item.score;
      });
    }

    // 연속 활동 일수 계산 (간단한 버전 - learning-analytics 기반)
    const recentAnalytics = await docClient.send(new QueryCommand({
      TableName: 'ai-co-learner-learning-analytics',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      ScanIndexForward: false,
      Limit: 100
    }));

    let consecutiveDays = 0;
    if (recentAnalytics.Items && recentAnalytics.Items.length > 0) {
      const dates = new Set();
      recentAnalytics.Items.forEach(item => {
        const date = item.timestamp.split('T')[0];
        dates.add(date);
      });

      const sortedDates = Array.from(dates).sort().reverse();
      let expectedDate = new Date();
      expectedDate.setHours(0, 0, 0, 0);

      for (const dateStr of sortedDates) {
        const date = new Date(dateStr);
        date.setHours(0, 0, 0, 0);

        if (date.getTime() === expectedDate.getTime()) {
          consecutiveDays++;
          expectedDate.setDate(expectedDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    return {
      messageCount,
      questsCompleted,
      competencies,
      consecutiveDays
    };
  } catch (error) {
    console.error('Error getting user stats:', error);
    return {
      messageCount: 0,
      questsCompleted: 0,
      competencies: {},
      consecutiveDays: 0
    };
  }
}

// 배지 달성 여부 확인
function checkAchievement(achievement, stats) {
  const { criteria } = achievement;

  // 메시지 수 기반
  if (criteria.messageCount !== undefined) {
    return stats.messageCount >= criteria.messageCount;
  }

  // 퀘스트 완료 수 기반
  if (criteria.questsCompleted !== undefined) {
    return stats.questsCompleted >= criteria.questsCompleted;
  }

  // 역량 점수 기반
  if (criteria.competency && criteria.score !== undefined) {
    const userScore = stats.competencies[criteria.competency] || 0;
    return userScore >= criteria.score;
  }

  // 연속 활동 일수 기반
  if (criteria.consecutiveDays !== undefined) {
    return stats.consecutiveDays >= criteria.consecutiveDays;
  }

  return false;
}

// 배지 평가 및 부여
async function evaluateAchievements(userId) {
  try {
    // 사용자 통계 조회
    const stats = await getUserStats(userId);

    // 이미 획득한 배지 조회
    const existingAchievements = await docClient.send(new QueryCommand({
      TableName: 'ai-co-learner-user-achievements',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    }));

    const unlockedIds = new Set(
      (existingAchievements.Items || []).map(item => item.achievementId)
    );

    // 각 배지 확인
    const newAchievements = [];
    for (const [achievementId, achievement] of Object.entries(ACHIEVEMENTS)) {
      // 이미 획득한 배지는 스킵
      if (unlockedIds.has(achievementId)) {
        continue;
      }

      // 달성 조건 확인
      if (checkAchievement(achievement, stats)) {
        // 배지 부여
        await docClient.send(new PutCommand({
          TableName: 'ai-co-learner-user-achievements',
          Item: {
            userId,
            achievementId,
            unlockedAt: new Date().toISOString(),
            progress: 100
          }
        }));

        newAchievements.push(achievement);
        console.log(`Unlocked achievement for ${userId}: ${achievement.name}`);
      }
    }

    return {
      newAchievements,
      totalUnlocked: unlockedIds.size + newAchievements.length,
      totalAchievements: Object.keys(ACHIEVEMENTS).length
    };
  } catch (error) {
    console.error('Error evaluating achievements:', error);
    throw error;
  }
}

// 메인 핸들러
export const handler = async (event) => {
  console.log('Achievement Evaluator started');

  try {
    // API Gateway 호출인 경우 (특정 사용자)
    if (event.httpMethod) {
      const userId = event.pathParameters?.userId;

      if (!userId) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ error: 'userId is required' })
        };
      }

      const result = await evaluateAchievements(userId);

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(result)
      };
    }

    // EventBridge 스케줄러 호출인 경우 (모든 사용자)
    const usersResponse = await docClient.send(new ScanCommand({
      TableName: 'ai-co-learner-users',
      ProjectionExpression: 'userId'
    }));

    const users = usersResponse.Items || [];
    console.log(`Evaluating achievements for ${users.length} users`);

    let successCount = 0;
    let errorCount = 0;
    let totalNewAchievements = 0;

    for (const user of users) {
      try {
        const result = await evaluateAchievements(user.userId);
        successCount++;
        totalNewAchievements += result.newAchievements.length;
      } catch (error) {
        console.error(`Error for user ${user.userId}:`, error);
        errorCount++;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Achievement evaluation completed',
        totalUsers: users.length,
        successCount,
        errorCount,
        totalNewAchievements
      })
    };
  } catch (error) {
    console.error('Error in achievement evaluator:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to evaluate achievements',
        message: error.message
      })
    };
  }
};
