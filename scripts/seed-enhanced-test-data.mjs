import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'ap-northeast-2' });
const docClient = DynamoDBDocumentClient.from(client);

const TEST_USER_ID = '9438edcc-f0a1-7031-40b1-55fb2ba06416';
const BOT_TYPES = ['questioning', 'creative', 'critical', 'executive'];

// 현실적인 채팅 메시지 샘플 (더 많은 데이터)
const SAMPLE_CONVERSATIONS = [
  {
    botType: 'questioning',
    messages: [
      { user: '머신러닝과 딥러닝의 차이가 뭔가요?', ai: '좋은 질문입니다! 머신러닝은 데이터로부터 패턴을 학습하는 알고리즘의 총칭이고, 딥러닝은 인공신경망을 여러 층으로 쌓아 복잡한 패턴을 학습하는 머신러닝의 한 분야입니다.' },
      { user: '그럼 딥러닝이 항상 더 좋은 건가요?', ai: '반드시 그런 것은 아닙니다. 딥러닝은 대량의 데이터와 컴퓨팅 파워가 필요하고, 작은 데이터셋에서는 오히려 과적합될 수 있습니다.' },
      { user: '과적합이 뭔가요?', ai: '과적합(Overfitting)은 모델이 훈련 데이터에는 너무 잘 맞지만, 새로운 데이터에는 제대로 작동하지 않는 현상입니다.' }
    ]
  },
  {
    botType: 'creative',
    messages: [
      { user: 'AI를 활용한 새로운 서비스 아이디어를 생각 중인데 어떤 게 좋을까요?', ai: '흥미롭네요! 먼저 어떤 분야에 관심이 있으신지 말씀해주시겠어요?' },
      { user: '교육 분야에 관심이 있어요. 특히 학습 효율을 높이는 것.', ai: '좋은 선택입니다! 개인 맞춤형 학습 경로 추천, AI 기반 학습 패턴 분석, 대화형 AI 튜터 등을 고려해볼 수 있습니다.' },
      { user: '대화형 AI 튜터가 재미있을 것 같아요. 어떻게 차별화할 수 있을까요?', ai: '게이미피케이션 요소, 감정 인식, 학습 스타일 맞춤 등을 조합해보는 건 어떨까요?' }
    ]
  },
  {
    botType: 'critical',
    messages: [
      { user: 'AI가 모든 일자리를 대체할 거라는데 사실인가요?', ai: '이 주장은 과장된 측면이 있습니다. 역사적으로 기술 발전은 일자리를 대체하기보다 변화시켜왔습니다.' },
      { user: '자동화로 단순 반복 업무가 사라진다는 기사를 봤어요.', ai: '맞습니다. 하지만 재교육 가능성, 새로운 직종 창출, 인간 고유의 능력이 필요한 영역도 존재합니다.' }
    ]
  },
  {
    botType: 'executive',
    messages: [
      { user: 'Python 기초를 배우고 싶은데 어떻게 시작해야 할까요?', ai: '구체적인 학습 계획을 세워볼까요? 1주차: 변수, 데이터 타입, 조건문 학습. 매일 30분씩 코딩 연습을 권장합니다.' },
      { user: 'Python 설치했어요!', ai: '훌륭합니다! 이제 변수 선언과 출력 실습을 해봅시다.' },
      { user: '실행했어요! 근데 이제 뭘 배워야 하나요?', ai: '다음 단계는 조건문과 반복문입니다. 홀짝 판별, 구구단 출력 등을 연습해보세요.' }
    ]
  },
  {
    botType: 'questioning',
    messages: [
      { user: '클라우드 컴퓨팅의 장점이 뭔가요?', ai: '확장성, 비용 효율성, 접근성 등이 있습니다. 특히 어떤 측면이 궁금하신가요?' },
      { user: '비용 효율성이 궁금해요.', ai: '초기 인프라 투자 없이 사용량만큼만 비용을 지불하는 종량제 모델이 대표적입니다.' }
    ]
  },
  {
    botType: 'creative',
    messages: [
      { user: '블록체인을 활용한 창의적인 아이디어가 있을까요?', ai: '디지털 자산 인증, 투명한 공급망 관리, 탈중앙화 거버넌스 등 다양한 분야에 적용할 수 있습니다.' },
      { user: '예술 분야는 어떨까요?', ai: 'NFT를 활용한 디지털 아트 소유권 증명, 아티스트 직거래 플랫폼 등이 가능합니다!' }
    ]
  }
];

// 학습 분석 데이터 생성
function generateLearningAnalytics(userId, sessionId, messageId, botType, userMessage, timestamp) {
  const baseScores = {
    questioning: { questionQuality: 0.75, thinkingDepth: 0.65, creativity: 0.5, communicationClarity: 0.7, executionOriented: 0.4, collaborationSignal: 0.6 },
    creative: { questionQuality: 0.65, thinkingDepth: 0.7, creativity: 0.85, communicationClarity: 0.6, executionOriented: 0.5, collaborationSignal: 0.7 },
    critical: { questionQuality: 0.8, thinkingDepth: 0.85, creativity: 0.6, communicationClarity: 0.75, executionOriented: 0.5, collaborationSignal: 0.65 },
    executive: { questionQuality: 0.6, thinkingDepth: 0.5, creativity: 0.55, communicationClarity: 0.7, executionOriented: 0.9, collaborationSignal: 0.8 }
  };

  const scores = baseScores[botType] || baseScores.questioning;
  const randomize = (score) => Math.min(1, Math.max(0, score + (Math.random() * 0.2 - 0.1)));

  return {
    userId,
    timestamp,
    sessionId,
    messageId,
    botType,
    analysisResult: {
      scores: {
        questionQuality: randomize(scores.questionQuality),
        thinkingDepth: randomize(scores.thinkingDepth),
        creativity: randomize(scores.creativity),
        communicationClarity: randomize(scores.communicationClarity),
        executionOriented: randomize(scores.executionOriented),
        collaborationSignal: randomize(scores.collaborationSignal)
      },
      insights: [
        `${botType} 봇과의 대화에서 좋은 질문을 던졌습니다.`,
        '핵심을 파악하는 능력이 돋보입니다.',
        '추가 학습을 통해 더 발전할 수 있습니다.'
      ],
      messageLength: userMessage.length,
      hasQuestion: userMessage.includes('?') || userMessage.includes('요'),
      complexity: userMessage.length > 20 ? 'medium' : 'simple'
    },
    createdAt: new Date(timestamp).toISOString(),
    expiresAt: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1년 TTL
  };
}

// 역량 점수 생성 (성장 반영)
function generateCompetencyScores(userId, finalScores) {
  return Object.entries(finalScores).map(([competency, score]) => ({
    userId,
    competency,
    score,
    lastUpdated: new Date().toISOString(),
    totalMessages: Math.floor(Math.random() * 30) + 40,
    improvementRate: (Math.random() * 0.2 - 0.05).toFixed(2)
  }));
}

// 역량 성장 히스토리 생성 (30일치)
function generateCompetencyHistory(days = 30) {
  const history = [];
  const now = Date.now();

  // 초기 역량 점수 (낮게 시작)
  const initialScores = {
    questionQuality: 50,
    thinkingDepth: 45,
    creativity: 48,
    communicationClarity: 52,
    executionOriented: 40,
    collaborationSignal: 47
  };

  // 최종 역량 점수 (성장)
  const finalScores = {
    questionQuality: 72,
    thinkingDepth: 68,
    creativity: 65,
    communicationClarity: 70,
    executionOriented: 58,
    collaborationSignal: 67
  };

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now - (i * 24 * 60 * 60 * 1000));
    const progress = (days - i) / days; // 0.0 ~ 1.0

    const dayScores = {};
    for (const [key, initialValue] of Object.entries(initialScores)) {
      const finalValue = finalScores[key];
      const growth = finalValue - initialValue;
      // 선형 성장 + 약간의 랜덤 변동
      const currentScore = initialValue + (growth * progress) + (Math.random() * 4 - 2);
      dayScores[key] = Math.round(Math.max(0, Math.min(100, currentScore)));
    }

    history.push({
      userId: TEST_USER_ID,
      date: date.toISOString().split('T')[0], // YYYY-MM-DD
      competencies: dayScores,
      messageCount: Math.floor(Math.random() * 5) + (progress * 10)
    });
  }

  return { history, finalScores };
}

// 일일 퀘스트 생성
function generateDailyQuests() {
  const today = new Date().toISOString().split('T')[0];
  const quests = [
    {
      userId: TEST_USER_ID,
      questDate: today,
      questId: `quest-${today}-1`,
      title: 'AI 봇과 5번 대화하기',
      description: '오늘 AI 봇과 최소 5번의 대화를 나눠보세요',
      type: 'daily',
      targetCount: 5,
      currentCount: 3,
      completed: false,
      reward: {
        xp: 50,
        competencyBonus: 'questionQuality'
      },
      createdAt: new Date().toISOString(),
      expiresAt: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24시간
    },
    {
      userId: TEST_USER_ID,
      questDate: today,
      questId: `quest-${today}-2`,
      title: '깊이 있는 질문 던지기',
      description: '30자 이상의 질문을 3번 던져보세요',
      type: 'daily',
      targetCount: 3,
      currentCount: 2,
      completed: false,
      reward: {
        xp: 30,
        competencyBonus: 'thinkingDepth'
      },
      createdAt: new Date().toISOString(),
      expiresAt: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
    },
    {
      userId: TEST_USER_ID,
      questDate: today,
      questId: `quest-${today}-3`,
      title: '새로운 주제 탐색',
      description: '오늘 처음 대화하는 주제로 봇과 대화하기',
      type: 'daily',
      targetCount: 1,
      currentCount: 1,
      completed: true,
      completedAt: new Date().toISOString(),
      reward: {
        xp: 40,
        competencyBonus: 'creativity'
      },
      createdAt: new Date().toISOString(),
      expiresAt: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
    }
  ];

  return quests;
}

async function seedEnhancedTestData() {
  console.log('🌱 Starting to seed ENHANCED test data...\n');

  const allChatSessions = [];
  const allAnalytics = [];

  // 1. 채팅 세션 및 학습 분석 데이터 생성 (30일치)
  let sessionCounter = 1;
  const baseTimestamp = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30일 전부터 시작

  for (let day = 0; day < 30; day += 5) { // 5일 간격으로 대화 생성
    const conv = SAMPLE_CONVERSATIONS[sessionCounter % SAMPLE_CONVERSATIONS.length];
    const sessionId = `seed-session-${String(sessionCounter).padStart(3, '0')}`;

    for (let i = 0; i < conv.messages.length; i++) {
      const msg = conv.messages[i];
      const timestamp = baseTimestamp + (day * 24 * 60 * 60 * 1000) + (i * 60 * 60 * 1000);
      const messageId = `${sessionId}-${timestamp}`;

      // 채팅 세션
      allChatSessions.push({
        userId: TEST_USER_ID,
        sessionId,
        messageId,
        timestamp,
        botType: conv.botType,
        userMessage: msg.user,
        aiMessage: msg.ai,
        createdAt: new Date(timestamp).toISOString(),
        expiresAt: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30일 TTL
      });

      // 학습 분석 데이터
      allAnalytics.push(generateLearningAnalytics(
        TEST_USER_ID,
        sessionId,
        messageId,
        conv.botType,
        msg.user,
        timestamp
      ));
    }

    sessionCounter++;
  }

  console.log(`📝 Generated ${allChatSessions.length} chat messages`);
  console.log(`📊 Generated ${allAnalytics.length} analytics records\n`);

  // 2. 역량 히스토리 생성
  const { history: competencyHistory, finalScores } = generateCompetencyHistory(30);
  console.log(`📈 Generated ${competencyHistory.length} days of competency history\n`);

  // 3. 일일 퀘스트 생성
  const dailyQuests = generateDailyQuests();
  console.log(`🎯 Generated ${dailyQuests.length} daily quests\n`);

  // === DynamoDB 데이터 삽입 시작 ===

  // 채팅 세션 삽입
  console.log('💾 Inserting chat sessions...');
  for (const session of allChatSessions) {
    try {
      await docClient.send(new PutCommand({
        TableName: 'ai-co-learner-chat-sessions',
        Item: session
      }));
      console.log(`  ✓ Session ${session.sessionId}`);
    } catch (error) {
      console.error(`  ✗ Failed: ${error.message}`);
    }
  }

  // 학습 분석 데이터 삽입
  console.log('\n📈 Inserting learning analytics...');
  for (const analytics of allAnalytics) {
    try {
      await docClient.send(new PutCommand({
        TableName: 'ai-co-learner-learning-analytics',
        Item: analytics
      }));
      console.log(`  ✓ Analytics for ${analytics.messageId}`);
    } catch (error) {
      console.error(`  ✗ Failed: ${error.message}`);
    }
  }

  // 역량 점수 삽입 (최종 점수)
  console.log('\n🎯 Inserting final competency scores...');
  const competencies = generateCompetencyScores(TEST_USER_ID, finalScores);
  for (const comp of competencies) {
    try {
      await docClient.send(new PutCommand({
        TableName: 'ai-co-learner-user-competencies',
        Item: comp
      }));
      console.log(`  ✓ ${comp.competency}: ${comp.score}`);
    } catch (error) {
      console.error(`  ✗ Failed: ${error.message}`);
    }
  }

  // 역량 히스토리 삽입
  console.log('\n📊 Inserting competency history...');
  for (const dayData of competencyHistory) {
    try {
      await docClient.send(new PutCommand({
        TableName: 'ai-co-learner-competency-history',
        Item: dayData
      }));
      console.log(`  ✓ History for ${dayData.date}`);
    } catch (error) {
      console.error(`  ✗ Failed for ${dayData.date}: ${error.message}`);
    }
  }

  // 일일 퀘스트 삽입
  console.log('\n🎮 Inserting daily quests...');
  for (const quest of dailyQuests) {
    try {
      await docClient.send(new PutCommand({
        TableName: 'ai-co-learner-daily-quests',
        Item: quest
      }));
      console.log(`  ✓ Quest: ${quest.title} (${quest.currentCount}/${quest.targetCount})`);
    } catch (error) {
      console.error(`  ✗ Failed: ${error.message}`);
    }
  }

  console.log('\n✅ Enhanced test data seeding completed!\n');
  console.log('📌 Summary:');
  console.log(`   • Test account: testuser01@test.com`);
  console.log(`   • Chat messages: ${allChatSessions.length}`);
  console.log(`   • Analytics records: ${allAnalytics.length}`);
  console.log(`   • Competency scores: ${Object.keys(finalScores).length}`);
  console.log(`   • History days: ${competencyHistory.length}`);
  console.log(`   • Daily quests: ${dailyQuests.length}`);
  console.log('\n📊 Final Competency Scores:');
  for (const [key, value] of Object.entries(finalScores)) {
    console.log(`   • ${key}: ${value}`);
  }
}

seedEnhancedTestData().catch(console.error);
