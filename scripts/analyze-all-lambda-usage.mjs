import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';

const logsClient = new CloudWatchLogsClient({ region: 'ap-northeast-2' });

// Gemini 2.5 Flash 가격 (2026년 1월 기준)
const GEMINI_PRICING = {
  inputPer1M: 0.3, // $0.30 per 1M input tokens
  outputPer1M: 2.5, // $2.50 per 1M output tokens
};

// 분석할 Lambda 함수들
const LAMBDA_FUNCTIONS = [
  {
    name: 'chat-api',
    logGroup: '/aws/lambda/ai-co-learner-chat',
    tracked: true, // usage-tracking 테이블에 기록됨
  },
  {
    name: 'message-batch-analyzer',
    logGroup: '/aws/lambda/ai-co-learner-message-batch-analyzer',
    tracked: false, // 추적 안됨!
    estimatedInputTokensPerCall: 5000, // 배치 분석 프롬프트
    estimatedOutputTokensPerCall: 2000, // JSON 응답
  },
  {
    name: 'assessment-analyzer',
    logGroup: '/aws/lambda/ai-co-learner-assessment-analyzer',
    tracked: false, // 추적 안됨!
    estimatedInputTokensPerCall: 2000,
    estimatedOutputTokensPerCall: 1000,
  },
];

async function countLambdaInvocations(logGroup, startTime, endTime) {
  let count = 0;
  let nextToken = null;

  try {
    do {
      const command = new FilterLogEventsCommand({
        logGroupName: logGroup,
        filterPattern: 'START RequestId',
        startTime,
        endTime,
        nextToken,
      });
      const result = await logsClient.send(command);
      count += result.events?.length || 0;
      nextToken = result.nextToken;
    } while (nextToken);
  } catch (error) {
    console.log(`  ⚠️ 로그 조회 실패: ${error.message}`);
    return 0;
  }

  return count;
}

async function analyzeAllLambdaUsage() {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  console.log('='.repeat(100));
  console.log('🔍 모든 Lambda의 Gemini API 사용량 분석 (최근 7일)');
  console.log('='.repeat(100));
  console.log(
    `분석 기간: ${new Date(sevenDaysAgo).toISOString().split('T')[0]} ~ ${new Date(now).toISOString().split('T')[0]}\n`
  );

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0;

  for (const lambda of LAMBDA_FUNCTIONS) {
    console.log(`\n📦 ${lambda.name}`);
    console.log('-'.repeat(50));

    if (lambda.tracked) {
      console.log('  ✅ usage-tracking 테이블에 기록됨 (별도 분석 스크립트 참조)');
      continue;
    }

    const invocations = await countLambdaInvocations(lambda.logGroup, sevenDaysAgo, now);
    console.log(`  호출 횟수: ${invocations.toLocaleString()}회`);

    if (invocations > 0) {
      const inputTokens = invocations * lambda.estimatedInputTokensPerCall;
      const outputTokens = invocations * lambda.estimatedOutputTokensPerCall;
      const cost =
        (inputTokens / 1_000_000) * GEMINI_PRICING.inputPer1M +
        (outputTokens / 1_000_000) * GEMINI_PRICING.outputPer1M;

      console.log(`  예상 입력 토큰: ${inputTokens.toLocaleString()} (${lambda.estimatedInputTokensPerCall}/호출)`);
      console.log(
        `  예상 출력 토큰: ${outputTokens.toLocaleString()} (${lambda.estimatedOutputTokensPerCall}/호출)`
      );
      console.log(`  예상 비용: $${cost.toFixed(4)}`);

      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;
      totalCost += cost;
    }
  }

  console.log('\n' + '='.repeat(100));
  console.log('📊 추적되지 않은 Lambda 총계 (추정치)');
  console.log('='.repeat(100));
  console.log(`총 입력 토큰: ${totalInputTokens.toLocaleString()}`);
  console.log(`총 출력 토큰: ${totalOutputTokens.toLocaleString()}`);
  console.log(`총 예상 비용: $${totalCost.toFixed(4)}`);

  console.log('\n' + '='.repeat(100));
  console.log('💡 비용 발생 원인 분석');
  console.log('='.repeat(100));
  console.log('1. message-batch-analyzer: 5분마다 실행 → 하루 288회, 7일 = 2,016회');
  console.log('2. 각 호출당 약 5,000 입력 + 2,000 출력 토큰 사용 (프롬프트 + 응답)');
  console.log('3. 해당 Lambda는 usage-tracking 테이블에 기록되지 않음!');
}

analyzeAllLambdaUsage().catch(console.error);
