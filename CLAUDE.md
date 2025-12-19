# AI Co-Learner

React + TypeScript + AWS Serverless 기반 AI 학습 코칭 플랫폼

---

## 프로젝트 구조

```
ai-co-learner/
├── src/
│   ├── pages/          # Dashboard, ChatRoom, Login, InitialAssessment
│   ├── components/     # chat/, dashboard/, layout/, ui/
│   ├── services/       # awsBackend.ts (API 호출)
│   ├── contexts/       # AuthContext.tsx
│   └── types.ts
├── lambda/
│   ├── chat-api/                    # 채팅 API (Bedrock 호출)
│   ├── message-batch-analyzer/      # 5분마다 메시지 분석
│   ├── competency-aggregator/       # 1일 1회 역량 계산
│   └── assessment-analyzer/         # 초기 진단 분석 (예정)
└── docs/
    ├── development-roadmap.md       # 개발 로드맵
    ├── aws-architecture.md          # AWS 구조
    └── archive/                     # 참고 문서
```

---

## 핵심 개념

### 1. 역량 6가지 (자동 분석)
- **questionQuality**: 질문력
- **thinkingDepth**: 사고력
- **creativity**: 창의력
- **communicationClarity**: 소통력
- **executionOriented**: 실행력
- **collaborationSignal**: 협업력

### 2. 데이터 전략
- **chat-sessions** (30일 TTL): 최근 대화 저장
- **learning-analytics** (1년 TTL): 분석 데이터 장기 보관
- **배치 분석**: 5분마다 최근 메시지 분석 (비용 최적화)

### 3. AWS 리소스
- **리전**: ap-northeast-2 (Lambda, DynamoDB, API Gateway)
- **Bedrock**: us-east-1 (Llama 3.2 3B)
- **API URL**: `https://oz20zs5lfc.execute-api.ap-northeast-2.amazonaws.com/prod`

---

## 개발 시 주의사항

### 개발 환경
Windows : nul 파일이 생성안되게 주의


### Lambda 함수 배포
```bash
cd lambda/chat-api
npm install
.\deploy.bat  # Windows
```

### 환경 변수 (.env.local)
```env
VITE_COGNITO_USER_POOL_ID=ap-northeast-2_OCntQ228q
VITE_COGNITO_CLIENT_ID=4csdt3gpkfujrg1lslu4fgo5b1
VITE_API_GATEWAY_URL=https://oz20zs5lfc.execute-api.ap-northeast-2.amazonaws.com/prod
BEDROCK_MODEL_ID=meta.llama3-2-3b-instruct-v1:0
```

### DynamoDB 테이블
- `ai-co-learner-users`
- `ai-co-learner-user-bots`
- `ai-co-learner-chat-sessions` (30일 TTL)
- `ai-co-learner-learning-analytics` (1년 TTL)
- `ai-co-learner-user-competencies`
- `ai-co-learner-bot-templates`
- `ai-co-learner-usage-tracking` (사용량 추적, TTL 미설정)

### 코드 수정 시
- Lambda 함수는 `index.mjs` (ES Module)
- DynamoDB 쿼리 시 반드시 PK+SK 사용
- Bedrock 리전 cross-region 호출 (서울→버지니아)

---

## 현재 구현 상태

### ✅ 완료
- AWS 서버리스 인프라 구축
- 사용자 인증 (Cognito)
- 채팅 시스템 (Bedrock AI)
- 배치 메시지 분석 시스템
- 역량 자동 계산 시스템
- 대시보드 역량 차트
- **사용량 추적 & 비용 관리 시스템** ⭐ NEW!
  - 실시간 토큰 사용량 추적
  - 사용자별 비용 집계
  - 관리자 대시보드 (일별 차트, 월간 예상 비용)

### 🚧 다음 단계
- 초기 역량 진단 시스템 (InitialAssessment 페이지)
- Agent-Competency 매핑 (역량별 추천 봇)
- 일일 퀘스트 시스템

---

## 주요 명령어

```bash
# 개발 서버
npm run dev

# 프로덕션 빌드
npm run build

# S3 배포
aws s3 sync dist s3://ai-co-learner-frontend-synnex --region ap-northeast-2 --delete

# Lambda 로그 확인
aws logs tail /aws/lambda/ai-co-learner-chat --since 5m --region ap-northeast-2 --format short
```

---

## 트러블슈팅

### CORS 에러
- API Gateway CORS 설정 확인
- 헤더: `Access-Control-Allow-Origin: *`

### Lambda 타임아웃
- Bedrock 응답 지연 시 타임아웃 30초 → 60초 증가

### DynamoDB 비용 급증
- TTL 설정 확인 (chat-sessions: 30일, learning-analytics: 1년)
- Scan 대신 Query 사용

### 수정 및 업데이트 시 항상 발생하는 문제
- Lambda 함수가 정상적으로 CORS 헤더를 반환에서 에러가 발생, 따라서 이 문제가 안생기가 디테일하게 확인

---

## 문서 참조

- **개발 로드맵**: [docs/development-roadmap.md](docs/development-roadmap.md)
- **AWS 아키텍처**: [docs/aws-architecture.md](docs/aws-architecture.md)
- **상세 가이드**: [docs/archive/](docs/archive/)

---

**마지막 업데이트**: 2025-11-27
