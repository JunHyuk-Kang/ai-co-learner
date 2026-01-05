# CloudWatch 모니터링 & 알림 가이드

> AI Co-Learner 프로젝트의 AWS CloudWatch 알림 설정 및 모니터링 가이드

---

## 목차
1. [개요](#개요)
2. [알림 항목](#알림-항목)
3. [SNS 토픽 생성](#sns-토픽-생성)
4. [CloudWatch Alarm 설정](#cloudwatch-alarm-설정)
5. [Lambda 에러 알림](#lambda-에러-알림)
6. [DynamoDB 사용량 알림](#dynamodb-사용량-알림)
7. [비용 알림](#비용-알림)
8. [알림 테스트](#알림-테스트)

---

## 개요

CloudWatch를 사용하여 Lambda 에러, DynamoDB 사용량, 비용 등을 모니터링하고 임계값 초과 시 이메일 알림을 받을 수 있습니다.

### 필요한 권한

- CloudWatch 읽기/쓰기 권한
- SNS 토픽 생성 권한
- Lambda 메트릭 조회 권한

---

## 알림 항목

| 항목 | 임계값 | 평가 주기 | 알림 우선도 |
|------|--------|-----------|-------------|
| Lambda 에러율 | > 5% | 5분 | 🔴 긴급 |
| Lambda 타임아웃 | > 50초 | 5분 | 🟡 경고 |
| DynamoDB Read Capacity | > 80% | 5분 | 🟡 경고 |
| DynamoDB Write Capacity | > 80% | 5분 | 🟡 경고 |
| Gemini API 일일 토큰 | > 1M tokens | 1일 | 🟢 정보 |
| 월간 예상 비용 | > $20 | 1일 | 🟡 경고 |

---

## SNS 토픽 생성

### 1. SNS 토픽 생성

```bash
# SNS 토픽 생성
aws sns create-topic \
  --name ai-co-learner-alerts \
  --region ap-northeast-2

# 출력 예시:
# {
#   "TopicArn": "arn:aws:sns:ap-northeast-2:ACCOUNT_ID:ai-co-learner-alerts"
# }
```

### 2. 이메일 구독 설정

```bash
# 이메일 구독 추가
aws sns subscribe \
  --topic-arn arn:aws:sns:ap-northeast-2:ACCOUNT_ID:ai-co-learner-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com \
  --region ap-northeast-2
```

**중요**: 이메일로 구독 확인 메일이 발송됩니다. 반드시 "Confirm subscription" 링크를 클릭해야 알림을 받을 수 있습니다.

### 3. 다중 이메일 구독

```bash
# 여러 이메일 주소에 알림 보내기
aws sns subscribe \
  --topic-arn arn:aws:sns:ap-northeast-2:ACCOUNT_ID:ai-co-learner-alerts \
  --protocol email \
  --notification-endpoint admin1@example.com \
  --region ap-northeast-2

aws sns subscribe \
  --topic-arn arn:aws:sns:ap-northeast-2:ACCOUNT_ID:ai-co-learner-alerts \
  --protocol email \
  --notification-endpoint admin2@example.com \
  --region ap-northeast-2
```

---

## CloudWatch Alarm 설정

### Lambda 에러율 알림 (> 5%)

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name ai-co-learner-lambda-errors \
  --alarm-description "Lambda 에러율 5% 초과" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Average \
  --period 300 \
  --threshold 0.05 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:ap-northeast-2:ACCOUNT_ID:ai-co-learner-alerts \
  --dimensions Name=FunctionName,Value=ai-co-learner-chat \
  --region ap-northeast-2
```

**설명**:
- `--period 300`: 5분마다 평가
- `--threshold 0.05`: 5% 에러율
- `--evaluation-periods 1`: 1회 연속 위반 시 알림

### Lambda 타임아웃 임박 알림 (> 50초)

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name ai-co-learner-lambda-timeout \
  --alarm-description "Lambda 실행 시간 50초 초과 (타임아웃 임박)" \
  --metric-name Duration \
  --namespace AWS/Lambda \
  --statistic Maximum \
  --period 300 \
  --threshold 50000 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:ap-northeast-2:ACCOUNT_ID:ai-co-learner-alerts \
  --dimensions Name=FunctionName,Value=ai-co-learner-chat \
  --region ap-northeast-2
```

**주의**: Duration은 밀리초 단위이므로 50초 = 50000ms

---

## Lambda 에러 알림

### 모든 Lambda 함수에 알림 설정

```bash
# 8개 Lambda 함수 목록
FUNCTIONS=(
  "ai-co-learner-chat"
  "ai-co-learner-message-batch-analyzer"
  "ai-co-learner-competency-aggregator"
  "ai-co-learner-quest-generator"
  "ai-co-learner-quest-evaluator"
  "ai-co-learner-achievement-evaluator"
  "ai-co-learner-learning-pattern-analyzer"
  "ai-co-learner-assessment-analyzer"
)

# 각 함수에 에러 알림 설정
for FUNC in "${FUNCTIONS[@]}"; do
  aws cloudwatch put-metric-alarm \
    --alarm-name "${FUNC}-errors" \
    --alarm-description "${FUNC} 에러 발생" \
    --metric-name Errors \
    --namespace AWS/Lambda \
    --statistic Sum \
    --period 300 \
    --threshold 1 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 1 \
    --alarm-actions arn:aws:sns:ap-northeast-2:ACCOUNT_ID:ai-co-learner-alerts \
    --dimensions Name=FunctionName,Value="${FUNC}" \
    --region ap-northeast-2
done
```

---

## DynamoDB 사용량 알림

### Read Capacity 사용률 알림 (> 80%)

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name ai-co-learner-dynamodb-read-capacity \
  --alarm-description "DynamoDB Read Capacity 80% 초과" \
  --metric-name ConsumedReadCapacityUnits \
  --namespace AWS/DynamoDB \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:ap-northeast-2:ACCOUNT_ID:ai-co-learner-alerts \
  --dimensions Name=TableName,Value=ai-co-learner-chat-sessions \
  --region ap-northeast-2
```

### Write Capacity 사용률 알림 (> 80%)

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name ai-co-learner-dynamodb-write-capacity \
  --alarm-description "DynamoDB Write Capacity 80% 초과" \
  --metric-name ConsumedWriteCapacityUnits \
  --namespace AWS/DynamoDB \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:ap-northeast-2:ACCOUNT_ID:ai-co-learner-alerts \
  --dimensions Name=TableName,Value=ai-co-learner-chat-sessions \
  --region ap-northeast-2
```

---

## 비용 알림

### AWS Budgets를 사용한 비용 알림

CloudWatch Alarms는 비용 알림을 직접 지원하지 않으므로 AWS Budgets를 사용합니다.

```bash
# 월간 예산 $20 설정
aws budgets create-budget \
  --account-id ACCOUNT_ID \
  --budget file://budget.json \
  --notifications-with-subscribers file://notifications.json
```

**budget.json**:
```json
{
  "BudgetName": "ai-co-learner-monthly-budget",
  "BudgetLimit": {
    "Amount": "20",
    "Unit": "USD"
  },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
```

**notifications.json**:
```json
[
  {
    "Notification": {
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80,
      "ThresholdType": "PERCENTAGE",
      "NotificationType": "ACTUAL"
    },
    "Subscribers": [
      {
        "SubscriptionType": "EMAIL",
        "Address": "your-email@example.com"
      }
    ]
  }
]
```

---

## 알림 테스트

### 1. SNS 토픽 테스트

```bash
# 테스트 메시지 발송
aws sns publish \
  --topic-arn arn:aws:sns:ap-northeast-2:ACCOUNT_ID:ai-co-learner-alerts \
  --message "CloudWatch 알림 테스트" \
  --subject "AI Co-Learner 알림 테스트" \
  --region ap-northeast-2
```

이메일로 테스트 메시지가 도착하면 SNS 설정이 올바르게 되었습니다.

### 2. CloudWatch Alarm 수동 트리거

```bash
# 알림 상태를 ALARM으로 변경 (테스트용)
aws cloudwatch set-alarm-state \
  --alarm-name ai-co-learner-lambda-errors \
  --state-value ALARM \
  --state-reason "Manual test" \
  --region ap-northeast-2
```

알림이 발송되면 CloudWatch Alarm 설정이 올바르게 되었습니다.

---

## 알림 확인 및 관리

### 현재 설정된 알림 목록 조회

```bash
# 모든 알림 조회
aws cloudwatch describe-alarms \
  --region ap-northeast-2 \
  --query 'MetricAlarms[?starts_with(AlarmName, `ai-co-learner`)].{Name:AlarmName,State:StateValue}' \
  --output table
```

### 알림 삭제

```bash
# 특정 알림 삭제
aws cloudwatch delete-alarms \
  --alarm-names ai-co-learner-lambda-errors \
  --region ap-northeast-2
```

### SNS 구독 취소

```bash
# 구독 ARN 조회
aws sns list-subscriptions-by-topic \
  --topic-arn arn:aws:sns:ap-northeast-2:ACCOUNT_ID:ai-co-learner-alerts \
  --region ap-northeast-2

# 구독 취소
aws sns unsubscribe \
  --subscription-arn arn:aws:sns:ap-northeast-2:ACCOUNT_ID:ai-co-learner-alerts:SUBSCRIPTION_ID \
  --region ap-northeast-2
```

---

## 모범 사례

### 1. 알림 피로도 방지
- 임계값을 너무 낮게 설정하지 마세요
- `evaluation-periods`를 2 이상으로 설정하여 일시적 스파이크 무시
- 중요한 알림만 이메일로, 정보성 알림은 CloudWatch 대시보드로

### 2. 알림 우선순위 분류
- **긴급 (🔴)**: Lambda 에러율, API 다운타임 → 즉시 대응
- **경고 (🟡)**: 용량 초과, 타임아웃 임박 → 24시간 내 대응
- **정보 (🟢)**: 사용량 통계, 트렌드 → 주간 리뷰

### 3. 정기적인 알림 검토
- 월 1회 알림 설정 검토
- 불필요한 알림 제거
- 임계값 조정 (실제 사용 패턴 기반)

---

## 트러블슈팅

### 문제 1: 알림이 오지 않음

**원인**:
- SNS 구독 미확인
- 이메일이 스팸함에 들어감
- CloudWatch Alarm 상태가 INSUFFICIENT_DATA

**해결**:
1. SNS 구독 상태 확인:
   ```bash
   aws sns list-subscriptions \
     --region ap-northeast-2 \
     --query 'Subscriptions[?TopicArn==`arn:aws:sns:ap-northeast-2:ACCOUNT_ID:ai-co-learner-alerts`]'
   ```
   상태가 `PendingConfirmation`이면 이메일 확인 필요

2. 스팸함 확인
3. CloudWatch Alarm 상태 확인:
   ```bash
   aws cloudwatch describe-alarms \
     --alarm-names ai-co-learner-lambda-errors \
     --region ap-northeast-2
   ```

### 문제 2: 알림이 너무 많이 옴

**해결**:
- `evaluation-periods` 증가 (1 → 2 또는 3)
- 임계값 조정
- 알림 주기 증가 (`period` 300 → 600)

### 문제 3: 비용 알림이 작동하지 않음

**원인**: AWS Budgets는 별도 서비스이며 CloudWatch Alarms와 독립적

**해결**: AWS Budgets 콘솔에서 직접 확인
https://console.aws.amazon.com/billing/home#/budgets

---

## 참고 자료

- [AWS CloudWatch 공식 문서](https://docs.aws.amazon.com/cloudwatch/)
- [AWS SNS 공식 문서](https://docs.aws.amazon.com/sns/)
- [AWS Budgets 공식 문서](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html)

---

**마지막 업데이트**: 2025-12-31
**작성자**: Claude Sonnet 4.5
**버전**: 1.0
