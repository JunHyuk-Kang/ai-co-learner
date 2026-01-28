// 숨겨진 비용 계산기 (usage-tracking에 기록되지 않는 Lambda)

// Gemini 2.5 Flash 가격 (2026년 1월)
const GEMINI_PRICING = {
  inputPer1M: 0.30,
  outputPer1M: 2.50,
};

// message-batch-analyzer 통계
const BATCH_ANALYZER = {
  invocations: 5560, // 7일간 호출 횟수 (CloudWatch 데이터)
  batchSize: 30, // 한 번에 최대 30개 메시지 분석
  // 프롬프트 구성:
  // - 시스템 프롬프트: ~800 토큰
  // - 메시지당: ~100 토큰 (userMessage + aiMessage)
  // - 최대 30개 메시지: 800 + (30 * 100) = 3,800 토큰
  estimatedInputTokensPerCall: 4000,
  // 출력 (JSON 배열):
  // - 메시지당: ~80 토큰
  // - 최대 30개: 30 * 80 = 2,400 토큰
  estimatedOutputTokensPerCall: 2500,
};

// chat-api 통계 (usage-tracking에서 가져온 데이터)
const CHAT_API = {
  totalInputTokens: 609_645, // 최근 7일
  totalOutputTokens: 19_692,
};

console.log('='.repeat(100));
console.log('🔍 숨겨진 비용 분석 - message-batch-analyzer (최근 7일)');
console.log('='.repeat(100));

// message-batch-analyzer 비용
const batchInputTokens = BATCH_ANALYZER.invocations * BATCH_ANALYZER.estimatedInputTokensPerCall;
const batchOutputTokens = BATCH_ANALYZER.invocations * BATCH_ANALYZER.estimatedOutputTokensPerCall;
const batchInputCost = (batchInputTokens / 1_000_000) * GEMINI_PRICING.inputPer1M;
const batchOutputCost = (batchOutputTokens / 1_000_000) * GEMINI_PRICING.outputPer1M;
const batchTotalCost = batchInputCost + batchOutputCost;

console.log('\n📦 message-batch-analyzer');
console.log('-'.repeat(50));
console.log(`호출 횟수: ${BATCH_ANALYZER.invocations.toLocaleString()}회`);
console.log(`추정 입력 토큰: ${batchInputTokens.toLocaleString()} (${BATCH_ANALYZER.estimatedInputTokensPerCall}/호출)`);
console.log(`추정 출력 토큰: ${batchOutputTokens.toLocaleString()} (${BATCH_ANALYZER.estimatedOutputTokensPerCall}/호출)`);
console.log(`입력 비용: $${batchInputCost.toFixed(4)}`);
console.log(`출력 비용: $${batchOutputCost.toFixed(4)}`);
console.log(`총 비용: $${batchTotalCost.toFixed(2)}`);

// chat-api 비용 (추적된 것)
const chatInputCost = (CHAT_API.totalInputTokens / 1_000_000) * GEMINI_PRICING.inputPer1M;
const chatOutputCost = (CHAT_API.totalOutputTokens / 1_000_000) * GEMINI_PRICING.outputPer1M;
const chatTotalCost = chatInputCost + chatOutputCost;

console.log('\n📦 chat-api (usage-tracking에서 추적됨)');
console.log('-'.repeat(50));
console.log(`입력 토큰: ${CHAT_API.totalInputTokens.toLocaleString()}`);
console.log(`출력 토큰: ${CHAT_API.totalOutputTokens.toLocaleString()}`);
console.log(`입력 비용: $${chatInputCost.toFixed(4)}`);
console.log(`출력 비용: $${chatOutputCost.toFixed(4)}`);
console.log(`총 비용: $${chatTotalCost.toFixed(4)}`);

// 총계
const totalCost = batchTotalCost + chatTotalCost;
const totalCostKRW = totalCost * 1370; // 환율 가정

console.log('\n' + '='.repeat(100));
console.log('💰 총 비용 요약 (최근 7일)');
console.log('='.repeat(100));
console.log(`chat-api (추적됨): $${chatTotalCost.toFixed(4)}`);
console.log(`message-batch-analyzer (숨겨짐): $${batchTotalCost.toFixed(2)}`);
console.log('-'.repeat(50));
console.log(`총 합계: $${totalCost.toFixed(2)} (약 ₩${totalCostKRW.toLocaleString()})`);

console.log('\n' + '='.repeat(100));
console.log('⚠️ 문제점 분석');
console.log('='.repeat(100));
console.log('1. message-batch-analyzer가 5분마다 실행됨 (하루 288회)');
console.log('2. LOOKBACK_MINUTES = 43200 (30일) - 매번 30일치 메시지 조회');
console.log('3. "analyzed" 플래그가 제대로 설정되지 않아 동일 메시지 반복 분석');
console.log('4. 총 5,560회 호출 × 4,000 입력토큰 = 22,240,000 토큰 낭비');
console.log('');
console.log(`숨겨진 비용이 추적된 비용의 ${(batchTotalCost / chatTotalCost * 100).toFixed(0)}배!`);

console.log('\n' + '='.repeat(100));
console.log('🔧 해결 방안');
console.log('='.repeat(100));
console.log('1. LOOKBACK_MINUTES를 5 (원래 의도)로 복원');
console.log('2. analyzed 플래그 설정 로직 수정 (UpdateCommand 사용)');
console.log('3. message-batch-analyzer에도 usage tracking 추가');
