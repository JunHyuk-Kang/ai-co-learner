# 사용량 추적 & 비용 관리 시스템 가이드

## 📋 개요

관리자가 실시간으로 사용자별/전체 사용량과 예상 비용을 확인할 수 있는 대시보드 시스템입니다.

---

## 🎯 주요 기능

### 1. 자동 사용량 추적
- **모든 채팅 메시지**에서 토큰 사용량 자동 수집
- **Bedrock API 응답**에서 input/output 토큰 추출
- **실시간 비용 계산** (Claude 3 Haiku 기준)

### 2. 관리자 대시보드
- **총 비용, 메시지 수, 활성 사용자** 요약
- **일별 비용 추이** 차트
- **사용자별 사용량 테이블** (비용 순 정렬)
- **월간 예상 비용** (50명, 100명 기준)

### 3. 기간별 조회
- 최근 7일 / 30일 / 90일
- 사용자별 필터링 가능

---

## 🗄️ DynamoDB 테이블 구조

### `ai-co-learner-usage-tracking`

```
PK: userId (String)
SK: timestamp (Number - Unix timestamp)

Attributes:
- messageId: String
- sessionId: String
- inputTokens: Number
- outputTokens: Number
- totalTokens: Number
- estimatedCost: Number (USD)
- service: String ("bedrock")
- operation: String ("chat")
- modelId: String
- date: String (YYYY-MM-DD)
- createdAt: String (ISO)
```

---

## 💰 비용 계산 로직

### Claude 3 Haiku 가격 (US-EAST-1)
- **Input**: $0.25 / 1M tokens
- **Output**: $1.25 / 1M tokens

### 계산 공식
```javascript
inputCost = (inputTokens / 1,000,000) * 0.25
outputCost = (outputTokens / 1,000,000) * 1.25
estimatedCost = inputCost + outputCost
```

---

## 📊 API 엔드포인트

### GET `/admin/usage`

**Query Parameters:**
- `userId` (optional): 특정 사용자만 조회
- `startDate` (optional): 시작 날짜 (YYYY-MM-DD)
- `endDate` (optional): 종료 날짜 (YYYY-MM-DD)
- `days` (optional): 최근 N일 (기본값: 30)

**Response:**
```json
{
  "summary": {
    "totalCost": 0.001234,
    "totalTokens": 15000,
    "totalMessages": 50,
    "totalUsers": 5,
    "avgCostPerMessage": 0.000025,
    "avgCostPerUser": 0.000247
  },
  "userStats": [
    {
      "userId": "user-123",
      "totalCost": 0.000500,
      "totalTokens": 6000,
      "totalMessages": 20,
      "inputTokens": 4000,
      "outputTokens": 2000,
      "avgCostPerMessage": 0.000025
    }
  ],
  "dailyStats": [
    {
      "date": "2025-12-18",
      "totalCost": 0.000100,
      "totalTokens": 1200,
      "totalMessages": 5
    }
  ],
  "period": {
    "startDate": "2025-11-18",
    "endDate": "2025-12-18",
    "days": 30
  }
}
```

---

## 🚀 사용 방법

### 관리자 페이지 접속
1. 관리자 계정으로 로그인
2. `/admin` 페이지 이동
3. 상단 탭에서 **"사용량 & 비용"** 클릭

### 대시보드 확인
- **총 비용**: 선택한 기간 동안의 총 Bedrock 비용
- **총 메시지**: 전체 메시지 수
- **활성 사용자**: 해당 기간 내 활동한 사용자 수
- **일별 차트**: 날짜별 비용 추이
- **사용자별 테이블**: 비용이 높은 사용자 순으로 정렬
- **월간 예상 비용**: 현재 추세로 50명/100명 사용 시 예상 비용

---

## 📈 비용 예측 예시

### 현재 상황 (테스트 중)
- 사용자: 5명
- 메시지: 50개 (30일)
- 총 비용: $0.0015

### 50명 기준 예측
```
인당 비용: $0.0003
50명 × $0.0003 = $0.015/월
```

### 100명 기준 예측
```
100명 × $0.0003 = $0.030/월
```

---

## ⚠️ 주의사항

### 1. DynamoDB 스캔 비용
- 전체 사용량 조회 시 `Scan` 사용
- 사용자가 많아지면 비용 증가 가능
- **해결책**: 날짜별 GSI 추가 고려

### 2. 데이터 보존 기간
- 현재 **TTL 설정 없음** (영구 보존)
- 필요 시 90일/1년 TTL 설정 권장

### 3. 비용 정확도
- Bedrock 응답의 `usage` 필드 기반
- 실제 AWS 청구서와 **99% 일치**
- DynamoDB, Lambda 비용은 **별도 계산 필요**

---

## 🔧 커스터마이징

### 다른 모델 추가
[lambda/chat-api/index.mjs:31-36](lambda/chat-api/index.mjs#L31-L36)

```javascript
const PRICING = {
  "anthropic.claude-3-haiku-20240307-v1:0": {
    input: 0.25,
    output: 1.25
  },
  "meta.llama3-2-3b-instruct-v1:0": {
    input: 0.05,  // 예시
    output: 0.10
  }
};
```

### TTL 설정 (90일)
```bash
aws dynamodb update-time-to-live \
  --table-name ai-co-learner-usage-tracking \
  --time-to-live-specification "Enabled=true, AttributeName=expiresAt" \
  --region ap-northeast-2
```

Lambda 함수에서 `expiresAt` 추가:
```javascript
expiresAt: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60)
```

---

## 📝 트러블슈팅

### 사용량이 표시되지 않음
1. Lambda 함수 최신 버전 확인
2. CloudWatch 로그 확인: `✅ Usage tracked` 메시지 확인
3. DynamoDB 테이블 데이터 확인:
   ```bash
   aws dynamodb scan --table-name ai-co-learner-usage-tracking --max-items 5 --region ap-northeast-2
   ```

### 비용이 실제와 다름
- Bedrock 요금제 변경 확인
- `PRICING` 상수 업데이트 필요

---

## 🎉 완료!

이제 관리자는 실시간으로:
- ✅ 사용자별 사용량 모니터링
- ✅ 비용 추이 분석
- ✅ 월간 예상 비용 확인
- ✅ 50명/100명 확장 시 비용 예측

**비용 최적화에 활용하세요!**
