import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'ap-northeast-2' });
const docClient = DynamoDBDocumentClient.from(client);

const TEST_USER_ID = '9438edcc-f0a1-7031-40b1-55fb2ba06416';
const BOT_TYPES = ['questioning', 'creative', 'critical', 'executive'];

// 현실적인 채팅 메시지 샘플
const SAMPLE_CONVERSATIONS = [
  {
    botType: 'questioning',
    messages: [
      { user: '머신러닝과 딥러닝의 차이가 뭔가요?', ai: '좋은 질문입니다! 머신러닝은 데이터로부터 패턴을 학습하는 알고리즘의 총칭이고, 딥러닝은 인공신경망을 여러 층으로 쌓아 복잡한 패턴을 학습하는 머신러닝의 한 분야입니다. 더 구체적으로 어떤 부분이 궁금하신가요?' },
      { user: '그럼 딥러닝이 항상 더 좋은 건가요?', ai: '반드시 그런 것은 아닙니다. 딥러닝은 대량의 데이터와 컴퓨팅 파워가 필요하고, 작은 데이터셋에서는 오히려 과적합될 수 있습니다. 전통적인 머신러닝 알고리즘이 더 적합한 경우도 많습니다.' },
      { user: '과적합이 뭔가요?', ai: '과적합(Overfitting)은 모델이 훈련 데이터에는 너무 잘 맞지만, 새로운 데이터에는 제대로 작동하지 않는 현상입니다. 시험 문제만 달달 외워서 실전에서 응용을 못하는 것과 비슷하다고 생각하시면 됩니다.' }
    ]
  },
  {
    botType: 'creative',
    messages: [
      { user: 'AI를 활용한 새로운 서비스 아이디어를 생각 중인데 어떤 게 좋을까요?', ai: '흥미롭네요! 먼저 어떤 분야에 관심이 있으신지 말씀해주시겠어요? 예를 들어 교육, 헬스케어, 엔터테인먼트 등 특정 도메인이 있나요?' },
      { user: '교육 분야에 관심이 있어요. 특히 학습 효율을 높이는 것.', ai: '좋은 선택입니다! 몇 가지 아이디어를 제안해볼게요:\n1. 개인 맞춤형 학습 경로 추천 시스템\n2. AI 기반 학습 패턴 분석 및 최적 학습 시간 추천\n3. 대화형 AI 튜터로 소크라테스식 질문법 적용\n\n이 중에서 어떤 방향이 마음에 드시나요?' },
      { user: '대화형 AI 튜터가 재미있을 것 같아요. 어떻게 차별화할 수 있을까요?', ai: '차별화 포인트를 생각해볼까요?\n- 학습자의 감정 상태를 인식하고 동기부여\n- 게이미피케이션 요소 추가 (퀘스트, 업적)\n- 협업 학습을 위한 AI 중재자 역할\n- 학습 스타일 자동 감지 및 맞춤 교수법 적용\n\n이런 요소들을 조합해보는 건 어떨까요?' }
    ]
  },
  {
    botType: 'critical',
    messages: [
      { user: 'AI가 모든 일자리를 대체할 거라는데 사실인가요?', ai: '이 주장은 과장된 측면이 있습니다. 몇 가지 관점에서 비판적으로 생각해봅시다:\n1. 역사적으로 기술 발전은 일자리를 대체하기보다 변화시켜왔습니다\n2. AI는 특정 작업은 잘하지만 복합적 판단이 필요한 업무는 여전히 어렵습니다\n3. 새로운 일자리도 계속 생겨나고 있습니다\n\n어떤 근거로 그런 주장을 하던가요?' },
      { user: '자동화로 단순 반복 업무가 사라진다는 기사를 봤어요.', ai: '맞습니다. 하지만 몇 가지 반론도 있습니다:\n- 단순 반복 업무 종사자들의 재교육 및 전환 가능성\n- AI 유지보수, 데이터 관리 등 새로운 직종 창출\n- 인간 고유의 창의성, 공감 능력이 필요한 영역은 여전히 존재\n\n중요한 것은 "대체"가 아니라 "협업"의 관점으로 접근하는 것 아닐까요?' }
    ]
  },
  {
    botType: 'executive',
    messages: [
      { user: 'Python 기초를 배우고 싶은데 어떻게 시작해야 할까요?', ai: '좋습니다! 구체적인 학습 계획을 세워볼까요?\n\n**1주차 목표:**\n- 변수, 데이터 타입, 조건문 학습\n- 매일 30분씩 코딩 연습\n- 간단한 계산기 프로그램 만들기\n\n오늘 바로 시작할 수 있는 첫 단계: Python 설치하고 "Hello World" 출력해보세요. 완료하시면 알려주세요!' },
      { user: 'Python 설치했어요!', ai: '훌륭합니다! 이제 다음 단계로 가죠.\n\n**오늘의 실습 과제:**\n```python\n# 1. 변수 선언해보기\nname = "내이름"\nage = 25\n\n# 2. 출력해보기\nprint(f"안녕하세요, 저는 {name}이고 {age}살입니다.")\n```\n\n이 코드를 실행해보고, 결과를 스크린샷으로 보여주시거나 설명해주세요. 막히는 부분이 있나요?' },
      { user: '실행했어요! 근데 이제 뭘 배워야 하나요?', ai: '좋아요! 다음 단계는 **조건문과 반복문**입니다.\n\n**이번 주 학습 계획:**\n- 월/화: if-else 조건문 (홀짝 판별 프로그램)\n- 수/목: for/while 반복문 (구구단 출력)\n- 금: 종합 미니 프로젝트 (숫자 맞추기 게임)\n\n오늘은 if-else부터 시작합시다. 간단한 홀짝 판별 프로그램을 만들어볼까요?' }
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

  // 약간의 랜덤 변동 추가 (±0.1)
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

// 역량 점수 생성
function generateCompetencyScores(userId) {
  const competencies = [
    { competency: 'questionQuality', score: 0.72, label: '질문력' },
    { competency: 'thinkingDepth', score: 0.68, label: '사고력' },
    { competency: 'creativity', score: 0.65, label: '창의력' },
    { competency: 'communicationClarity', score: 0.70, label: '소통력' },
    { competency: 'executionOriented', score: 0.58, label: '실행력' },
    { competency: 'collaborationSignal', score: 0.67, label: '협업력' }
  ];

  return competencies.map(comp => ({
    userId,
    competency: comp.competency,
    score: comp.score,
    lastUpdated: new Date().toISOString(),
    totalMessages: Math.floor(Math.random() * 30) + 20,
    improvementRate: (Math.random() * 0.2 - 0.05).toFixed(2) // -5% ~ +15%
  }));
}

async function seedTestData() {
  console.log('🌱 Starting to seed test data...\n');

  const allChatSessions = [];
  const allAnalytics = [];

  // 1. 채팅 세션 및 학습 분석 데이터 생성
  let sessionCounter = 1;
  const baseTimestamp = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7일 전부터 시작

  for (const conv of SAMPLE_CONVERSATIONS) {
    const sessionId = `seed-session-${String(sessionCounter).padStart(3, '0')}`;

    for (let i = 0; i < conv.messages.length; i++) {
      const msg = conv.messages[i];
      const timestamp = baseTimestamp + (sessionCounter * 24 * 60 * 60 * 1000) + (i * 60 * 60 * 1000);
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

  // 2. DynamoDB에 데이터 삽입
  console.log('💾 Inserting chat sessions...');
  for (const session of allChatSessions) {
    try {
      await docClient.send(new PutCommand({
        TableName: 'ai-co-learner-chat-sessions',
        Item: session
      }));
      console.log(`  ✓ Session ${session.sessionId} - Message ${session.messageId.split('-').pop()}`);
    } catch (error) {
      console.error(`  ✗ Failed to insert session ${session.sessionId}:`, error.message);
    }
  }

  console.log('\n📈 Inserting learning analytics...');
  for (const analytics of allAnalytics) {
    try {
      await docClient.send(new PutCommand({
        TableName: 'ai-co-learner-learning-analytics',
        Item: analytics
      }));
      console.log(`  ✓ Analytics for ${analytics.messageId}`);
    } catch (error) {
      console.error(`  ✗ Failed to insert analytics:`, error.message);
    }
  }

  // 3. 역량 점수 삽입
  console.log('\n🎯 Inserting competency scores...');
  const competencies = generateCompetencyScores(TEST_USER_ID);

  for (const comp of competencies) {
    try {
      await docClient.send(new PutCommand({
        TableName: 'ai-co-learner-user-competencies',
        Item: comp
      }));
      console.log(`  ✓ ${comp.competency}: ${(comp.score * 100).toFixed(1)}%`);
    } catch (error) {
      console.error(`  ✗ Failed to insert competency ${comp.competency}:`, error.message);
    }
  }

  console.log('\n✅ Test data seeding completed!');
  console.log(`\n📌 Test account: testuser01@test.com (${TEST_USER_ID})`);
  console.log(`📌 Chat sessions: ${sessionCounter - 1} sessions`);
  console.log(`📌 Total messages: ${allChatSessions.length}`);
  console.log(`📌 Analytics records: ${allAnalytics.length}`);
  console.log(`📌 Competencies: 6 scores`);
}

seedTestData().catch(console.error);
