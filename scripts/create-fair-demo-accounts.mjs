import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const REGION = "ap-northeast-2";
const USER_POOL_ID = "ap-northeast-2_OCntQ228q";

const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// 4개의 데모 계정 설정
const DEMO_ACCOUNTS = [
  {
    email: "demo1@fair.com",
    password: "Demo2026!",
    name: "데모계정 1",
    level: 5,
    xp: 1250,
    competencies: {
      questionQuality: 72,
      thinkingDepth: 65,
      creativity: 58,
      communicationClarity: 78,
      executionOriented: 81,
      collaborationSignal: 69
    }
  },
  {
    email: "demo2@fair.com",
    password: "Demo2026!",
    name: "데모계정 2",
    level: 4,
    xp: 980,
    competencies: {
      questionQuality: 65,
      thinkingDepth: 70,
      creativity: 75,
      communicationClarity: 60,
      executionOriented: 68,
      collaborationSignal: 72
    }
  },
  {
    email: "demo3@fair.com",
    password: "Demo2026!",
    name: "데모계정 3",
    level: 3,
    xp: 650,
    competencies: {
      questionQuality: 55,
      thinkingDepth: 62,
      creativity: 68,
      communicationClarity: 70,
      executionOriented: 58,
      collaborationSignal: 65
    }
  },
  {
    email: "demo4@fair.com",
    password: "Demo2026!",
    name: "데모계정 4",
    level: 6,
    xp: 1580,
    competencies: {
      questionQuality: 78,
      thinkingDepth: 82,
      creativity: 70,
      communicationClarity: 75,
      executionOriented: 85,
      collaborationSignal: 80
    }
  }
];

async function createDemoAccount(account, index) {
  const { email, password, name, level, xp, competencies } = account;
  const organization = "박람회 데모";

  try {
    console.log(`\n[${ index + 1 }/4] Creating account: ${name} (${email})`);

    // 1. Cognito 사용자 생성
    console.log("  Step 1/6: Creating Cognito user...");
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
    console.log(`  ✅ Cognito user created: ${userId}`);

    // 2. 비밀번호 설정
    console.log("  Step 2/6: Setting permanent password...");
    const setPasswordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      Password: password,
      Permanent: true
    });

    await cognitoClient.send(setPasswordCommand);
    console.log("  ✅ Password set successfully");

    // 3. DynamoDB 사용자 프로필 생성
    console.log("  Step 3/6: Creating user profile...");
    const userItem = {
      userId: userId,
      email: email,
      name: name,
      organization: organization,
      role: "USER",
      createdAt: new Date().toISOString(),
      level: level,
      xp: xp,
      competencies: competencies,
      hasCompletedAssessment: true
    };

    await docClient.send(new PutCommand({
      TableName: "ai-co-learner-users",
      Item: userItem
    }));
    console.log("  ✅ User profile created");

    // 4. 역량 데이터 생성 (30일 히스토리)
    console.log("  Step 4/6: Creating competency records with 30-day history...");
    const competencyList = [
      { name: 'questionQuality', baseScore: competencies.questionQuality - 12, currentScore: competencies.questionQuality },
      { name: 'thinkingDepth', baseScore: competencies.thinkingDepth - 10, currentScore: competencies.thinkingDepth },
      { name: 'creativity', baseScore: competencies.creativity - 8, currentScore: competencies.creativity },
      { name: 'communicationClarity', baseScore: competencies.communicationClarity - 13, currentScore: competencies.communicationClarity },
      { name: 'executionOriented', baseScore: competencies.executionOriented - 11, currentScore: competencies.executionOriented },
      { name: 'collaborationSignal', baseScore: competencies.collaborationSignal - 9, currentScore: competencies.collaborationSignal }
    ];

    const competencyPromises = [];
    const now = Date.now();

    for (const comp of competencyList) {
      const historicalScores = [];
      for (let i = 29; i >= 0; i--) {
        const growth = ((29 - i) / 29) * (comp.currentScore - comp.baseScore);
        const score = Math.round(comp.baseScore + growth + (Math.random() * 3 - 1.5));

        historicalScores.push({
          score: Math.max(0, Math.min(100, score)),
          timestamp: now - (i * 24 * 60 * 60 * 1000),
          source: i === 29 ? 'initial_assessment' : 'ai_analysis'
        });
      }

      competencyPromises.push(
        docClient.send(new PutCommand({
          TableName: "ai-co-learner-user-competencies",
          Item: {
            userId: userId,
            competency: comp.name,
            score: comp.currentScore,
            historicalScores: historicalScores,
            totalMessages: Math.floor(Math.random() * 50) + 100,
            updatedAt: now
          }
        }))
      );
    }

    await Promise.all(competencyPromises);
    console.log("  ✅ 6 competency records created");

    // 5. 뱃지 추가
    console.log("  Step 5/6: Adding badges...");
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
    console.log("  ✅ 4 badges added");

    // 6. 오늘의 퀘스트 추가
    console.log("  Step 6/6: Creating daily quests...");
    const todayStr = new Date().toISOString().split('T')[0];

    const questItem = {
      userId: userId,
      questDate: todayStr,
      targetCompetency: "creativity",
      quests: [
        {
          questId: `conversation_${Date.now()}_${index}_1`,
          questType: "conversation",
          title: "창의적 대화 나누기",
          description: "AI와 5회 이상 대화하며 창의적 사고를 탐구하세요",
          targetCompetency: "creativity",
          difficulty: "easy",
          status: "completed",
          completionCriteria: { messageCount: 5, minScore: 70 },
          progress: { currentMessages: 5, currentScore: 82 },
          rewards: { xp: 50, competencyBoost: { creativity: 3 } }
        },
        {
          questId: `challenge_${Date.now()}_${index}_2`,
          questType: "challenge",
          title: "질문 도전",
          description: "깊이있는 질문 3개 이상을 작성하세요",
          targetCompetency: "questionQuality",
          difficulty: "easy",
          status: "active",
          completionCriteria: { messageCount: 3, minScore: 75 },
          progress: { currentMessages: 2, currentScore: 78 },
          rewards: { xp: 60, competencyBoost: { questionQuality: 4 } }
        },
        {
          questId: `reflection_${Date.now()}_${index}_3`,
          questType: "reflection",
          title: "학습 회고",
          description: "오늘 배운 내용을 정리하고 성찰하는 대화를 나눠보세요",
          targetCompetency: "thinkingDepth",
          difficulty: "easy",
          status: "active",
          completionCriteria: { messageCount: 3, minScore: 70 },
          progress: { currentMessages: 0, currentScore: 0 },
          rewards: { xp: 40, competencyBoost: { thinkingDepth: 2 } }
        }
      ],
      createdAt: new Date().toISOString(),
      expiresAt: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
    };

    await docClient.send(new PutCommand({
      TableName: "ai-co-learner-daily-quests",
      Item: questItem
    }));
    console.log("  ✅ 3 daily quests created");

    return { success: true, email, name, userId };

  } catch (error) {
    console.error(`  ❌ Failed to create ${name}:`, error.message);
    return { success: false, email, name, error: error.message };
  }
}

async function createAllDemoAccounts() {
  console.log("=".repeat(60));
  console.log("🎪 박람회 데모 계정 생성 시작");
  console.log("=".repeat(60));

  const results = {
    success: [],
    failed: []
  };

  for (let i = 0; i < DEMO_ACCOUNTS.length; i++) {
    const result = await createDemoAccount(DEMO_ACCOUNTS[i], i);

    if (result.success) {
      results.success.push(result);
    } else {
      results.failed.push(result);
    }

    // Rate limit 방지
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // 결과 출력
  console.log("\n" + "=".repeat(60));
  console.log("📋 박람회 데모 계정 생성 완료");
  console.log("=".repeat(60));

  console.log("\n✅ 생성된 계정:");
  console.log("-".repeat(60));
  console.log("| 이메일                | 비밀번호    | 이름        | 레벨 |");
  console.log("-".repeat(60));

  for (const account of DEMO_ACCOUNTS) {
    const status = results.success.find(r => r.email === account.email) ? "✅" : "❌";
    console.log(`| ${account.email.padEnd(21)} | ${account.password.padEnd(11)} | ${account.name.padEnd(11)} | Lv.${account.level}  |`);
  }
  console.log("-".repeat(60));

  console.log(`\n📊 결과: 성공 ${results.success.length}개 / 실패 ${results.failed.length}개`);

  if (results.failed.length > 0) {
    console.log("\n❌ 실패한 계정:");
    results.failed.forEach(f => {
      console.log(`  - ${f.name} (${f.email}): ${f.error}`);
    });
  }

  console.log("\n🎪 박람회 데모 준비 완료!");
  console.log("\n💡 각 계정 특징:");
  console.log("  - 데모계정 1: 균형 잡힌 역량 (Lv.5)");
  console.log("  - 데모계정 2: 창의력/사고력 강점 (Lv.4)");
  console.log("  - 데모계정 3: 소통력/창의력 강점 (Lv.3)");
  console.log("  - 데모계정 4: 전반적 고득점 (Lv.6)");
}

// 실행
createAllDemoAccounts().catch(console.error);
