import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({ region: 'ap-northeast-2' });

async function analyzeUsage() {
  const items = [];
  let lastKey = null;

  // 최근 7일 날짜 계산
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startDate = sevenDaysAgo.toISOString().split('T')[0];

  console.log(`분석 기간: ${startDate} ~ ${now.toISOString().split('T')[0]} (최근 7일)\n`);

  // 모든 데이터 스캔
  do {
    const command = new ScanCommand({
      TableName: 'ai-co-learner-usage-tracking',
      ExclusiveStartKey: lastKey,
      FilterExpression: '#d >= :startDate',
      ExpressionAttributeNames: { '#d': 'date' },
      ExpressionAttributeValues: { ':startDate': { S: startDate } },
    });
    const result = await client.send(command);
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  // Gemini 2.5 Flash 가격 (2026년 1월 기준)
  // https://ai.google.dev/gemini-api/docs/pricing
  const GEMINI_PRICING = {
    inputPer1M: 0.30, // $0.30 per 1M input tokens (Standard)
    outputPer1M: 2.50, // $2.50 per 1M output tokens (Standard, including thinking)
    // Batch API: 50% 할인 (input $0.15, output $1.25)
  };

  // 비용 계산 함수
  const calculateCost = (inputTokens, outputTokens) => {
    const inputCost = (inputTokens / 1_000_000) * GEMINI_PRICING.inputPer1M;
    const outputCost = (outputTokens / 1_000_000) * GEMINI_PRICING.outputPer1M;
    return inputCost + outputCost;
  };

  // 사용자별 집계
  const userStats = {};

  items.forEach((item) => {
    const userId = item.userId?.S || 'unknown';
    const inputTokens = parseInt(item.inputTokens?.N || 0);
    const outputTokens = parseInt(item.outputTokens?.N || 0);
    const totalTokens = parseInt(item.totalTokens?.N || 0);
    const date = item.date?.S || '';

    // Gemini 2.5 Flash 가격으로 재계산
    const cost = calculateCost(inputTokens, outputTokens);

    if (!userStats[userId]) {
      userStats[userId] = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cost: 0,
        count: 0,
        dates: new Set(),
      };
    }

    userStats[userId].inputTokens += inputTokens;
    userStats[userId].outputTokens += outputTokens;
    userStats[userId].totalTokens += totalTokens;
    userStats[userId].cost += cost;
    userStats[userId].count += 1;
    if (date) userStats[userId].dates.add(date);
  });

  // 총 토큰 기준으로 정렬
  const sortedUsers = Object.entries(userStats).sort(
    (a, b) => b[1].totalTokens - a[1].totalTokens
  );

  console.log('='.repeat(110));
  console.log('사용자별 토큰 사용량 TOP 10 (총 토큰 기준)');
  console.log('='.repeat(110));
  console.log(
    '순위  User ID                                   입력토큰      출력토큰        총토큰       비용($)  메시지수  활동일수'
  );
  console.log('-'.repeat(110));

  sortedUsers.slice(0, 10).forEach(([userId, stats], i) => {
    const rank = (i + 1).toString().padEnd(5);
    const id = userId.padEnd(42);
    const input = stats.inputTokens.toLocaleString().padStart(12);
    const output = stats.outputTokens.toLocaleString().padStart(12);
    const total = stats.totalTokens.toLocaleString().padStart(12);
    const cost = stats.cost.toFixed(4).padStart(12);
    const count = stats.count.toString().padStart(8);
    const days = stats.dates.size.toString().padStart(8);
    console.log(`${rank} ${id} ${input} ${output} ${total} ${cost} ${count} ${days}`);
  });

  console.log('-'.repeat(110));
  console.log('전체 사용자 수:', Object.keys(userStats).length + '명');
  console.log('전체 메시지 수:', items.length + '개');
  const totalTokens = Object.values(userStats).reduce((sum, s) => sum + s.totalTokens, 0);
  const totalCost = Object.values(userStats).reduce((sum, s) => sum + s.cost, 0);
  console.log('전체 토큰:', totalTokens.toLocaleString());
  console.log('전체 비용: $' + totalCost.toFixed(4));

  // 1위 사용자 상세 정보
  if (sortedUsers.length > 0) {
    const [topUserId, topStats] = sortedUsers[0];
    const inputCost = (topStats.inputTokens / 1_000_000) * GEMINI_PRICING.inputPer1M;
    const outputCost = (topStats.outputTokens / 1_000_000) * GEMINI_PRICING.outputPer1M;

    console.log('\n' + '='.repeat(110));
    console.log('🏆 최다 사용자 상세 정보');
    console.log('='.repeat(110));
    console.log('User ID:', topUserId);
    console.log('입력 토큰:', topStats.inputTokens.toLocaleString());
    console.log('출력 토큰:', topStats.outputTokens.toLocaleString());
    console.log('총 토큰:', topStats.totalTokens.toLocaleString());
    console.log('');
    console.log('💰 비용 상세 (Gemini 2.5 Flash 기준)');
    console.log(`   입력 비용: $${inputCost.toFixed(4)} (${topStats.inputTokens.toLocaleString()} tokens × $0.30/1M)`);
    console.log(`   출력 비용: $${outputCost.toFixed(4)} (${topStats.outputTokens.toLocaleString()} tokens × $2.50/1M)`);
    console.log(`   총 비용: $${topStats.cost.toFixed(4)}`);
    console.log('');
    console.log('총 메시지 수:', topStats.count);
    console.log('활동 일수:', topStats.dates.size + '일');
    console.log('활동 날짜:', [...topStats.dates].sort().join(', '));
  }

  // 가격 정보 출력
  console.log('\n' + '='.repeat(110));
  console.log('📋 Gemini 2.5 Flash 가격 정보 (2026년 1월 기준)');
  console.log('='.repeat(110));
  console.log(`   Standard - 입력: $${GEMINI_PRICING.inputPer1M}/1M tokens`);
  console.log(`   Standard - 출력: $${GEMINI_PRICING.outputPer1M}/1M tokens (thinking 포함)`);
  console.log('   Batch API 사용 시 50% 할인 (입력 $0.15, 출력 $1.25)');
  console.log('   출처: https://ai.google.dev/gemini-api/docs/pricing');
}

analyzeUsage().catch(console.error);
