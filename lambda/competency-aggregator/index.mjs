import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, QueryCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "ap-northeast-2" })
);

const ANALYTICS_TABLE = process.env.ANALYTICS_TABLE || "ai-co-learner-learning-analytics";
const COMPETENCIES_TABLE = process.env.COMPETENCIES_TABLE || "ai-co-learner-user-competencies";
const USERS_TABLE = process.env.USERS_TABLE || "ai-co-learner-users";

const COMPETENCY_TYPES = [
  'questionQuality',
  'thinkingDepth',
  'creativity',
  'communicationClarity',
  'executionOriented',
  'collaborationSignal'
];

export const handler = async (event) => {
  console.log("🚀 Starting competency aggregation...");

  try {
    // 1. 모든 활성 사용자 조회
    const users = await getAllUsers();
    console.log(`👥 Found ${users.length} users`);

    let processedCount = 0;

    // 2. 각 사용자별 역량 계산
    for (const user of users) {
      await calculateUserCompetencies(user.userId);
      processedCount++;

      if (processedCount % 10 === 0) {
        console.log(`📊 Processed ${processedCount}/${users.length} users`);
      }
    }

    console.log(`🎉 Competency aggregation complete! Processed ${processedCount} users`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Competency aggregation complete",
        usersProcessed: processedCount
      })
    };

  } catch (error) {
    console.error("❌ Error in competency aggregation:", error);
    throw error;
  }
};

// 모든 사용자 조회
async function getAllUsers() {
  const result = await dynamoClient.send(new ScanCommand({
    TableName: USERS_TABLE,
    ProjectionExpression: "userId"
  }));

  return result.Items || [];
}

// 사용자 역량 계산
async function calculateUserCompetencies(userId) {
  console.log(`🧮 Calculating competencies for user: ${userId}`);

  // 최근 30일 데이터 조회
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

  const result = await dynamoClient.send(new QueryCommand({
    TableName: ANALYTICS_TABLE,
    KeyConditionExpression: "userId = :userId AND #ts >= :thirtyDaysAgo",
    ExpressionAttributeNames: {
      "#ts": "timestamp"
    },
    ExpressionAttributeValues: {
      ":userId": userId,
      ":thirtyDaysAgo": thirtyDaysAgo
    }
  }));

  const analyticsData = result.Items || [];

  if (analyticsData.length === 0) {
    console.log(`ℹ️ No analytics data for user ${userId}`);
    return;
  }

  console.log(`📈 Found ${analyticsData.length} analytics records for user ${userId}`);

  // 각 역량별 점수 계산
  const competencyScores = {};

  for (const competency of COMPETENCY_TYPES) {
    const score = calculateWeightedScore(analyticsData, competency);
    competencyScores[competency] = score;
  }

  // DynamoDB에 저장
  await saveCompetencies(userId, competencyScores, analyticsData.length);

  console.log(`✅ Saved competencies for user ${userId}:`, competencyScores);
}

// 가중 평균 계산
function calculateWeightedScore(data, competency) {
  const now = Date.now();

  // 최근 데이터에 더 높은 가중치
  const weights = data.map(item => {
    const daysAgo = (now - item.timestamp) / (1000 * 60 * 60 * 24);

    if (daysAgo <= 7) return 0.5;       // 최근 7일: 50% 가중치
    if (daysAgo <= 14) return 0.3;      // 8-14일: 30% 가중치
    return 0.2;                         // 15-30일: 20% 가중치
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const weightedSum = data.reduce((sum, item, index) => {
    const score = item.analysisResult?.[competency] || 0;
    return sum + (score * weights[index]);
  }, 0);

  return Math.round(weightedSum / totalWeight);
}

// 역량 점수 저장
async function saveCompetencies(userId, scores, totalMessages) {
  const timestamp = Date.now();

  const putRequests = COMPETENCY_TYPES.map(competency => ({
    PutRequest: {
      Item: {
        userId,
        competency,
        score: scores[competency],
        historicalScores: [
          { timestamp, score: scores[competency] }
        ],
        updatedAt: timestamp,
        totalMessages
      }
    }
  }));

  // BatchWriteItem (최대 25개)
  await dynamoClient.send(new BatchWriteCommand({
    RequestItems: {
      [COMPETENCIES_TABLE]: putRequests
    }
  }));
}
