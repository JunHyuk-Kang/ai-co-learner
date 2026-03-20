# Usage Tracking DynamoDB 테이블 생성

## 테이블 생성 명령어

```bash
aws dynamodb create-table \
  --table-name ai-co-learner-usage-tracking \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=timestamp,AttributeType=N \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
    AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region ap-northeast-2
```

## 테이블 구조

```
PK: userId (String)
SK: timestamp (Number - Unix timestamp)

Attributes:
- messageId (String)
- sessionId (String)
- inputTokens (Number)
- outputTokens (Number)
- totalTokens (Number)
- estimatedCost (Number) - USD
- service (String) - "bedrock", "dynamodb", "lambda"
- operation (String) - "chat", "analysis", etc.
- createdAt (String - ISO)
```

## GSI (Optional - 날짜별 조회용)

```bash
aws dynamodb update-table \
  --table-name ai-co-learner-usage-tracking \
  --attribute-definitions \
    AttributeName=date,AttributeType=S \
  --global-secondary-index-updates \
    "[{\"Create\":{\"IndexName\":\"DateIndex\",\"KeySchema\":[{\"AttributeName\":\"date\",\"KeyType\":\"HASH\"}],\"Projection\":{\"ProjectionType\":\"ALL\"},\"ProvisionedThroughput\":{\"ReadCapacityUnits\":5,\"WriteCapacityUnits\":5}}}]" \
  --region ap-northeast-2
```
