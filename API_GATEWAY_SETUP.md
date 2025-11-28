# API Gateway 설정 가이드

Lambda 함수가 여러 엔드포인트를 지원하도록 업데이트되었습니다.
API Gateway에서 다음 경로들을 설정해야 합니다.

## 필요한 API 경로

### 1. POST /chat
- 채팅 메시지 전송
- Lambda 프록시 통합

### 2. GET /chat/session/{sessionId}
- 세션 조회
- Lambda 프록시 통합
- Path parameter: `sessionId`

### 3. GET /bots/templates
- 봇 템플릿 목록 조회
- Lambda 프록시 통합

### 4. GET /bots/user/{userId}
- 사용자의 봇 목록 조회
- Lambda 프록시 통합
- Path parameter: `userId`

### 5. POST /bots/create
- 새 봇 생성
- Lambda 프록시 통합

## AWS Console에서 설정하는 방법

### 1. API Gateway Console 접속
- https://console.aws.amazon.com/apigateway/
- 리전: ap-northeast-2 (서울)
- API 선택: `ai-co-learner-api` (ID: oz20zs5lfc)

### 2. 리소스 생성

#### A. /chat/session/{sessionId} 경로 생성
1. Resources 탭에서 `/` 선택
2. "Create Resource" 클릭
3. Resource Name: `chat`
4. Resource Path: `chat`
5. CORS 활성화
6. Create Resource

7. `/chat` 선택 후 "Create Resource"
8. Resource Name: `session`
9. Resource Path: `session`
10. Create Resource

11. `/chat/session` 선택 후 "Create Resource"
12. Resource Name: `{sessionId}`
13. Resource Path: `{sessionId}`
14. Create Resource

15. `GET` 메서드 추가
   - Method Type: GET
   - Integration type: Lambda Function
   - Lambda Function: `ai-co-learner-chat`
   - Lambda Proxy integration: 체크
   - Save

#### B. /bots 경로 생성
1. Resources 탭에서 `/` 선택
2. "Create Resource"
3. Resource Name: `bots`
4. Resource Path: `bots`
5. CORS 활성화
6. Create Resource

#### C. /bots/templates 경로
1. `/bots` 선택 후 "Create Resource"
2. Resource Name: `templates`
3. Resource Path: `templates`
4. Create Resource

5. `GET` 메서드 추가
   - Lambda Function: `ai-co-learner-chat`
   - Lambda Proxy integration: 체크

#### D. /bots/user/{userId} 경로
1. `/bots` 선택 후 "Create Resource"
2. Resource Name: `user`
3. Resource Path: `user`
4. Create Resource

5. `/bots/user` 선택 후 "Create Resource"
6. Resource Name: `{userId}`
7. Resource Path: `{userId}`
8. Create Resource

9. `GET` 메서드 추가
   - Lambda Function: `ai-co-learner-chat`
   - Lambda Proxy integration: 체크

#### E. /bots/create 경로
1. `/bots` 선택 후 "Create Resource"
2. Resource Name: `create`
3. Resource Path: `create`
4. Create Resource

5. `POST` 메서드 추가
   - Lambda Function: `ai-co-learner-chat`
   - Lambda Proxy integration: 체크

### 3. CORS 설정
각 메서드에 대해:
1. 메서드 선택
2. "Enable CORS" 클릭
3. 다음 헤더 허용:
   - Access-Control-Allow-Origin: *
   - Access-Control-Allow-Headers: Content-Type,Authorization
   - Access-Control-Allow-Methods: GET,POST,OPTIONS

### 4. 배포
1. "Deploy API" 클릭
2. Stage: `prod`
3. Deploy

## 최종 엔드포인트 URL

모든 경로는 다음 베이스 URL 사용:
```
https://oz20zs5lfc.execute-api.ap-northeast-2.amazonaws.com/prod
```

예시:
- POST https://oz20zs5lfc.execute-api.ap-northeast-2.amazonaws.com/prod/chat
- GET https://oz20zs5lfc.execute-api.ap-northeast-2.amazonaws.com/prod/chat/session/bot-123
- GET https://oz20zs5lfc.execute-api.ap-northeast-2.amazonaws.com/prod/bots/templates
- GET https://oz20zs5lfc.execute-api.ap-northeast-2.amazonaws.com/prod/bots/user/user-123
- POST https://oz20zs5lfc.execute-api.ap-northeast-2.amazonaws.com/prod/bots/create

## 테스트

PowerShell에서 테스트:
```powershell
# 템플릿 조회
Invoke-RestMethod -Uri "https://oz20zs5lfc.execute-api.ap-northeast-2.amazonaws.com/prod/bots/templates" -Method GET

# 채팅 메시지 전송
$body = @{
    userId = "test-user"
    sessionId = "test-session"
    message = "안녕하세요"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://oz20zs5lfc.execute-api.ap-northeast-2.amazonaws.com/prod/chat" -Method POST -Body $body -ContentType "application/json"
```
