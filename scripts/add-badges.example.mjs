import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "ap-northeast-2";
const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function addBadges() {
  // Usage: USER_ID=your-user-id node scripts/add-badges.mjs
  const userId = process.env.USER_ID;

  if (!userId) {
    console.error("❌ Error: USER_ID environment variable is required");
    console.log("\n💡 Usage:");
    console.log("  USER_ID=your-user-id node scripts/add-badges.mjs");
    console.log("\n  Example:");
    console.log("  USER_ID=c448fdec-1041-7030-73c6-625fa4484c60 node scripts/add-badges.mjs");
    process.exit(1);
  }

  console.log(`🎖️  Adding 3 more badges to user: ${userId}\n`);

  const newBadges = [
    { id: "creative-spark", daysAgo: 8 },
    { id: "question-master", daysAgo: 5 },
    { id: "daily-warrior", daysAgo: 3 }
  ];

  const badgePromises = newBadges.map(badge => {
    return docClient.send(new PutCommand({
      TableName: "ai-co-learner-user-achievements",
      Item: {
        userId: userId,
        achievementId: badge.id,
        unlockedAt: new Date(Date.now() - badge.daysAgo * 24 * 60 * 60 * 1000).toISOString(),
        progress: 100
      }
    }));
  });

  await Promise.all(badgePromises);

  console.log("✅ 3 new badges added!\n");
  console.log(`📊 Badge list for user ${userId}:`);
  console.log("\nNew badges:");
  console.log("  1. creative-spark (8 days ago)");
  console.log("  2. question-master (5 days ago)");
  console.log("  3. daily-warrior (3 days ago)");
}

addBadges().catch(console.error);
