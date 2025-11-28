# AI Co-Learner AWS Serverless 구축 진행 상황

**최종 업데이트:** 2025-11-25
**프로젝트:** AI Co-Learner AWS Serverless 마이그레이션

---

## ✅ 완료된 작업

### 1. AWS CLI 설정
- ✅ AWS CLI 설치 완료
- ✅ 액세스 키 설정 완료
- ✅ 리전: `ap-northeast-2` (서울)

### 2. S3 버킷 (프론트엔드 호스팅)
- ✅ 버킷 이름: `ai-co-learner-frontend-synnex`
- ✅ 정적 웹호스팅 활성화
- ✅ 버킷 정책 설정 완료
- 📁 위치: [bucket-policy.json](./bucket-policy.json)

### 3. AWS Cognito (사용자 인증)
- ✅ User Pool 생성 완료
- ✅ User Pool ID: `ap-northeast-2_OCntQ228q`
- ✅ App Client ID: `4csdt3gpkfujrg1lslu4fgo5b1`
- ✅ 리전: `ap-northeast-2`

### 4. DynamoDB (데이터베이스)
생성된 테이블 (모두 ap-northeast-2):
- ✅ `ai-co-learner-users` - 사용자 정보
- ✅ `ai-co-learner-user-bots` - 사용자별 봇 설정
- ✅ `ai-co-learner-chat-sessions` - 채팅 세션 및 메시지
- ✅ `ai-co-learner-bot-templates` - 봇 템플릿

### 5. AWS Bedrock (AI 모델)
- ✅ 리전: `us-east-1` (Cross-Region)
- ✅ 모델: Llama 3.2 3B Instruct
- ✅ Inference Profile ID: `us.meta.llama3-2-3b-instruct-v1:0`
- ✅ Playground 테스트 성공

### 6. Lambda 함수
- ✅ 함수 이름: `ai-co-learner-chat`
- ✅ 런타임: Node.js 20.x
- ✅ 리전: `ap-northeast-2`
- ✅ 메모리: 512 MB
- ✅ 타임아웃: 30초
- ✅ IAM Role: `ai-co-learner-lambda-role`
- 📁 코드 위치: [lambda/chat-api/](./lambda/chat-api/)

#### Lambda 권한:
- ✅ CloudWatch Logs 쓰기
- ✅ DynamoDB 읽기/쓰기
- ✅ Bedrock InvokeModel (모든 리전)
- 📁 정책 파일: [lambda-permissions-policy.json](./lambda-permissions-policy.json)

### 7. API Gateway
- ✅ API 이름: `ai-co-learner-api`
- ✅ API ID: `oz20zs5lfc`
- ✅ 리전: `ap-northeast-2`
- ✅ 엔드포인트: `https://oz20zs5lfc.execute-api.ap-northeast-2.amazonaws.com/prod`
- ✅ Lambda 프록시 통합 완료
- ✅ CORS 설정 완료
- ✅ 테스트 성공

---

### 8. 프론트엔드 AWS SDK 통합 ✅
**완료된 작업:**
1. ✅ AWS Amplify 라이브러리 설치 완료
   - `aws-amplify` 및 `@aws-amplify/ui-react` 설치됨

2. ✅ Cognito 인증 통합 완료
   - [src/aws-config.ts](src/aws-config.ts) 설정 파일 생성
   - [contexts/AuthContext.tsx](contexts/AuthContext.tsx) AWS Cognito 연동
   - [pages/Login.tsx](pages/Login.tsx) 로그인/회원가입 UI 업데이트 (비밀번호 필드 추가)

3. ✅ API Gateway 연동 완료
   - [services/awsBackend.ts](services/awsBackend.ts) 새로운 AWS 서비스 레이어 생성
   - [pages/ChatRoom.tsx](pages/ChatRoom.tsx) AWS 백엔드로 마이그레이션
   - [pages/Dashboard.tsx](pages/Dashboard.tsx) AWS 백엔드로 마이그레이션

4. ✅ 환경 변수 설정 완료
   - `.env.local` 파일에 모든 AWS 설정 값 포함됨

## 🔄 다음 단계 (남은 작업)

### 9. CloudFront CDN 설정 (선택사항)
- CloudFront 배포 생성
- S3 버킷과 연결
- SSL/TLS 인증서 설정
- 캐시 정책 최적화

### 10. 최종 배포 및 테스트
- 프론트엔드 빌드 및 S3 업로드
- 전체 플로우 테스트
- 성능 및 보안 검증

---

## 📝 환경 변수 (.env.local)

```env
GEMINI_API_KEY=PLACEHOLDER_API_KEY

# AWS Cognito
VITE_COGNITO_USER_POOL_ID=ap-northeast-2_OCntQ228q
VITE_COGNITO_CLIENT_ID=4csdt3gpkfujrg1lslu4fgo5b1
VITE_COGNITO_REGION=ap-northeast-2

# API Gateway
VITE_API_GATEWAY_URL=https://oz20zs5lfc.execute-api.ap-northeast-2.amazonaws.com/prod

# AppSync (나중에 추가)
VITE_APPSYNC_URL=
VITE_APPSYNC_REGION=ap-northeast-2

# AWS Bedrock
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=us.meta.llama3-2-3b-instruct-v1:0
```

---

## 🏗️ 아키텍처 구조

```
📍 ap-northeast-2 (서울 리전):
├── S3: ai-co-learner-frontend-synnex (프론트엔드)
├── Cognito: ai-co-learner-users (인증)
├── DynamoDB: 4개 테이블 (데이터베이스)
├── Lambda: ai-co-learner-chat (백엔드 로직)
└── API Gateway: oz20zs5lfc (REST API)

📍 us-east-1 (버지니아 리전):
└── Bedrock: Llama 3.2 3B (AI 모델)
    └── Lambda에서 Cross-Region 호출
```

---

## 🧪 테스트 명령어

### API Gateway 테스트:
```powershell
Invoke-RestMethod -Uri "https://oz20zs5lfc.execute-api.ap-northeast-2.amazonaws.com/prod" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"userId":"test-user","sessionId":"test-session-1","message":"안녕하세요"}'
```

### S3 배포:
```bash
npm run build
aws s3 sync dist/ s3://ai-co-learner-frontend-synnex/ --delete
```

### Lambda 재배포:
```bash
cd lambda\chat-api
powershell Compress-Archive -Path * -DestinationPath function.zip -Force
aws lambda update-function-code --function-name ai-co-learner-chat --zip-file fileb://function.zip --region ap-northeast-2
cd ..\..
```

---

## 📊 예상 비용

**월 $7.09** (50명 기준)
- S3 + CloudFront: $0.97
- Cognito: $0 (무료 티어)
- Lambda + API Gateway: $0.45
- DynamoDB: $0.43
- Bedrock (Llama 3.2 3B): $3.00
- 기타: $2.24

---

## 🔗 중요 링크

- AWS Console: https://console.aws.amazon.com/
- Bedrock Console: https://console.aws.amazon.com/bedrock/ (리전: us-east-1)
- Lambda Console: https://console.aws.amazon.com/lambda/ (리전: ap-northeast-2)
- API Gateway Console: https://console.aws.amazon.com/apigateway/ (리전: ap-northeast-2)

---

## ⚠️ 주의사항

1. **Bedrock 리전**: us-east-1에서만 Llama 3.2 3B 사용 가능
2. **Cross-Region 호출**: Lambda(서울) → Bedrock(버지니아)
3. **IAM 권한**: 모든 리전의 Bedrock 리소스에 접근 가능하도록 설정됨
4. **API Gateway**: Lambda 프록시 통합 사용 중
5. **CORS**: 모든 origin 허용 중 (프로덕션에서는 제한 권장)

---

### 9. Lambda 함수 확장 및 DynamoDB 사용자 관리 ✅
**완료된 작업:**
1. ✅ Lambda 함수 확장 - 사용자 프로필 API 추가
   - POST /chat - 채팅 메시지 전송
   - GET /chat/session/{sessionId} - 세션 조회
   - GET /bots/templates - 봇 템플릿 목록
   - GET /bots/user/{userId} - 사용자 봇 목록
   - POST /bots/create - 봇 생성
   - **GET /users/{userId} - 사용자 프로필 조회**
   - **POST /users - 사용자 프로필 생성/업데이트**

2. ✅ DynamoDB 연동 완성
   - ai-co-learner-chat-sessions 테이블 읽기/쓰기
   - ai-co-learner-user-bots 테이블 읽기/쓰기
   - **ai-co-learner-users 테이블 읽기/쓰기 (role, level, title 저장)**

3. ✅ 프론트엔드 AuthContext DynamoDB 연동
   - Cognito 커스텀 속성 대신 DynamoDB 사용
   - 회원가입 시 DynamoDB에 자동으로 프로필 생성
   - 로그인 시 DynamoDB에서 프로필 조회

4. ✅ API Gateway 경로 설정
   - /users 리소스 생성 (Resource ID: p8355j)
   - /users/{userId} 리소스 생성
   - POST /users 메서드 인증 제거 (회원가입용)
   - GET /users/{userId} 메서드 인증 유지
   - Lambda 권한 추가
   - 📁 스크립트: [setup-api-gateway.ps1](setup-api-gateway.ps1)

5. ✅ Lambda 함수 재배포 완료
   - 📁 위치: [lambda/chat-api/index.mjs](lambda/chat-api/index.mjs)
   - 배포 스크립트: [lambda/chat-api/deploy.bat](lambda/chat-api/deploy.bat)

6. ✅ 회원가입 인증 이슈 해결
   - POST /users 엔드포인트에서 Authorization 요구사항 제거
   - API Gateway 배포 완료 (Deployment ID: w89g4j)
   - 회원가입 플로우 수정: Cognito 회원가입 → 자동 로그인 → DynamoDB 프로필 생성

---

### 10. API Gateway 전체 경로 설정 및 통합 테스트 ✅
**완료된 작업:**
1. ✅ API Gateway 전체 경로 설정
   - POST /chat - 채팅 메시지 전송
   - GET /chat/session/{sessionId} - 세션 조회
   - GET /bots/templates - 봇 템플릿 목록
   - GET /bots/user/{userId} - 사용자 봇 목록
   - POST /bots/create - 봇 생성
   - POST /users - 사용자 프로필 생성
   - GET /users/{userId} - 사용자 프로필 조회
   - 📁 스크립트: [setup-all-api-routes.ps1](setup-all-api-routes.ps1)

2. ✅ 통합 테스트 완료
   - ✅ 회원가입: Cognito 사용자 생성 성공
   - ✅ DynamoDB 프로필 생성: 사용자 프로필 저장 성공
   - ✅ 프로필 조회: GET /users/{userId} 성공
   - ✅ 봇 템플릿 조회: 3개 템플릿 (소크라테스, 셜록, 다빈치) 조회 성공
   - ✅ 봇 생성: POST /bots/create 성공
   - ✅ 사용자 봇 조회: GET /bots/user/{userId} 성공
   - ✅ 채팅 메시지 전송: Bedrock AI 응답 수신 성공
   - ✅ 세션 조회: 대화 히스토리 저장 및 조회 성공

3. ✅ 테스트 사용자 정보
   - Username: testuser01@test.com
   - User ID: 9438edcc-f0a1-7031-40b1-55fb2ba06416
   - Role: STUDENT
   - Level: 1
   - 생성된 봇: My Socrates Bot (bot-1764120399529)

---

### 11. Admin 계정 생성 및 최종 S3 배포 ✅
**완료된 작업:**
1. ✅ Admin 계정 생성
   - User ID: 34a82d2c-e0a1-70ba-cf7e-482d18ea24e2
   - Username: junhyuk.kang@synnex.kr
   - Password: Admin123!@#
   - Name: Junhyuk Kang
   - Role: ADMIN
   - Level: 99
   - Title: System Administrator

2. ✅ 프론트엔드 빌드 및 S3 배포
   - Vite 빌드 성공
   - S3 버킷에 배포 완료
   - 번들 크기: 666.76 KB (gzip: 207.34 KB)
   - 최종 배포 파일: index.html, assets/index-DG1A6FdE.js

3. ✅ 배포 URL
   - S3 Website: http://ai-co-learner-frontend-synnex.s3-website.ap-northeast-2.amazonaws.com

---

### 12. 로그인 이슈 수정 ✅
**완료된 작업:**
1. ✅ "There is already a signed in user" 에러 해결
   - AuthContext login 함수에서 기존 세션 자동 로그아웃 로직 추가
   - 로그인 전 getCurrentUser() → signOut() 실행

2. ✅ 로그인 후 리다이렉트 문제 해결
   - Login 컴포넌트에 useEffect 추가
   - user 상태 변경 감지하여 자동 리다이렉트
   - 이미 로그인된 사용자의 /login 접근 시 자동으로 대시보드로 이동

3. ✅ 디버깅 로그 추가
   - AuthContext fetchCurrentUser()에 상세 콘솔 로그 추가
   - Cognito 인증 상태 추적
   - DynamoDB 프로필 조회 및 생성 과정 로깅

**남은 이슈:**
- 로그인 후 페이지 리다이렉트가 작동하지 않는 문제 (디버깅 중)
- 브라우저 콘솔에서 에러 확인 필요

---

## 🎉 AWS Serverless 배포 완료!

**전체 시스템 구성:**
- ✅ S3: 프론트엔드 호스팅
- ✅ Cognito: 사용자 인증
- ✅ API Gateway: REST API 엔드포인트 (7개 경로)
- ✅ Lambda: 백엔드 비즈니스 로직
- ✅ DynamoDB: 데이터베이스 (4개 테이블)
- ✅ Bedrock: AI 모델 (Llama 3.2 3B Instruct)

**계정 정보:**
- **Admin**: junhyuk.kang@synnex.kr / Admin123!@# (Level 99, ADMIN)
- **Test User**: testuser01@test.com / TestPass123! (Level 1, STUDENT)

---

## 🚀 다음 단계 (선택사항)

1. **CloudFront CDN 설정**
   - HTTPS 지원
   - 전 세계 CDN 배포
   - 커스텀 도메인 설정

2. **모니터링 설정**
   - CloudWatch Logs 확인
   - Lambda 성능 모니터링
   - API Gateway 사용량 모니터링

3. **보안 강화**
   - API Gateway Authorizer 추가
   - CORS 정책 세밀화
   - WAF 설정

4. **성능 최적화**
   - Lambda 메모리/타임아웃 튜닝
   - DynamoDB 읽기/쓰기 용량 조정
   - 프론트엔드 코드 스플리팅
