# Scripts 디렉토리

AI Co-Learner 프로젝트의 유틸리티 스크립트 모음

---

## 📋 스크립트 목록

### 🔐 관리자 권한 관리 ⭐ **NEW**

#### `manage-admin.mjs`
사용자 역할 관리 (ADMIN/SUPER_USER/USER)

**사용법:**
```bash
# 역할 변경
node manage-admin.mjs set <username> <role>

# 현재 역할 확인
node manage-admin.mjs get <username>

# 관리자 목록 조회
node manage-admin.mjs list

# 전체 사용자 목록
node manage-admin.mjs list-all

# 도움말
node manage-admin.mjs --help
```

**예시:**
```bash
# john.doe를 ADMIN으로 승격
node manage-admin.mjs set john.doe ADMIN

# 현재 역할 확인
node manage-admin.mjs get john.doe

# 모든 관리자 보기
node manage-admin.mjs list
```

**역할 종류:**
- `ADMIN` 👑 - 모든 관리 기능 (사용자 관리, 사용량 통계, 봇 템플릿)
- `SUPER_USER` ⭐ - 봇 템플릿 관리만 가능
- `USER` 👤 - 일반 사용자

---

### 👥 테스트 계정 관리

#### `create-test-accounts.mjs`
학교용 테스트 계정 대량 생성 (120개)

**사용법:**
```bash
node create-test-accounts.mjs
```

**생성 계정:**
- 학생 계정 120개 (`student001` ~ `student120`)
- 비밀번호: `Test1234!`
- 소속: 각 학교명 자동 할당

---

### 환경 설정 필요 (`.example.mjs` 파일)

다음 스크립트들은 **민감한 정보가 포함**되어 있어 `.gitignore`에 추가되어 있습니다.
사용하려면 `.example.mjs` 파일을 복사하여 사용하세요.

#### 1. `create-demo-account.example.mjs`
**목적**: 데모 계정 생성 (역량 데이터, 뱃지, 퀘스트 포함)

**사용법**:
```bash
# 1. 파일 복사
cp create-demo-account.example.mjs create-demo-account.mjs

# 2. .env.local에 환경 변수 설정
# COGNITO_USER_POOL_ID=your-user-pool-id

# 3. 실행
node create-demo-account.mjs
```

**필요 환경 변수**:
- `COGNITO_USER_POOL_ID` - AWS Cognito User Pool ID
- `AWS_REGION` - AWS 리전 (기본값: ap-northeast-2)

**생성 항목**:
- Cognito 사용자 계정
- DynamoDB 사용자 프로필 (역량 점수 포함)
- 30일간의 역량 성장 히스토리
- 4개의 뱃지
- 오늘의 퀘스트 (3개)

---

#### 2. `add-badges.example.mjs`
**목적**: 특정 사용자에게 뱃지 추가

**사용법**:
```bash
# 1. 파일 복사
cp add-badges.example.mjs add-badges.mjs

# 2. 실행 (환경 변수로 USER_ID 전달)
USER_ID=your-user-id node add-badges.mjs
```

**필요 환경 변수**:
- `USER_ID` - 뱃지를 추가할 사용자의 ID (실행 시 전달)
- `AWS_REGION` - AWS 리전 (기본값: ap-northeast-2)

**추가되는 뱃지**:
- `creative-spark` (8일 전 획득)
- `question-master` (5일 전 획득)
- `daily-warrior` (3일 전 획득)

---

#### 3. `evaluate-ui-ux.example.mjs`
**목적**: Google Gemini AI를 사용한 Dashboard UI/UX 자동 평가

**사용법**:
```bash
# 1. 파일 복사
cp evaluate-ui-ux.example.mjs evaluate-ui-ux.mjs

# 2. .env.local에 환경 변수 설정
# GEMINI_API_KEY=your-gemini-api-key

# 3. 실행
node evaluate-ui-ux.mjs
```

**필요 환경 변수**:
- `GEMINI_API_KEY` - Google Gemini API 키

**출력**:
- 콘솔에 평가 결과 출력
- `docs/ui-ux-evaluation.md` 파일 자동 생성

**평가 항목**:
1. 정보 아키텍처
2. 사용성
3. 타겟 사용자 적합성
4. 시각 디자인
5. 인터랙션 디자인
6. 반응형 디자인
7. 접근성
8. 개선 제안 (5개 이상)

---

## 🔒 보안 주의사항

### Git에서 제외되는 파일들 (`.gitignore`)
다음 파일들은 **절대 커밋하지 마세요**:
- `create-demo-account.mjs` (실제 User Pool ID 포함)
- `add-badges.mjs` (실제 User ID 포함)
- `evaluate-ui-ux.mjs` (실제 API 키 포함)
- `payload.json` (테스트 데이터)
- `ui-ux-evaluation-prompt.txt` (임시 파일)

### 환경 변수 설정 방법

**프로젝트 루트의 `.env.local` 파일에 추가**:
```bash
# AWS Credentials (for scripts)
AWS_REGION=ap-northeast-2
COGNITO_USER_POOL_ID=ap-northeast-2_YOUR_POOL_ID

# Google Gemini API
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

**또는 실행 시 직접 전달**:
```bash
# 단일 실행
USER_ID=abc-123 node add-badges.mjs

# 여러 변수 전달
COGNITO_USER_POOL_ID=ap-northeast-2_XXX AWS_REGION=ap-northeast-2 node create-demo-account.mjs
```

---

## 📦 설치 및 의존성

이 스크립트들은 AWS SDK를 사용하므로 먼저 패키지를 설치해야 합니다:

```bash
cd scripts
npm install
```

**필요 패키지**:
- `@aws-sdk/client-cognito-identity-provider`
- `@aws-sdk/client-dynamodb`
- `@aws-sdk/lib-dynamodb`
- `@google/generative-ai`

---

## 💡 자주 묻는 질문 (FAQ)

### Q1. `.example.mjs` 파일을 왜 사용하나요?
A: 민감한 정보(User Pool ID, API 키 등)가 하드코딩된 파일은 GitHub에 올리면 안 됩니다. `.example.mjs` 파일은 템플릿으로 제공하고, 실제 사용 시 복사하여 환경 변수를 설정하도록 합니다.

### Q2. 실수로 민감 정보가 포함된 파일을 커밋했어요!
A: 다음 명령어로 Git 히스토리에서 완전히 제거하세요:
```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch scripts/create-demo-account.mjs" \
  --prune-empty --tag-name-filter cat -- --all

git push origin --force --all
```

### Q3. 환경 변수가 제대로 로드되지 않아요!
A: Node.js 스크립트는 기본적으로 `.env` 파일을 자동 로드하지 않습니다. 다음 중 하나를 선택하세요:
- **방법 1**: 실행 시 직접 전달 (`USER_ID=xxx node script.mjs`)
- **방법 2**: `dotenv` 패키지 사용
  ```bash
  npm install dotenv
  # 스크립트 상단에 추가: import 'dotenv/config';
  ```

---

## 🚀 빠른 시작 가이드

### 1단계: 최초 관리자 설정 (필수)
```bash
cd scripts

# 본인 계정을 ADMIN으로 설정
node manage-admin.mjs set your-username ADMIN

# 확인
node manage-admin.mjs get your-username
```

### 2단계: 테스트 계정 생성 (선택)
```bash
# 학교용 테스트 계정 120개 생성
node create-test-accounts.mjs
```

### 3단계: 관리자 확인
```bash
# 모든 관리자 목록 조회
node manage-admin.mjs list

# 전체 사용자 목록 (역할별 통계)
node manage-admin.mjs list-all
```

### 4단계: 데모 데이터 생성 (선택)
```bash
# 환경 설정
cp .env.example .env.local

# 스크립트 복사
cp create-demo-account.example.mjs create-demo-account.mjs
cp add-badges.example.mjs add-badges.mjs

# 실행
node create-demo-account.mjs
USER_ID=your-user-id node add-badges.mjs
```

---

**마지막 업데이트**: 2026-01-08
