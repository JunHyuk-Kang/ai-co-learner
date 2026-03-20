# AI Co-Learner AWS 아키텍처

## 시스템 구성도

```
┌─────────────────┐
│   사용자 (웹)    │
└────────┬────────┘
         │
         ├─── CloudFront (CDN) ──→ S3 (React 앱)
         │
         ├─── Cognito (인증)
         │
         └─── API Gateway (REST API)
                    ↓
         ┌──────────────────────┐
         │   Lambda 함수들       │
         ├──────────────────────┤
         │ • chat-api           │
         │ • message-batch-     │
         │   analyzer (5분마다) │
         │ • competency-        │
         │   aggregator (1일)   │
         └──────────┬───────────┘
                    ↓
         ┌──────────────────────┐
         │   DynamoDB 테이블     │
         ├──────────────────────┤
         │ • users              │
         │ • user-bots          │
         │ • chat-sessions      │
         │   (30일 TTL)         │
         │ • learning-analytics │
         │   (1년 TTL)          │
         │ • user-competencies  │
         │ • bot-templates      │
         └──────────────────────┘
                    ↓
              Bedrock AI
           (Llama 3.2 3B)
```

---

## 배포된 리소스

### 리전: ap-northeast-2 (서울)
- **S3 버킷**: `ai-co-learner-frontend-synnex`
- **Cognito User Pool ID**: `ap-northeast-2_OCntQ228q`
- **API Gateway ID**: `oz20zs5lfc`
- **API URL**: `https://oz20zs5lfc.execute-api.ap-northeast-2.amazonaws.com/prod`

### 리전: us-east-1 (버지니아)
- **Bedrock Model**: `meta.llama3-2-3b-instruct-v1:0`

---

## Lambda 함수 구성

### 1. chat-api
- **역할**: 채팅 메시지 처리, Bedrock 호출, DynamoDB 저장
- **트리거**: API Gateway
- **메모리**: 512 MB
- **타임아웃**: 30초
- **환경 변수**:
  - `SESSIONS_TABLE=ai-co-learner-chat-sessions`
  - `MODEL_ID=meta.llama3-2-3b-instruct-v1:0`

### 2. message-batch-analyzer
- **역할**: 5분마다 최근 메시지 배치 분석
- **트리거**: EventBridge (rate(5 minutes))
- **처리량**: 10-50개 메시지/배치
- **비용 최적화**: API 호출 90% 감소

### 3. competency-aggregator
- **역할**: 1일 1회 사용자 역량 점수 계산
- **트리거**: EventBridge (cron(0 2 * * ? *))
- **로직**: 최근 30일 데이터 기반 가중 평균

---

## DynamoDB 테이블 구조

### chat-sessions (30일 TTL)
```
PK: sessionId
SK: timestamp
- userId, userMessage, aiMessage
- expiresAt (30일 후 자동 삭제)
```

### learning-analytics (1년 TTL)
```
PK: userId
SK: timestamp
- messageId, analysisResult {
    questionQuality, thinkingDepth, creativity,
    communicationClarity, executionOriented,
    collaborationSignal
  }
- category, expiresAt (1년 후)
```

### user-competencies
```
PK: userId
SK: competency (역량명)
- score (0-100)
- historicalScores []
- totalMessages
```

---

## API 엔드포인트

### 사용자
- `GET /users/{userId}` - 프로필 조회
- `POST /users` - 프로필 생성
- `GET /users/{userId}/competencies` - 역량 데이터

### 봇
- `GET /bots/templates` - 템플릿 목록
- `GET /bots/user/{userId}` - 사용자 봇 목록
- `POST /bots/create` - 봇 생성

### 채팅
- `POST /chat` - 메시지 전송
- `GET /chat/session/{sessionId}` - 세션 조회

---

## 배포 명령어

### Lambda 함수 배포
```bash
cd lambda/chat-api
npm install
.\deploy.bat
```

### 프론트엔드 배포
```bash
npm run build
aws s3 sync dist s3://ai-co-learner-frontend-synnex --region ap-northeast-2 --delete
```

---

## 모니터링

### CloudWatch Logs
- `/aws/lambda/ai-co-learner-chat`
- `/aws/lambda/ai-co-learner-message-batch-analyzer`
- `/aws/lambda/ai-co-learner-competency-aggregator`

### 로그 확인
```bash
aws logs tail /aws/lambda/ai-co-learner-chat --since 5m --region ap-northeast-2 --format short
```

---

## 비용 (월 10만 메시지 기준)
- **DynamoDB**: $0.40
- **Lambda**: $0.50
- **Claude API**: $26.00
- **총계**: ~$28/월

---

## 참고 문서
- 상세 구축 가이드: `docs/archive/AWS_SERVERLESS_CHECKLIST.md`
- 진행 상황 기록: `docs/archive/AWS_PROGRESS.md`

---

**최종 업데이트**: 2025-11-27
