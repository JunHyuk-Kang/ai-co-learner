import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'ap-northeast-2' });
const docClient = DynamoDBDocumentClient.from(client);

// 퀘스트 진행도 평가
async function evaluateQuestProgress(userId, questDate) {
  try {
    // 오늘의 퀘스트 조회
    const questResponse = await docClient.send(new QueryCommand({
      TableName: 'ai-co-learner-daily-quests',
      KeyConditionExpression: 'userId = :userId AND questDate = :date',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':date': questDate
      }
    }));

    if (!questResponse.Items || questResponse.Items.length === 0) {
      return { message: 'No quests found for today' };
    }

    const questData = questResponse.Items[0];
    const quests = questData.quests || [];

    // 오늘 분석된 메시지 조회 (learning-analytics에서)
    const analyticsResponse = await docClient.send(new QueryCommand({
      TableName: 'ai-co-learner-learning-analytics',
      KeyConditionExpression: 'userId = :userId AND begins_with(timestamp, :date)',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':date': questDate
      }
    }));

    const todayAnalytics = analyticsResponse.Items || [];

    // 각 퀘스트 진행도 업데이트
    const updatedQuests = quests.map(quest => {
      // 타겟 역량에 맞는 메시지 필터링
      const relevantMessages = todayAnalytics.filter(msg => {
        const scores = msg.competencyScores || {};
        return scores[quest.targetCompetency] !== undefined;
      });

      // 진행도 계산
      const messageCount = relevantMessages.length;
      const avgScore = relevantMessages.length > 0
        ? relevantMessages.reduce((sum, msg) =>
            sum + (msg.competencyScores[quest.targetCompetency] || 0), 0
          ) / relevantMessages.length
        : 0;

      // 완료 조건 체크
      const criteria = quest.completionCriteria;
      const isCompleted =
        messageCount >= criteria.messageCount &&
        avgScore >= criteria.minScore;

      return {
        ...quest,
        progress: {
          currentMessages: messageCount,
          currentScore: Math.round(avgScore)
        },
        status: isCompleted ? 'completed' : quest.status,
        completedAt: isCompleted && quest.status !== 'completed'
          ? new Date().toISOString()
          : quest.completedAt
      };
    });

    // 퀘스트 업데이트
    await docClient.send(new UpdateCommand({
      TableName: 'ai-co-learner-daily-quests',
      Key: {
        userId,
        questDate
      },
      UpdateExpression: 'SET quests = :quests, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':quests': updatedQuests,
        ':updatedAt': new Date().toISOString()
      }
    }));

    // 완료된 퀘스트에 대한 보상 처리
    const completedQuests = updatedQuests.filter(q =>
      q.status === 'completed' && !q.rewardClaimed
    );

    if (completedQuests.length > 0) {
      await applyRewards(userId, completedQuests);

      // 보상 지급 표시
      const questsWithRewards = updatedQuests.map(q => ({
        ...q,
        rewardClaimed: q.status === 'completed' ? true : q.rewardClaimed
      }));

      await docClient.send(new UpdateCommand({
        TableName: 'ai-co-learner-daily-quests',
        Key: { userId, questDate },
        UpdateExpression: 'SET quests = :quests',
        ExpressionAttributeValues: {
          ':quests': questsWithRewards
        }
      }));
    }

    return {
      message: 'Quest progress updated',
      completedCount: completedQuests.length,
      totalQuests: quests.length
    };

  } catch (error) {
    console.error('Error evaluating quest progress:', error);
    throw error;
  }
}

// 보상 지급
async function applyRewards(userId, completedQuests) {
  try {
    for (const quest of completedQuests) {
      const rewards = quest.rewards;

      // 역량 부스트 적용
      if (rewards.competencyBoost) {
        for (const [competency, boost] of Object.entries(rewards.competencyBoost)) {
          // 현재 역량 점수 조회
          const competencyResponse = await docClient.send(new QueryCommand({
            TableName: 'ai-co-learner-user-competencies',
            KeyConditionExpression: 'userId = :userId AND competency = :competency',
            ExpressionAttributeValues: {
              ':userId': userId,
              ':competency': competency
            }
          }));

          const currentScore = competencyResponse.Items?.[0]?.score || 50;
          const newScore = Math.min(100, currentScore + boost); // 최대 100점

          // 역량 점수 업데이트
          await docClient.send(new UpdateCommand({
            TableName: 'ai-co-learner-user-competencies',
            Key: {
              userId,
              competency
            },
            UpdateExpression: 'SET score = :score, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
              ':score': newScore,
              ':updatedAt': new Date().toISOString()
            }
          }));

          console.log(`Applied ${boost} boost to ${competency} for user ${userId}`);
        }
      }

      // XP는 나중에 user-profile 테이블 추가 시 구현
      console.log(`Quest completed: ${quest.title} (+${rewards.xp} XP)`);
    }
  } catch (error) {
    console.error('Error applying rewards:', error);
    throw error;
  }
}

// 메인 핸들러
export const handler = async (event) => {
  console.log('Quest Evaluator started');

  try {
    // API Gateway 호출인 경우
    if (event.httpMethod) {
      const userId = event.pathParameters?.userId;
      const questDate = event.queryStringParameters?.date || new Date().toISOString().split('T')[0];

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

      const result = await evaluateQuestProgress(userId, questDate);

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(result)
      };
    }

    // EventBridge 스케줄러 호출인 경우 (배치 처리)
    // 모든 활성 사용자의 퀘스트 평가
    const today = new Date().toISOString().split('T')[0];

    // 오늘 퀘스트가 있는 모든 사용자 조회
    const questsResponse = await docClient.send(new QueryCommand({
      TableName: 'ai-co-learner-daily-quests',
      IndexName: 'questDate-index', // GSI 필요
      KeyConditionExpression: 'questDate = :date',
      ExpressionAttributeValues: {
        ':date': today
      }
    }));

    // GSI가 없을 수 있으므로 Scan으로 대체
    const allQuestsResponse = await docClient.send(new ScanCommand({
      TableName: 'ai-co-learner-daily-quests',
      FilterExpression: 'questDate = :date',
      ExpressionAttributeValues: {
        ':date': today
      }
    }));

    const todayQuests = allQuestsResponse.Items || [];

    console.log(`Evaluating quests for ${todayQuests.length} users`);

    let successCount = 0;
    let errorCount = 0;

    for (const questData of todayQuests) {
      try {
        await evaluateQuestProgress(questData.userId, today);
        successCount++;
      } catch (error) {
        console.error(`Error evaluating quest for user ${questData.userId}:`, error);
        errorCount++;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Quest evaluation completed',
        totalUsers: todayQuests.length,
        successCount,
        errorCount,
        date: today
      })
    };

  } catch (error) {
    console.error('Error in quest evaluator:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to evaluate quests',
        message: error.message
      })
    };
  }
};
