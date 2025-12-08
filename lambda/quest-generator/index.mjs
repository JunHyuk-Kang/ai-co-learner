import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'ap-northeast-2' });
const docClient = DynamoDBDocumentClient.from(client);

const QUEST_TEMPLATES = {
  conversation: [
    {
      title: "깊이 있는 대화 나누기",
      description: "AI 봇과 5회 이상 대화하며 주제를 깊게 탐구하세요",
      targetCompetency: "thinkingDepth",
      difficulty: "easy",
      completionCriteria: {
        messageCount: 5,
        minScore: 70
      },
      rewards: {
        xp: 50,
        competencyBoost: { thinkingDepth: 3 }
      }
    },
    {
      title: "창의적 문제 해결",
      description: "독창적인 아이디어로 문제를 해결하는 대화를 진행하세요",
      targetCompetency: "creativity",
      difficulty: "medium",
      completionCriteria: {
        messageCount: 8,
        minScore: 80
      },
      rewards: {
        xp: 100,
        competencyBoost: { creativity: 5 }
      }
    },
    {
      title: "명확한 의사소통",
      description: "복잡한 개념을 명확하게 설명하는 대화를 10회 이상 진행하세요",
      targetCompetency: "communicationClarity",
      difficulty: "hard",
      completionCriteria: {
        messageCount: 10,
        minScore: 85
      },
      rewards: {
        xp: 150,
        competencyBoost: { communicationClarity: 7 }
      }
    }
  ],
  challenge: [
    {
      title: "질문 마스터",
      description: "핵심을 짚는 질문 3개 이상을 작성하세요",
      targetCompetency: "questionQuality",
      difficulty: "easy",
      completionCriteria: {
        messageCount: 3,
        minScore: 75
      },
      rewards: {
        xp: 60,
        competencyBoost: { questionQuality: 4 }
      }
    },
    {
      title: "실행 계획 수립",
      description: "구체적인 실행 계획을 포함한 대화를 5회 이상 진행하세요",
      targetCompetency: "executionOriented",
      difficulty: "medium",
      completionCriteria: {
        messageCount: 5,
        minScore: 80
      },
      rewards: {
        xp: 100,
        competencyBoost: { executionOriented: 5 }
      }
    }
  ],
  reflection: [
    {
      title: "학습 회고",
      description: "오늘 배운 내용을 정리하고 성찰하는 대화를 나누세요",
      targetCompetency: "thinkingDepth",
      difficulty: "easy",
      completionCriteria: {
        messageCount: 3,
        minScore: 70
      },
      rewards: {
        xp: 40,
        competencyBoost: { thinkingDepth: 2 }
      }
    },
    {
      title: "협업 포인트 찾기",
      description: "다른 사람과 협업할 수 있는 방법을 모색하는 대화를 진행하세요",
      targetCompetency: "collaborationSignal",
      difficulty: "medium",
      completionCriteria: {
        messageCount: 5,
        minScore: 75
      },
      rewards: {
        xp: 80,
        competencyBoost: { collaborationSignal: 4 }
      }
    }
  ]
};

// 사용자의 가장 낮은 역량 찾기
async function getLowestCompetency(userId) {
  try {
    const response = await docClient.send(new QueryCommand({
      TableName: 'ai-co-learner-user-competencies',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    }));

    if (!response.Items || response.Items.length === 0) {
      return 'thinkingDepth'; // 기본값
    }

    // 역량 점수가 가장 낮은 것 찾기
    const competencies = response.Items;
    let lowestCompetency = competencies[0];

    for (const comp of competencies) {
      if (comp.score < lowestCompetency.score) {
        lowestCompetency = comp;
      }
    }

    return lowestCompetency.competency;
  } catch (error) {
    console.error('Error getting lowest competency:', error);
    return 'thinkingDepth'; // 기본값
  }
}

// 퀘스트 선택
function selectQuests(targetCompetency) {
  const quests = [];

  // 각 타입에서 1개씩 선택 (총 3개)
  for (const [questType, templates] of Object.entries(QUEST_TEMPLATES)) {
    // 타겟 역량에 맞는 퀘스트 우선 선택
    let selected = templates.find(t => t.targetCompetency === targetCompetency);

    // 없으면 랜덤 선택
    if (!selected) {
      selected = templates[Math.floor(Math.random() * templates.length)];
    }

    quests.push({
      ...selected,
      questType,
      questId: `${questType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'active',
      progress: {
        currentMessages: 0,
        currentScore: 0
      }
    });
  }

  return quests;
}

// 모든 사용자에게 퀘스트 생성
export const handler = async (event) => {
  console.log('Quest Generator started');

  try {
    // 모든 사용자 조회
    const usersResponse = await docClient.send(new ScanCommand({
      TableName: 'ai-co-learner-users',
      ProjectionExpression: 'userId, email'
    }));

    const users = usersResponse.Items || [];
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`Generating quests for ${users.length} users`);

    // 각 사용자에게 퀘스트 생성
    for (const user of users) {
      try {
        // 오늘 이미 퀘스트가 있는지 확인
        const existingQuest = await docClient.send(new QueryCommand({
          TableName: 'ai-co-learner-daily-quests',
          KeyConditionExpression: 'userId = :userId AND questDate = :date',
          ExpressionAttributeValues: {
            ':userId': user.userId,
            ':date': today
          }
        }));

        if (existingQuest.Items && existingQuest.Items.length > 0) {
          console.log(`User ${user.userId} already has quests for today`);
          continue;
        }

        // 가장 낮은 역량 찾기
        const targetCompetency = await getLowestCompetency(user.userId);

        // 퀘스트 선택
        const quests = selectQuests(targetCompetency);

        // 퀘스트 저장
        await docClient.send(new PutCommand({
          TableName: 'ai-co-learner-daily-quests',
          Item: {
            userId: user.userId,
            questDate: today,
            quests,
            targetCompetency,
            createdAt: new Date().toISOString(),
            expiresAt: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7일 TTL
          }
        }));

        console.log(`Generated ${quests.length} quests for user ${user.userId}`);
      } catch (error) {
        console.error(`Error generating quest for user ${user.userId}:`, error);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successfully generated quests for ${users.length} users`,
        date: today
      })
    };
  } catch (error) {
    console.error('Error in quest generator:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to generate quests',
        message: error.message
      })
    };
  }
};
