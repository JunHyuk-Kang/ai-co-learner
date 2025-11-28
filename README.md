# AI Co-Learner

AI 기반 학습 도우미 플랫폼. 사용자는 다양한 AI 코치 봇과 대화하며 학습하고, 역량을 추적할 수 있습니다.

## 주요 기능

- 🤖 **AI 코치 봇**: 질문형, 성찰형, 지원형 등 다양한 학습 스타일의 AI 봇
- 📊 **역량 추적**: 대화 기반 역량 분석 및 시각화
- 👤 **사용자 관리**: AWS Cognito 기반 인증/권한 관리
- 🎯 **레벨 시스템**: 학습 진도에 따른 레벨 업 및 뱃지 획득
- 🔐 **관리자 패널**: 봇 템플릿 관리 및 사용자 관리

## 기술 스택

### Frontend
- **React 19** + **TypeScript**
- **Vite** - 빌드 도구
- **Tailwind CSS** - 스타일링
- **Recharts** - 데이터 시각화
- **Lucide React** - 아이콘

### Backend (AWS Serverless)
- **AWS Cognito** - 사용자 인증
- **AWS Lambda** - 서버리스 함수
- **Amazon DynamoDB** - NoSQL 데이터베이스
- **AWS API Gateway** - REST API
- **AWS Amplify** - AWS 서비스 통합
- **Amazon Bedrock** - AI 모델 (Llama 3.2)

## 프로젝트 구조

```
ai-co-learner/
├── components/          # React 컴포넌트
│   ├── chat/           # 채팅 관련
│   ├── dashboard/      # 대시보드 위젯
│   ├── layout/         # 레이아웃
│   └── ui/             # 재사용 가능한 UI
├── contexts/           # React Context (인증 등)
├── pages/              # 페이지 컴포넌트
├── services/           # API 서비스
│   ├── apiUtils.ts    # API 유틸리티
│   └── awsBackend.ts  # AWS 백엔드 로직
├── lambda/             # Lambda 함수
│   ├── chat-api/
│   ├── message-batch-analyzer/
│   └── competency-aggregator/
├── docs/               # 프로젝트 문서
└── types.ts            # TypeScript 타입 정의
```

## 시작하기

### 필수 요구사항

- **Node.js** (v18 이상)
- **npm** 또는 **yarn**
- **AWS 계정** (백엔드 배포용)

### 1. 저장소 클론

```bash
git clone <repository-url>
cd ai-co-learner
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경 변수 설정

`.env.example`을 복사하여 `.env.local` 파일을 생성하고, 실제 값을 입력하세요:

```bash
cp .env.example .env.local
```

`.env.local` 파일에 다음 값들을 설정:

```env
GEMINI_API_KEY=your_gemini_api_key_here

# AWS Cognito
VITE_COGNITO_USER_POOL_ID=your_user_pool_id
VITE_COGNITO_CLIENT_ID=your_client_id
VITE_COGNITO_REGION=ap-northeast-2

# API Gateway
VITE_API_GATEWAY_URL=your_api_gateway_url

# AWS Bedrock
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=meta.llama3-2-3b-instruct-v1:0
```

### 4. 로컬 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

### 5. 프로덕션 빌드

```bash
npm run build
```

## AWS 배포

### Lambda 함수 배포

각 Lambda 함수 폴더에서:

```bash
cd lambda/chat-api
npm install
.\deploy.bat  # Windows
```

### 프론트엔드 배포 (S3)

```bash
npm run deploy
```

## 개발 환경 간 작업 공유

### 노트북에서 작업 후 푸시

```bash
git add .
git commit -m "작업 내용 설명"
git push origin main
```

### PC에서 가져오기

```bash
git pull origin main
npm install  # 새로운 패키지가 추가된 경우
```

⚠️ **중요**: `.env.local` 파일은 Git에 포함되지 않으므로, 새로운 환경에서는 직접 생성해야 합니다.

## 주요 명령어

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 시작 |
| `npm run build` | 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run deploy` | S3에 배포 |

## API 엔드포인트

### 사용자 관련
- `GET /users/{userId}` - 사용자 프로필 조회
- `POST /users` - 사용자 프로필 생성
- `POST /users/update` - 사용자 프로필 업데이트
- `GET /users/{userId}/competencies` - 역량 데이터 조회

### 봇 관련
- `GET /bots/templates` - 봇 템플릿 목록
- `GET /bots/user/{userId}` - 사용자의 봇 목록
- `POST /bots/create` - 새 봇 생성

### 채팅
- `GET /chat/session/{botId}` - 채팅 세션 조회
- `POST /chat` - 메시지 전송

### 관리자
- `GET /admin/users` - 전체 사용자 목록
- `POST /admin/templates/create` - 템플릿 생성
- `POST /admin/users/update-role` - 사용자 권한 변경

## 트러블슈팅

### CORS 에러
- API Gateway CORS 설정 확인
- `fix-cors-complete.ps1` 스크립트 참고

### 인증 실패
- Cognito User Pool 및 Client ID 확인
- `.env.local` 파일의 AWS 설정 확인

### Lambda 함수 오류
- CloudWatch Logs 확인
- IAM 역할 권한 확인

## 문서

- [API Gateway 설정](API_GATEWAY_SETUP.md)
- [AWS 진행 상황](AWS_PROGRESS.md)
- [서버리스 아키텍처](serverless_architecture_design.md)
- [개발 계획](docs/development-plan.md)

## 라이선스

MIT License

## 기여

이슈 및 PR 환영합니다!
