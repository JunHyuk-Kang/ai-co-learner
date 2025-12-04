# AWS 서버리스 아키텍처 구축 체크리스트
## AI Co-Learner 프로젝트 - 완전 가이드

---

## 📋 프로젝트 개요

- **목표**: AI Co-Learner를 AWS 서버리스 아키텍처로 완전 마이그레이션
- **예상 비용**: 월 $7.09 (50명 기준)
- **예상 기간**: 2-3주
- **난이도**: 중급

---

## 🎯 Phase 1: AWS 계정 및 기본 설정 (1일차)

### ✅ AWS 계정 준비
- [ ] AWS 계정 생성 또는 로그인
- [ ] 루트 계정 MFA 활성화 (보안)
- [ ] IAM 사용자 생성 (관리자 권한)
- [ ] AWS CLI 설치 및 설정
  ```bash
  aws configure
  # Access Key ID: [발급받은 키]
  # Secret Access Key: [발급받은 시크릿]
  # Default region: us-east-1
  # Default output format: json
  ```

### ✅ 비용 관리 설정
- [ ] AWS Budgets 설정 ($10/월 알림)
- [ ] Cost Explorer 활성화
- [ ] 빌링 알림 활성화 ($5, $10, $20 임계값)
- [ ] 무료 티어 사용량 추적 설정

### ✅ 개발 환경 준비
- [ ] Node.js 18+ 설치 확인
- [ ] AWS SAM CLI 설치 (선택사항)
  ```bash
  pip install aws-sam-cli
  ```
- [ ] VS Code AWS Toolkit 설치 (선택사항)

---

## 🎯 Phase 2: 프론트엔드 호스팅 (2일차)

### ✅ S3 버킷 생성 및 설정
- [ ] S3 버킷 생성
  - 버킷 이름: `ai-co-learner-frontend-[랜덤문자열]`
  - 리전: `us-east-1`
  - 퍼블릭 액세스 차단 설정 해제 (CloudFront로 보호)

- [ ] 정적 웹사이트 호스팅 활성화
  - 인덱스 문서: `index.html`
  - 오류 문서: `index.html` (SPA 라우팅용)

- [ ] 버킷 정책 설정
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "PublicReadGetObject",
        "Effect": "Allow",
        "Principal": "*",
        "Action": "s3:GetObject",
        "Resource": "arn:aws:s3:::ai-co-learner-frontend-*/\*"
      }
    ]
  }
  ```

### ✅ React 앱 빌드 및 배포
- [ ] 프로덕션 빌드
  ```bash
  npm run build
  ```

- [ ] S3에 업로드
  ```bash
  aws s3 sync dist/ s3://ai-co-learner-frontend-[버킷명]/ --delete
  ```

- [ ] 배포 자동화 스크립트 작성
  ```bash
  # package.json에 추가
  "deploy": "npm run build && aws s3 sync dist/ s3://[버킷명]/ --delete"
  ```

### ✅ CloudFront 배포 설정
- [ ] CloudFront 배포 생성
  - Origin Domain: S3 버킷 선택
  - Viewer Protocol Policy: Redirect HTTP to HTTPS
  - Allowed HTTP Methods: GET, HEAD, OPTIONS
  - Cache Policy: CachingOptimized
  - 가격 클래스: Use All Edge Locations (또는 비용 절감시 North America and Europe)

- [ ] SSL/TLS 인증서 설정
  - AWS Certificate Manager에서 무료 인증서 발급 (선택사항)
  - 도메인 연결 (선택사항)

- [ ] 오류 페이지 설정 (SPA 라우팅)
  - Error Code: 403, 404
  - Response Page Path: `/index.html`
  - Response Code: 200

- [ ] CloudFront URL 테스트
  - 예: `https://d1234abcd.cloudfront.net`

---

## 🎯 Phase 3: 사용자 인증 (3일차)

### ✅ AWS Cognito User Pool 생성
- [ ] User Pool 생성
  - Pool 이름: `ai-co-learner-users`
  - 로그인 옵션: Email
  - 비밀번호 정책: 기본값 또는 커스터마이징
  - MFA: 선택사항 (권장: Optional)

- [ ] User Pool 속성 설정
  ```
  필수 속성:
  - email (필수)
  - name (필수)

  선택 속성:
  - custom:level (숫자 - 사용자 레벨)
  - custom:title (문자열 - 사용자 칭호)
  ```

- [ ] App Client 생성
  - App client 이름: `ai-co-learner-web-client`
  - Authentication flows: ALLOW_USER_PASSWORD_AUTH, ALLOW_REFRESH_TOKEN_AUTH
  - Token 유효기간: Access Token 1시간, Refresh Token 30일

- [ ] Hosted UI 설정 (선택사항)
  - Callback URLs 설정
  - OAuth 2.0 흐름 설정

### ✅ Cognito 정보 기록
- [ ] User Pool ID 저장: `us-east-1_XXXXXXXXX`
- [ ] App Client ID 저장: `xxxxxxxxxxxxxxxxxxxx`
- [ ] 환경 변수 파일에 추가
  ```env
  VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
  VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
  VITE_COGNITO_REGION=us-east-1
  ```

---

## 🎯 Phase 4: 데이터베이스 설계 (4일차)

### ✅ DynamoDB 테이블 설계

#### 테이블 1: Users
- [ ] 테이블 생성
  - 테이블 이름: `ai-co-learner-users`
  - Partition Key: `userId` (String)
  - Billing Mode: On-Demand
  - Encryption: AWS owned key

- [ ] 속성 구조 정의
  ```json
  {
    "userId": "cognito-user-id",
    "username": "john_doe",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "USER",
    "level": 1,
    "title": "호기심 많은 탐험가",
    "competencyData": {
      "사고력": 75,
      "창의력": 60,
      "문제해결": 80
    },
    "badges": ["first_chat", "week_streak_7"],
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-10T00:00:00Z"
  }
  ```

#### 테이블 2: UserBots
- [ ] 테이블 생성
  - 테이블 이름: `ai-co-learner-user-bots`
  - Partition Key: `userId` (String)
  - Sort Key: `botId` (String)
  - Billing Mode: On-Demand

- [ ] GSI (Global Secondary Index) 생성 (선택사항)
  - Index 이름: `botId-index`
  - Partition Key: `botId`

#### 테이블 3: ChatSessions
- [ ] 테이블 생성
  - 테이블 이름: `ai-co-learner-chat-sessions`
  - Partition Key: `sessionId` (String)
  - Sort Key: `timestamp` (Number)
  - Billing Mode: On-Demand

- [ ] TTL 설정 (선택사항 - 오래된 메시지 자동 삭제)
  - TTL 속성: `expirationTime`
  - 90일 후 자동 삭제 설정

- [ ] GSI 생성
  - Index 이름: `userId-timestamp-index`
  - Partition Key: `userId`
  - Sort Key: `timestamp`

#### 테이블 4: BotTemplates
- [ ] 테이블 생성
  - 테이블 이름: `ai-co-learner-bot-templates`
  - Partition Key: `templateId` (String)
  - Billing Mode: On-Demand

- [ ] 초기 템플릿 데이터 입력
  ```json
  [
    {
      "templateId": "questioning-bot",
      "name": "질문하는 AI",
      "description": "호기심을 자극하는 질문으로 학습을 돕습니다",
      "systemPrompt": "당신은 학습자의 호기심을 자극하는 질문 전문가입니다...",
      "baseType": "questioning",
      "themeColor": "blue"
    }
  ]
  ```

### ✅ DynamoDB IAM 정책 준비
- [ ] Lambda 실행 역할용 정책 문서 작성
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ],
        "Resource": [
          "arn:aws:dynamodb:us-east-1:*:table/ai-co-learner-*"
        ]
      }
    ]
  }
  ```

---

## 🎯 Phase 5: AWS Bedrock 설정 (5일차)

### ✅ Bedrock 활성화
- [ ] AWS Console에서 Bedrock 서비스 접속
- [ ] 리전 선택: `us-east-1` (가장 많은 모델 지원)
- [ ] Model access 페이지 이동

### ✅ 모델 액세스 요청
- [ ] Meta Llama 3.2 3B Instruct 액세스 요청
  - 모델 ID: `meta.llama3-2-3b-instruct-v1:0`
  - 승인 시간: 즉시 (보통 1분 이내)

- [ ] 백업 모델 액세스 요청 (선택사항)
  - Mistral 7B: `mistral.mistral-7b-instruct-v0:2`
  - Claude 3 Haiku: `anthropic.claude-3-haiku-20240307-v1:0`

### ✅ Bedrock 테스트
- [ ] Bedrock Playground에서 테스트
  - 프롬프트 입력: "자기주도학습이란 무엇인가요?"
  - 응답 확인
  - 토큰 사용량 확인

### ✅ Bedrock IAM 정책 작성
- [ ] Lambda 실행 역할용 정책
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ],
        "Resource": [
          "arn:aws:bedrock:us-east-1::foundation-model/meta.llama3-2-3b-instruct-v1:0"
        ]
      }
    ]
  }
  ```

---

## 🎯 Phase 6: Lambda 함수 개발 (6-8일차)

### ✅ Lambda 실행 역할 생성
- [ ] IAM Role 생성
  - 역할 이름: `ai-co-learner-lambda-role`
  - 신뢰 관계: Lambda 서비스

- [ ] 정책 연결
  - [x] AWSLambdaBasicExecutionRole (CloudWatch Logs)
  - [x] DynamoDB 정책 (Phase 4에서 작성)
  - [x] Bedrock 정책 (Phase 5에서 작성)

### ✅ Lambda 함수 1: Chat API
- [ ] Lambda 함수 생성
  - 함수 이름: `ai-co-learner-chat`
  - 런타임: Node.js 18.x
  - 아키텍처: arm64 (비용 절감)
  - 메모리: 512 MB
  - 타임아웃: 30초
  - 실행 역할: `ai-co-learner-lambda-role`

- [ ] 코드 작성
  ```javascript
  // index.mjs
  import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
  import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
  import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

  const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });
  const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }));

  export const handler = async (event) => {
    try {
      const body = JSON.parse(event.body);
      const { userId, sessionId, message } = body;

      // 1. 대화 히스토리 조회
      const historyResponse = await dynamoClient.send(new QueryCommand({
        TableName: "ai-co-learner-chat-sessions",
        KeyConditionExpression: "sessionId = :sessionId",
        ExpressionAttributeValues: { ":sessionId": sessionId },
        Limit: 10,
        ScanIndexForward: false
      }));

      // 2. Bedrock 호출
      const prompt = buildPrompt(message, historyResponse.Items || []);

      const bedrockResponse = await bedrockClient.send(new InvokeModelCommand({
        modelId: "meta.llama3-2-3b-instruct-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          prompt: prompt,
          max_gen_len: 500,
          temperature: 0.7,
          top_p: 0.9
        })
      }));

      const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
      const aiMessage = responseBody.generation;

      // 3. DynamoDB에 메시지 저장
      const timestamp = Date.now();

      await dynamoClient.send(new PutCommand({
        TableName: "ai-co-learner-chat-sessions",
        Item: {
          sessionId,
          timestamp,
          userId,
          userMessage: message,
          aiMessage: aiMessage,
          messageId: `${sessionId}-${timestamp}`
        }
      }));

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          message: aiMessage,
          timestamp
        })
      };

    } catch (error) {
      console.error("Error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message })
      };
    }
  };

  function buildPrompt(userMessage, history) {
    let conversation = "";

    history.reverse().forEach(item => {
      conversation += `User: ${item.userMessage}\nAssistant: ${item.aiMessage}\n\n`;
    });

    return `[INST] You are an AI learning assistant. Help students learn effectively.

  Previous conversation:
  ${conversation}

  Current question:
  User: ${userMessage}

  Please provide a helpful, educational response. [/INST]`;
  }
  ```

- [ ] 의존성 패키지 설치 및 업로드
  ```bash
  mkdir lambda-chat && cd lambda-chat
  npm init -y
  npm install @aws-sdk/client-bedrock-runtime @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
  # index.mjs 파일 복사
  zip -r function.zip .
  # Lambda 콘솔에서 업로드 또는 AWS CLI 사용
  ```

### ✅ Lambda 함수 2: User API
- [ ] 함수 생성: `ai-co-learner-user-api`
- [ ] 기능 구현
  - GET /user/{userId} - 사용자 정보 조회
  - PUT /user/{userId} - 사용자 정보 업데이트
  - POST /user - 새 사용자 생성

### ✅ Lambda 함수 3: Bot API
- [ ] 함수 생성: `ai-co-learner-bot-api`
- [ ] 기능 구현
  - GET /bots - 봇 템플릿 목록
  - GET /user/{userId}/bots - 사용자의 봇 목록
  - POST /user/{userId}/bots - 새 봇 생성

### ✅ Lambda 환경 변수 설정
- [ ] 모든 Lambda 함수에 환경 변수 추가
  ```
  BEDROCK_MODEL_ID=meta.llama3-2-3b-instruct-v1:0
  DYNAMODB_USERS_TABLE=ai-co-learner-users
  DYNAMODB_SESSIONS_TABLE=ai-co-learner-chat-sessions
  DYNAMODB_BOTS_TABLE=ai-co-learner-user-bots
  DYNAMODB_TEMPLATES_TABLE=ai-co-learner-bot-templates
  ```

---

## 🎯 Phase 7: API Gateway 설정 (9일차)

### ✅ REST API 생성
- [ ] API Gateway 콘솔에서 REST API 생성
  - API 이름: `ai-co-learner-api`
  - 엔드포인트 타입: Regional

### ✅ 리소스 및 메서드 생성

#### /chat 리소스
- [ ] 리소스 생성: `/chat`
- [ ] POST 메서드 추가
  - 통합 유형: Lambda Function
  - Lambda 함수: `ai-co-learner-chat`
  - Lambda 프록시 통합 활성화

#### /user 리소스
- [ ] 리소스 생성: `/user`
- [ ] POST 메서드 (사용자 생성)

- [ ] 리소스 생성: `/user/{userId}`
- [ ] GET 메서드 (사용자 조회)
- [ ] PUT 메서드 (사용자 업데이트)

#### /bots 리소스
- [ ] 리소스 생성: `/bots`
- [ ] GET 메서드 (템플릿 목록)

- [ ] 리소스 생성: `/user/{userId}/bots`
- [ ] GET 메서드 (사용자 봇 목록)
- [ ] POST 메서드 (봇 생성)

### ✅ CORS 설정
- [ ] 모든 메서드에 CORS 활성화
  - Access-Control-Allow-Origin: `*` (또는 CloudFront 도메인)
  - Access-Control-Allow-Headers: `Content-Type,Authorization`
  - Access-Control-Allow-Methods: `GET,POST,PUT,DELETE,OPTIONS`

### ✅ Cognito Authorizer 설정
- [ ] Authorizer 생성
  - 이름: `cognito-authorizer`
  - 유형: Cognito
  - Cognito User Pool: Phase 3에서 생성한 User Pool
  - Token Source: `Authorization`

- [ ] 보호가 필요한 메서드에 Authorizer 연결
  - POST /chat
  - GET /user/{userId}
  - PUT /user/{userId}
  - 등...

### ✅ API 배포
- [ ] 스테이지 생성 및 배포
  - 스테이지 이름: `prod`
  - 배포 설명: "Initial production deployment"

- [ ] API URL 기록
  - 예: `https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod`

### ✅ API 테스트
- [ ] Postman 또는 curl로 테스트
  ```bash
  # 챗봇 API 테스트
  curl -X POST https://[API-ID].execute-api.us-east-1.amazonaws.com/prod/chat \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer [COGNITO-TOKEN]" \
    -d '{"userId":"test-user","sessionId":"session-1","message":"안녕하세요"}'
  ```

---

## 🎯 Phase 8: AppSync (실시간 채팅) 설정 (10일차)

### ✅ AppSync API 생성
- [ ] AppSync 콘솔에서 API 생성
  - API 이름: `ai-co-learner-realtime`
  - 인증 모드: Amazon Cognito User Pool
  - User Pool: Phase 3에서 생성한 User Pool

### ✅ GraphQL 스키마 정의
- [ ] 스키마 작성
  ```graphql
  type Message {
    id: ID!
    sessionId: String!
    sender: String!
    text: String!
    timestamp: AWSTimestamp!
  }

  type Query {
    getMessages(sessionId: String!): [Message]
  }

  type Mutation {
    sendMessage(
      sessionId: String!
      sender: String!
      text: String!
    ): Message
  }

  type Subscription {
    onMessageReceived(sessionId: String!): Message
      @aws_subscribe(mutations: ["sendMessage"])
  }

  schema {
    query: Query
    mutation: Mutation
    subscription: Subscription
  }
  ```

### ✅ 데이터 소스 연결
- [ ] DynamoDB 데이터 소스 추가
  - 이름: `ChatSessionsTable`
  - 테이블: `ai-co-learner-chat-sessions`
  - 서비스 역할: 자동 생성 또는 기존 역할 사용

### ✅ 리졸버 작성

#### Query.getMessages
- [ ] 리졸버 연결
  ```vtl
  ## Request Mapping Template
  {
    "version": "2017-02-28",
    "operation": "Query",
    "query": {
      "expression": "sessionId = :sessionId",
      "expressionValues": {
        ":sessionId": $util.dynamodb.toDynamoDBJson($ctx.args.sessionId)
      }
    },
    "limit": 50,
    "scanIndexForward": false
  }
  ```

#### Mutation.sendMessage
- [ ] 리졸버 연결
  ```vtl
  ## Request Mapping Template
  {
    "version": "2017-02-28",
    "operation": "PutItem",
    "key": {
      "sessionId": $util.dynamodb.toDynamoDBJson($ctx.args.sessionId),
      "timestamp": $util.dynamodb.toDynamoDBJson($util.time.nowEpochMilliSeconds())
    },
    "attributeValues": {
      "id": $util.dynamodb.toDynamoDBJson($util.autoId()),
      "sender": $util.dynamodb.toDynamoDBJson($ctx.args.sender),
      "text": $util.dynamodb.toDynamoDBJson($ctx.args.text)
    }
  }
  ```

### ✅ AppSync 엔드포인트 기록
- [ ] GraphQL 엔드포인트 URL 저장
- [ ] API 키 생성 (개발용, 선택사항)

---

## 🎯 Phase 9: 프론트엔드 통합 (11-12일차)

### ✅ 환경 변수 설정
- [ ] `.env.local` 파일 업데이트
  ```env
  # Cognito
  VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
  VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
  VITE_COGNITO_REGION=us-east-1

  # API Gateway
  VITE_API_GATEWAY_URL=https://[API-ID].execute-api.us-east-1.amazonaws.com/prod

  # AppSync
  VITE_APPSYNC_URL=https://[APPSYNC-ID].appsync-api.us-east-1.amazonaws.com/graphql
  VITE_APPSYNC_REGION=us-east-1

  # CloudFront (배포 후)
  VITE_CLOUDFRONT_URL=https://[DISTRIBUTION-ID].cloudfront.net
  ```

### ✅ Cognito 인증 통합
- [ ] AWS Amplify 라이브러리 설치
  ```bash
  npm install aws-amplify @aws-amplify/ui-react
  ```

- [ ] Amplify 설정 파일 생성 (`src/aws-config.ts`)
  ```typescript
  import { Amplify } from 'aws-amplify';

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
        userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
        region: import.meta.env.VITE_COGNITO_REGION
      }
    }
  });
  ```

- [ ] App.tsx에서 설정 임포트
  ```typescript
  import './aws-config';
  ```

### ✅ 로그인/회원가입 페이지 구현
- [ ] Amplify UI 컴포넌트 사용
  ```typescript
  import { Authenticator } from '@aws-amplify/ui-react';
  import '@aws-amplify/ui-react/styles.css';

  function App() {
    return (
      <Authenticator>
        {({ signOut, user }) => (
          <div>
            <h1>Welcome {user.username}</h1>
            <button onClick={signOut}>Sign out</button>
            {/* 앱 내용 */}
          </div>
        )}
      </Authenticator>
    );
  }
  ```

### ✅ API Gateway 연동
- [ ] API 호출 유틸리티 작성 (`src/services/api.ts`)
  ```typescript
  import { fetchAuthSession } from 'aws-amplify/auth';

  const API_BASE_URL = import.meta.env.VITE_API_GATEWAY_URL;

  export async function callAPI(endpoint: string, options: RequestInit = {}) {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  export async function sendChatMessage(userId: string, sessionId: string, message: string) {
    return callAPI('/chat', {
      method: 'POST',
      body: JSON.stringify({ userId, sessionId, message })
    });
  }
  ```

### ✅ AppSync 실시간 채팅 통합
- [ ] AppSync 클라이언트 설정 (`src/services/appsync.ts`)
  ```typescript
  import { Amplify } from 'aws-amplify';

  Amplify.configure({
    API: {
      GraphQL: {
        endpoint: import.meta.env.VITE_APPSYNC_URL,
        region: import.meta.env.VITE_APPSYNC_REGION,
        defaultAuthMode: 'userPool'
      }
    }
  });
  ```

- [ ] GraphQL 쿼리/뮤테이션 작성
  ```typescript
  import { generateClient } from 'aws-amplify/api';

  const client = generateClient();

  export const sendMessage = async (sessionId: string, sender: string, text: string) => {
    const mutation = `
      mutation SendMessage($sessionId: String!, $sender: String!, $text: String!) {
        sendMessage(sessionId: $sessionId, sender: $sender, text: $text) {
          id
          text
          timestamp
        }
      }
    `;

    return client.graphql({
      query: mutation,
      variables: { sessionId, sender, text }
    });
  };

  export const subscribeToMessages = (sessionId: string, callback: (message: any) => void) => {
    const subscription = `
      subscription OnMessageReceived($sessionId: String!) {
        onMessageReceived(sessionId: $sessionId) {
          id
          sender
          text
          timestamp
        }
      }
    `;

    return client.graphql({
      query: subscription,
      variables: { sessionId }
    }).subscribe({
      next: ({ data }) => callback(data.onMessageReceived),
      error: (error) => console.error('Subscription error:', error)
    });
  };
  ```

### ✅ 기존 Gemini 코드 제거
- [ ] Gemini API 호출 코드 삭제
- [ ] AWS API로 대체
- [ ] 에러 처리 추가

---

## 🎯 Phase 10: 모니터링 및 로깅 (13일차)

### ✅ CloudWatch 설정
- [ ] Lambda 함수 로그 그룹 확인
  - `/aws/lambda/ai-co-learner-chat`
  - `/aws/lambda/ai-co-learner-user-api`
  - 등...

- [ ] 로그 보존 기간 설정
  - 권장: 7일 (비용 절감)
  - 필요시: 30일

### ✅ CloudWatch 대시보드 생성
- [ ] 대시보드 이름: `ai-co-learner-dashboard`
- [ ] 위젯 추가
  - Lambda 호출 횟수
  - Lambda 오류율
  - Lambda 실행 시간
  - API Gateway 요청 수
  - DynamoDB 읽기/쓰기 용량
  - Bedrock API 호출 수

### ✅ CloudWatch 알람 설정
- [ ] Lambda 오류율 알람
  - 임계값: 오류율 > 5%
  - 알림: 이메일 또는 SNS

- [ ] API Gateway 5xx 오류 알람
  - 임계값: 5xx 응답 > 10개/5분

- [ ] 비용 알람 (Budget에서 설정)
  - 임계값: $10 초과 시 알림

### ✅ X-Ray 추적 설정 (선택사항)
- [ ] Lambda 함수에서 X-Ray 활성화
- [ ] API Gateway에서 X-Ray 활성화
- [ ] 서비스 맵 확인

---

## 🎯 Phase 11: 보안 강화 (14일차)

### ✅ IAM 권한 최소화
- [ ] Lambda 실행 역할 권한 검토
- [ ] 불필요한 권한 제거
- [ ] 리소스별 세밀한 권한 설정

### ✅ API 보안 설정
- [ ] API Gateway Rate Limiting 설정
  - 사용자당: 100 요청/분
  - 버스트: 200

- [ ] API Key 또는 Usage Plan 설정 (선택사항)

### ✅ DynamoDB 보안
- [ ] 암호화 활성화 (기본 AWS owned key 사용)
- [ ] Point-in-time Recovery (PITR) 활성화 (선택사항)
- [ ] 백업 계획 수립 (선택사항)

### ✅ Secrets Manager (선택사항)
- [ ] API 키나 민감한 설정을 Secrets Manager에 저장
- [ ] Lambda에서 런타임에 시크릿 로드

### ✅ CloudFront 보안
- [ ] WAF (Web Application Firewall) 설정 (선택사항)
  - SQL Injection 방지
  - XSS 방지
  - Rate limiting

---

## 🎯 Phase 12: 성능 최적화 (15일차)

### ✅ Lambda 최적화
- [ ] 메모리 크기 조정
  - 테스트를 통해 최적 메모리 찾기 (512MB ~ 1024MB)
  - 비용 vs 성능 균형

- [ ] Cold Start 최소화
  - 프로비저닝된 동시성 설정 (선택사항, 비용 증가)
  - 번들 크기 최소화

### ✅ DynamoDB 최적화
- [ ] 인덱스 사용 최적화
- [ ] 배치 작업 사용 (여러 항목 한 번에 읽기/쓰기)
- [ ] DAX (DynamoDB Accelerator) 고려 (대규모시)

### ✅ CloudFront 캐싱 최적화
- [ ] 캐시 정책 조정
  - TTL 설정: 정적 파일 1일, 동적 콘텐츠 0
  - Query string 캐싱 설정

- [ ] Gzip/Brotli 압축 활성화

### ✅ API 응답 최적화
- [ ] 페이지네이션 구현
- [ ] 필요한 필드만 반환
- [ ] 응답 압축 활성화

---

## 🎯 Phase 13: CI/CD 파이프라인 (16일차)

### ✅ GitHub Actions 설정 (선택사항)
- [ ] `.github/workflows/deploy.yml` 생성
  ```yaml
  name: Deploy to AWS

  on:
    push:
      branches: [main]

  jobs:
    deploy-frontend:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3

        - name: Setup Node.js
          uses: actions/setup-node@v3
          with:
            node-version: 18

        - name: Install dependencies
          run: npm install

        - name: Build
          run: npm run build

        - name: Deploy to S3
          env:
            AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
            AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          run: |
            aws s3 sync dist/ s3://ai-co-learner-frontend-[버킷명]/ --delete

        - name: Invalidate CloudFront
          run: |
            aws cloudfront create-invalidation --distribution-id [DIST-ID] --paths "/*"

    deploy-lambda:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3

        - name: Deploy Lambda functions
          run: |
            cd lambda-chat
            npm install
            zip -r function.zip .
            aws lambda update-function-code --function-name ai-co-learner-chat --zip-file fileb://function.zip
  ```

### ✅ AWS CodePipeline 설정 (대체 옵션)
- [ ] CodePipeline 생성
- [ ] Source: GitHub 연결
- [ ] Build: CodeBuild 설정
- [ ] Deploy: S3 + Lambda 배포

---

## 🎯 Phase 14: 테스트 및 QA (17일차)

### ✅ 단위 테스트
- [ ] Lambda 함수 테스트 작성
  ```bash
  npm install --save-dev jest @types/jest
  ```

- [ ] API 엔드포인트 테스트

### ✅ 통합 테스트
- [ ] 전체 플로우 테스트
  1. 회원가입
  2. 로그인
  3. 챗봇 대화
  4. 실시간 메시지 수신

### ✅ 부하 테스트 (선택사항)
- [ ] Artillery 또는 Locust 사용
  ```bash
  npm install -g artillery
  artillery quick --count 10 --num 100 https://[API-URL]/chat
  ```

### ✅ 보안 테스트
- [ ] OWASP ZAP 스캔
- [ ] 인증/인가 테스트
- [ ] SQL Injection, XSS 테스트

---

## 🎯 Phase 15: 프로덕션 배포 (18일차)

### ✅ 최종 체크리스트
- [ ] 모든 환경 변수 검증
- [ ] API 엔드포인트 테스트
- [ ] HTTPS 작동 확인
- [ ] CORS 설정 확인
- [ ] 인증 플로우 테스트

### ✅ 프론트엔드 최종 배포
- [ ] 프로덕션 빌드
  ```bash
  npm run build
  ```

- [ ] S3 업로드
  ```bash
  aws s3 sync dist/ s3://[버킷명]/ --delete
  ```

- [ ] CloudFront 캐시 무효화
  ```bash
  aws cloudfront create-invalidation --distribution-id [ID] --paths "/*"
  ```

### ✅ DNS 설정 (커스텀 도메인 사용 시)
- [ ] Route 53에서 도메인 설정
- [ ] CloudFront에 CNAME 추가
- [ ] SSL 인증서 연결

### ✅ 프로덕션 환경 검증
- [ ] CloudFront URL 접속 테스트
- [ ] 회원가입/로그인 테스트
- [ ] 챗봇 대화 테스트
- [ ] 실시간 메시지 테스트
- [ ] 모바일 브라우저 테스트

---

## 🎯 Phase 16: 문서화 및 인수인계 (19일차)

### ✅ 기술 문서 작성
- [ ] 아키텍처 다이어그램 업데이트
- [ ] API 문서 작성 (Swagger/OpenAPI)
- [ ] 배포 가이드 작성
- [ ] 트러블슈팅 가이드 작성

### ✅ 운영 문서 작성
- [ ] 모니터링 대시보드 사용법
- [ ] 알람 대응 절차
- [ ] 백업 및 복구 절차
- [ ] 비용 최적화 가이드

### ✅ README 업데이트
- [ ] 프로젝트 개요
- [ ] 로컬 개발 환경 설정
- [ ] AWS 배포 가이드
- [ ] 환경 변수 설명

---

## 🎯 Phase 17: 사용자 피드백 및 개선 (20일차 이후)

### ✅ 초기 사용자 모니터링
- [ ] 첫 주 동안 매일 CloudWatch 로그 확인
- [ ] 오류 발생 패턴 분석
- [ ] 성능 병목 지점 파악

### ✅ 사용자 피드백 수집
- [ ] 피드백 양식 추가
- [ ] 사용성 테스트 진행
- [ ] 개선 우선순위 결정

### ✅ 반복적 개선
- [ ] 주간 성능 리뷰
- [ ] 비용 최적화 검토
- [ ] 신기능 개발 계획

---

## 💰 예상 비용 요약 (50명 기준)

| 서비스 | 월 비용 |
|--------|---------|
| S3 + CloudFront | $0.97 |
| Cognito | $0 (무료 티어) |
| Lambda + API Gateway | $0.45 |
| DynamoDB | $0.43 |
| AppSync | $2.24 |
| Bedrock (Llama 3.2 3B) | $3.00 |
| **월 총계** | **$7.09** |
| **연 총계** | **$85.08** |

---

## 🎓 학습 리소스

### AWS 공식 문서
- [ ] [AWS Lambda 개발자 가이드](https://docs.aws.amazon.com/lambda/)
- [ ] [Amazon DynamoDB 개발자 가이드](https://docs.aws.amazon.com/dynamodb/)
- [ ] [AWS Bedrock 사용 설명서](https://docs.aws.amazon.com/bedrock/)
- [ ] [AWS Amplify 문서](https://docs.amplify.aws/)

### 튜토리얼
- [ ] AWS Serverless 워크샵
- [ ] AWS Well-Architected Labs
- [ ] Bedrock 샘플 애플리케이션

---

## 🆘 트러블슈팅

### 자주 발생하는 문제

#### 1. Lambda 타임아웃
- **원인**: Bedrock 응답 지연
- **해결**: 타임아웃 30초 → 60초 증가

#### 2. CORS 오류
- **원인**: API Gateway CORS 미설정
- **해결**: OPTIONS 메서드 추가, 헤더 확인

#### 3. Cognito 인증 실패
- **원인**: Token 만료 또는 잘못된 설정
- **해결**: Token refresh 로직 추가

#### 4. DynamoDB 요금 급증
- **원인**: 비효율적인 Scan 작업
- **해결**: Query + 인덱스 사용으로 변경

#### 5. Bedrock 모델 액세스 거부
- **원인**: 모델 액세스 미승인
- **해결**: Bedrock 콘솔에서 모델 액세스 재요청

---

## ✅ 완료 체크

프로젝트 완료 시 아래 항목 모두 확인:

- [ ] CloudFront URL로 앱 접속 가능
- [ ] 회원가입/로그인 정상 작동
- [ ] 챗봇 대화 정상 작동
- [ ] 실시간 메시지 수신 작동
- [ ] CloudWatch 모니터링 설정 완료
- [ ] 비용 알람 설정 완료
- [ ] 문서화 완료
- [ ] CI/CD 파이프라인 작동 (선택사항)
- [ ] 보안 검토 완료
- [ ] 성능 테스트 완료

---

## 🎉 축하합니다!

이제 완전한 AWS 서버리스 AI Co-Learner 애플리케이션이 구축되었습니다!

**다음 단계:**
1. 실제 사용자 초대 및 피드백 수집
2. 지속적인 모니터링 및 최적화
3. 신규 기능 추가 개발
4. 사용자 증가에 따른 스케일링

**문의 및 지원:**
- AWS Support (문제 발생 시)
- AWS Forums
- Stack Overflow

---

**문서 버전:** 1.0
**최종 업데이트:** 2025-01-25
**작성자:** AI Co-Learner Team
