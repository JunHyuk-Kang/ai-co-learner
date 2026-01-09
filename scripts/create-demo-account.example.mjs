import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

// 환경 변수에서 설정 가져오기
const REGION = process.env.AWS_REGION || "ap-northeast-2";
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;

if (!USER_POOL_ID) {
  console.error("❌ Error: COGNITO_USER_POOL_ID environment variable is required");
  console.log("\n💡 Setup instructions:");
  console.log("  1. Copy .env.example to .env.local");
  console.log("  2. Set COGNITO_USER_POOL_ID in .env.local");
  console.log("  3. Run: node scripts/create-demo-account.mjs");
  process.exit(1);
}

const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function createDemoAccount() {
  const email = "demo@showcase.com";
  const password = "Demo2026!";
  const organization = "박람회 데모";
  const name = "김데모";

  try {
    console.log("🎬 Creating demo account for video showcase...\n");
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`🏫 Organization: ${organization}`);
    console.log(`👤 Name: ${name}\n`);

    // 1. Cognito 사용자 생성
    console.log("Step 1/5: Creating Cognito user...");
    const createUserCommand = new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "email_verified", Value: "true" },
        { Name: "name", Value: name }
      ],
      MessageAction: "SUPPRESS"
    });

    const createResult = await cognitoClient.send(createUserCommand);
    const userId = createResult.User.Username;
    console.log(`✅ Cognito user created: ${userId}\n`);

    // 2. 비밀번호 설정
    console.log("Step 2/5: Setting permanent password...");
    const setPasswordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      Password: password,
      Permanent: true
    });

    await cognitoClient.send(setPasswordCommand);
    console.log("✅ Password set successfully\n");

    // 3. DynamoDB 사용자 프로필 생성 (역량 데이터 포함)
    console.log("Step 3/5: Creating user profile with competency data...");
    const userItem = {
      userId: userId,
      email: email,
      name: name,
      organization: organization,
      role: "USER",
      createdAt: new Date().toISOString(),
      level: 5,
      xp: 1250,
      competencies: {
        questionQuality: 72,
        thinkingDepth: 65,
        creativity: 58,
        communicationClarity: 78,
        executionOriented: 81,
        collaborationSignal: 69
      },
      hasCompletedAssessment: true
    };

    await docClient.send(new PutCommand({
      TableName: "ai-co-learner-users",
      Item: userItem
    }));
    console.log("✅ User profile created\n");

    // 4. 역량 데이터 생성 (6개 역량별로)
    console.log("Step 4/5: Creating competency records...");
    const competencies = [
      { name: 'questionQuality', baseScore: 60, currentScore: 72 },
      { name: 'thinkingDepth', baseScore: 55, currentScore: 65 },
      { name: 'creativity', baseScore: 50, currentScore: 58 },
      { name: 'communicationClarity', baseScore: 65, currentScore: 78 },
      { name: 'executionOriented', baseScore: 70, currentScore: 81 },
      { name: 'collaborationSignal', baseScore: 60, currentScore: 69 }
    ];

    const competencyPromises = [];
    const now = Date.now();

    for (const comp of competencies) {
      // 30일간의 성장 히스토리 생성
      const historicalScores = [];
      for (let i = 29; i >= 0; i--) {
        const daysAgo = i;
        const growth = ((29 - i) / 29) * (comp.currentScore - comp.baseScore);
        const score = Math.round(comp.baseScore + growth + (Math.random() * 3 - 1.5));

        historicalScores.push({
          score: Math.max(0, Math.min(100, score)),
          timestamp: now - (daysAgo * 24 * 60 * 60 * 1000),
          source: i === 29 ? 'initial_assessment' : 'ai_analysis'
        });
      }

      const competencyItem = {
        userId: userId,
        competency: comp.name,
        score: comp.currentScore,
        historicalScores: historicalScores,
        totalMessages: Math.floor(Math.random() * 50) + 100,
        updatedAt: now
      };

      competencyPromises.push(
        docClient.send(new PutCommand({
          TableName: "ai-co-learner-user-competencies",
          Item: competencyItem
        }))
      );
    }

    await Promise.all(competencyPromises);
    console.log("✅ 6 competency records created with 30-day history\n");

    // 5. 샘플 뱃지/업적 추가
    console.log("Step 5/5: Adding achievements and badges...");
    const badges = [
      { id: "first-message", daysAgo: 25 },
      { id: "chat-streak-7", daysAgo: 20 },
      { id: "deep-thinker", daysAgo: 15 },
      { id: "action-taker", daysAgo: 10 }
    ];

    const badgePromises = badges.map(badge => {
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
    console.log(`✅ ${badges.length} badges added\n`);

    // 6. 오늘의 퀘스트 추가
    console.log("Step 6/6: Creating today's daily quests...");
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const questItem = {
      userId: userId,
      questDate: todayStr,
      targetCompetency: "creativity",
      quests: [
        {
          questId: `conversation_${Date.now()}_demo1`,
          questType: "conversation",
          title: "창의적 대화 나누기",
          description: "AI와 5회 이상 대화하며 창의적 사고를 탐구하세요",
          targetCompetency: "creativity",
          difficulty: "easy",
          status: "completed",
          completionCriteria: {
            messageCount: 5,
            minScore: 70
          },
          progress: {
            currentMessages: 5,
            currentScore: 82
          },
          rewards: {
            xp: 50,
            competencyBoost: {
              creativity: 3
            }
          }
        },
        {
          questId: `challenge_${Date.now()}_demo2`,
          questType: "challenge",
          title: "질문 도전",
          description: "깊이있는 질문 3개 이상을 작성하세요",
          targetCompetency: "questionQuality",
          difficulty: "easy",
          status: "active",
          completionCriteria: {
            messageCount: 3,
            minScore: 75
          },
          progress: {
            currentMessages: 2,
            currentScore: 78
          },
          rewards: {
            xp: 60,
            competencyBoost: {
              questionQuality: 4
            }
          }
        },
        {
          questId: `reflection_${Date.now()}_demo3`,
          questType: "reflection",
          title: "학습 회고",
          description: "오늘 배운 내용을 정리하고 성찰하는 대화를 나눠보세요",
          targetCompetency: "thinkingDepth",
          difficulty: "easy",
          status: "active",
          completionCriteria: {
            messageCount: 3,
            minScore: 70
          },
          progress: {
            currentMessages: 0,
            currentScore: 0
          },
          rewards: {
            xp: 40,
            competencyBoost: {
              thinkingDepth: 2
            }
          }
        }
      ],
      createdAt: new Date().toISOString(),
      expiresAt: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 // 7일 TTL
    };

    await docClient.send(new PutCommand({
      TableName: "ai-co-learner-daily-quests",
      Item: questItem
    }));
    console.log("✅ 3 daily quests created (1 completed, 2 in progress)\n");

    console.log("🎉 Demo account creation completed!\n");
    console.log("=".repeat(60));
    console.log("📋 DEMO ACCOUNT CREDENTIALS");
    console.log("=".repeat(60));
    console.log(`Email:        ${email}`);
    console.log(`Password:     ${password}`);
    console.log(`Name:         ${name}`);
    console.log(`Organization: ${organization}`);
    console.log(`User ID:      ${userId}`);
    console.log("=".repeat(60));
    console.log("\n✨ Account Features:");
    console.log("  ✅ Initial assessment completed");
    console.log("  ✅ 6 competencies with realistic scores (58-81)");
    console.log("  ✅ 30-day competency growth history");
    console.log("  ✅ Level 5, 1250 XP");
    console.log("  ✅ 4 badges earned");
    console.log("  ✅ Today's quests (1 completed, 2 in progress)");
    console.log("\n🎬 Ready for video recording!");
    console.log("\n💡 Next steps:");
    console.log("  1. Login with the credentials above");
    console.log("  2. Dashboard will show complete competency radar chart");
    console.log("  3. Create a chat session with recommended bot");
    console.log("  4. Show daily quests and badges");
    console.log("  5. Navigate to competency growth chart (30-day history)");

  } catch (error) {
    console.error("\n❌ Error creating demo account:", error);
    throw error;
  }
}

// 실행
createDemoAccount().catch(console.error);
