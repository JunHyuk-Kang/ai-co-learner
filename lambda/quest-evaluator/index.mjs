import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

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
    // timestamp는 숫자 타입이므로, 오늘 날짜의 시작/종료 밀리초 계산
    const todayStart = new Date(questDate).getTime();
    const todayEnd = todayStart + (24 * 60 * 60 * 1000); // 하루 = 86,400,000ms

    const analyticsResponse = await docClient.send(new QueryCommand({
      TableName: 'ai-co-learner-learning-analytics',
      KeyConditionExpression: 'userId = :userId AND #ts BETWEEN :start AND :end',
      ExpressionAttributeNames: {
        '#ts': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':start': todayStart,
        ':end': todayEnd
      }
    }));

    const todayAnalytics = analyticsResponse.Items || [];

    // 각 퀘스트 진행도 업데이트
    const updatedQuests = quests.map(quest => {
      // 모든 오늘의 메시지를 카운트 (0점도 포함)
      // 타겟 역량 점수만 따로 계산
      const relevantMessages = todayAnalytics.filter(msg => {
        const scores = msg.competencyScores || msg.analysisResult || {};
        // 역량 점수가 존재하는 메시지만 (undefined 제외)
        return scores[quest.targetCompetency] !== undefined;
      });

      // 진행도 계산: 모든 메시지 카운트
      const messageCount = relevantMessages.length;

      // 평균 점수 계산: 타겟 역량 점수만 사용
      const avgScore = relevantMessages.length > 0
        ? relevantMessages.reduce((sum, msg) => {
            const scores = msg.competencyScores || msg.analysisResult || {};
            return sum + (scores[quest.targetCompetency] || 0);
          }, 0) / relevantMessages.length
        : 0;

      // 완료 조건 체크
      const criteria = quest.completionCriteria;

      // 메시지 개수가 충분하고, 평균 점수가 기준 이상이면 완료
      // 단, 메시지 개수가 기준의 2배 이상이면 점수 기준을 50%로 완화
      const relaxedScoreThreshold = messageCount >= criteria.messageCount * 2
        ? criteria.minScore * 0.5
        : criteria.minScore;

      const isCompleted =
        messageCount >= criteria.messageCount &&
        avgScore >= relaxedScoreThreshold;

      const updatedQuest = {
        ...quest,
        progress: {
          currentMessages: messageCount,
          currentScore: Math.round(avgScore)
        },
        status: isCompleted ? 'completed' : quest.status
      };

      // completedAt은 완료 시에만 추가 (undefined 방지)
      if (isCompleted && quest.status !== 'completed') {
        updatedQuest.completedAt = new Date().toISOString();
      } else if (quest.completedAt) {
        updatedQuest.completedAt = quest.completedAt;
      }

      return updatedQuest;
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

    // 오늘 퀘스트가 있는 모든 사용자 조회 (Scan 사용)
    let todayQuests = [];
    try {
      // GSI를 사용하려고 시도
      const questsResponse = await docClient.send(new QueryCommand({
        TableName: 'ai-co-learner-daily-quests',
        IndexName: 'questDate-index',
        KeyConditionExpression: 'questDate = :date',
        ExpressionAttributeValues: {
          ':date': today
        }
      }));
      todayQuests = questsResponse.Items || [];
    } catch (gsiError) {
      // GSI가 없으면 Scan으로 대체
      console.log('GSI not found, using Scan instead');
      const allQuestsResponse = await docClient.send(new ScanCommand({
        TableName: 'ai-co-learner-daily-quests',
        FilterExpression: 'questDate = :date',
        ExpressionAttributeValues: {
          ':date': today
        }
      }));
      todayQuests = allQuestsResponse.Items || [];
    }

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
