# Lambda 환경 변수 관리 가이드

> AI Co-Learner 프로젝트의 Lambda 함수별 환경 변수 설정 및 관리 가이드

---

## 목차
1. [개요](#개요)
2. [필수 환경 변수](#필수-환경-변수)
3. [DynamoDB 테이블 환경 변수](#dynamodb-테이블-환경-변수)
4. [Lambda별 필요 환경 변수 매핑](#lambda별-필요-환경-변수-매핑)
5. [환경 변수 설정 방법](#환경-변수-설정-방법)
6. [Deploy Script 자동화](#deploy-script-자동화)
7. [트러블슈팅](#트러블슈팅)

---

## 개요

현재 일부 Lambda 함수는 DynamoDB 테이블 이름을 하드코딩하고 있습니다. 이 문서는 모든 Lambda 함수에서 환경 변수를 통일된 방식으로 사용하도록 하는 가이드를 제공합니다.

### 현재 상태 분석

**환경 변수 사용 중인 Lambda 함수:**
- `message-batch-analyzer`: SESSIONS_TABLE, ANALYTICS_TABLE 사용
- `competency-aggregator`: ANALYTICS_TABLE, COMPETENCIES_TABLE, USERS_TABLE 사용
- `assessment-analyzer`: GEMINI_API_KEY 사용

**하드코딩 사용 중인 Lambda 함수:**
- `quest-generator`: 테이블 이름 직접 하드코딩
- `quest-evaluator`: 테이블 이름 직접 하드코딩
- `achievement-evaluator`: 테이블 이름 직접 하드코딩
- `learning-pattern-analyzer`: 테이블 이름 직접 하드코딩
- `chat-api`: 일부 테이블은 환경 변수, 일부는 하드코딩 혼용

---

## 필수 환경 변수

모든 Lambda 함수에서 필요에 따라 사용하는 공통 환경 변수:

### 1. GEMINI_API_KEY
- **설명**: Google Gemini API 키
- **필수**: AI 기능을 사용하는 Lambda 함수
- **예시**: `AIzaSyD...` (실제 API 키)
- **사용 함수**: chat-api, message-batch-analyzer, assessment-analyzer

### 2. COGNITO_USER_POOL_ID
- **설명**: AWS Cognito User Pool ID
- **필수**: 사용자 인증이 필요한 Lambda 함수
- **기본값**: `ap-northeast-2_OCntQ228q`
- **사용 함수**: chat-api

### 3. TABLE_PREFIX (선택사항)
- **설명**: DynamoDB 테이블 접두사
- **기본값**: `ai-co-learner`
- **용도**: 개발/스테이징/프로덕션 환경 분리 시 사용
- **예시**:
  - 프로덕션: `ai-co-learner`
  - 개발: `ai-co-learner-dev`
  - 스테이징: `ai-co-learner-staging`

---

## DynamoDB 테이블 환경 변수

### 권장 환경 변수 명명 규칙

각 DynamoDB 테이블에 대한 환경 변수는 다음 형식을 따릅니다:

```
TABLE_<테이블역할> = <실제 테이블 이름>
```

### 전체 테이블 목록 (10개)

| 환경 변수 이름 | 테이블 이름 | 설명 |
|----------------|-------------|------|
| `TABLE_USERS` | `ai-co-learner-users` | 사용자 프로필 및 기본 정보 |
| `TABLE_BOTS` | `ai-co-learner-user-bots` | 사용자가 생성한 AI 봇 인스턴스 |
| `TABLE_TEMPLATES` | `ai-co-learner-bot-templates` | AI 봇 템플릿 및 역량 매핑 |
| `TABLE_SESSIONS` | `ai-co-learner-chat-sessions` | 채팅 메시지 저장 (30일 TTL) |
| `TABLE_ANALYTICS` | `ai-co-learner-learning-analytics` | 메시지 분석 결과 (1년 TTL) |
| `TABLE_COMPETENCIES` | `ai-co-learner-user-competencies` | 역량 점수 및 히스토리 |
| `TABLE_ASSESSMENTS` | `ai-co-learner-assessments` | 초기 진단 결과 |
| `TABLE_QUESTS` | `ai-co-learner-daily-quests` | 일일 퀘스트 (7일 TTL) |
| `TABLE_ACHIEVEMENTS` | `ai-co-learner-user-achievements` | 뱃지 및 업적 |
| `TABLE_USAGE` | `ai-co-learner-usage-tracking` | 토큰 사용량 및 비용 (TTL 미설정) |

---

## Lambda별 필요 환경 변수 매핑

### 1. chat-api
**함수 이름**: `ai-co-learner-chat`
**필요 환경 변수**:
```bash
GEMINI_API_KEY=<your-api-key>
COGNITO_USER_POOL_ID=ap-northeast-2_OCntQ228q
TABLE_USERS=ai-co-learner-users
TABLE_BOTS=ai-co-learner-user-bots
TABLE_TEMPLATES=ai-co-learner-bot-templates
TABLE_SESSIONS=ai-co-learner-chat-sessions
TABLE_COMPETENCIES=ai-co-learner-user-competencies
TABLE_ASSESSMENTS=ai-co-learner-assessments
TABLE_QUESTS=ai-co-learner-daily-quests
TABLE_ACHIEVEMENTS=ai-co-learner-user-achievements
TABLE_USAGE=ai-co-learner-usage-tracking
```

### 2. message-batch-analyzer
**함수 이름**: `ai-co-learner-message-batch-analyzer`
**필요 환경 변수**:
```bash
GEMINI_API_KEY=<your-api-key>
TABLE_SESSIONS=ai-co-learner-chat-sessions
TABLE_ANALYTICS=ai-co-learner-learning-analytics
```

### 3. competency-aggregator
**함수 이름**: `ai-co-learner-competency-aggregator`
**필요 환경 변수**:
```bash
TABLE_ANALYTICS=ai-co-learner-learning-analytics
TABLE_COMPETENCIES=ai-co-learner-user-competencies
TABLE_USERS=ai-co-learner-users
```

### 4. quest-generator
**함수 이름**: `ai-co-learner-quest-generator`
**필요 환경 변수**:
```bash
TABLE_USERS=ai-co-learner-users
TABLE_COMPETENCIES=ai-co-learner-user-competencies
TABLE_QUESTS=ai-co-learner-daily-quests
```

### 5. quest-evaluator
**함수 이름**: `ai-co-learner-quest-evaluator`
**필요 환경 변수**:
```bash
TABLE_QUESTS=ai-co-learner-daily-quests
TABLE_ANALYTICS=ai-co-learner-learning-analytics
TABLE_COMPETENCIES=ai-co-learner-user-competencies
```

### 6. achievement-evaluator
**함수 이름**: `ai-co-learner-achievement-evaluator`
**필요 환경 변수**:
```bash
TABLE_USERS=ai-co-learner-users
TABLE_ANALYTICS=ai-co-learner-learning-analytics
TABLE_QUESTS=ai-co-learner-daily-quests
TABLE_COMPETENCIES=ai-co-learner-user-competencies
TABLE_ACHIEVEMENTS=ai-co-learner-user-achievements
```

### 7. learning-pattern-analyzer
**함수 이름**: `ai-co-learner-learning-pattern-analyzer`
**필요 환경 변수**:
```bash
TABLE_COMPETENCIES=ai-co-learner-user-competencies
TABLE_ANALYTICS=ai-co-learner-learning-analytics
TABLE_SESSIONS=ai-co-learner-chat-sessions
TABLE_BOTS=ai-co-learner-user-bots
```

### 8. assessment-analyzer
**함수 이름**: `ai-co-learner-assessment-analyzer`
**필요 환경 변수**:
```bash
GEMINI_API_KEY=<your-api-key>
TABLE_ASSESSMENTS=ai-co-learner-assessments
TABLE_COMPETENCIES=ai-co-learner-user-competencies
```

---

## 환경 변수 설정 방법

### 방법 1: AWS CLI로 개별 설정

각 Lambda 함수에 환경 변수를 설정하는 방법:

```bash
# chat-api 예시
aws lambda update-function-configuration \
  --function-name ai-co-learner-chat \
  --region ap-northeast-2 \
  --environment "Variables={
    GEMINI_API_KEY=<your-api-key>,
    COGNITO_USER_POOL_ID=ap-northeast-2_OCntQ228q,
    TABLE_USERS=ai-co-learner-users,
    TABLE_BOTS=ai-co-learner-user-bots,
    TABLE_TEMPLATES=ai-co-learner-bot-templates,
    TABLE_SESSIONS=ai-co-learner-chat-sessions,
    TABLE_COMPETENCIES=ai-co-learner-user-competencies,
    TABLE_ASSESSMENTS=ai-co-learner-assessments,
    TABLE_QUESTS=ai-co-learner-daily-quests,
    TABLE_ACHIEVEMENTS=ai-co-learner-user-achievements,
    TABLE_USAGE=ai-co-learner-usage-tracking
  }"
```

```bash
# message-batch-analyzer 예시
aws lambda update-function-configuration \
  --function-name ai-co-learner-message-batch-analyzer \
  --region ap-northeast-2 \
  --environment "Variables={
    GEMINI_API_KEY=<your-api-key>,
    TABLE_SESSIONS=ai-co-learner-chat-sessions,
    TABLE_ANALYTICS=ai-co-learner-learning-analytics
  }"
```

```bash
# competency-aggregator 예시
aws lambda update-function-configuration \
  --function-name ai-co-learner-competency-aggregator \
  --region ap-northeast-2 \
  --environment "Variables={
    TABLE_ANALYTICS=ai-co-learner-learning-analytics,
    TABLE_COMPETENCIES=ai-co-learner-user-competencies,
    TABLE_USERS=ai-co-learner-users
  }"
```

```bash
# quest-generator 예시
aws lambda update-function-configuration \
  --function-name ai-co-learner-quest-generator \
  --region ap-northeast-2 \
  --environment "Variables={
    TABLE_USERS=ai-co-learner-users,
    TABLE_COMPETENCIES=ai-co-learner-user-competencies,
    TABLE_QUESTS=ai-co-learner-daily-quests
  }"
```

```bash
# quest-evaluator 예시
aws lambda update-function-configuration \
  --function-name ai-co-learner-quest-evaluator \
  --region ap-northeast-2 \
  --environment "Variables={
    TABLE_QUESTS=ai-co-learner-daily-quests,
    TABLE_ANALYTICS=ai-co-learner-learning-analytics,
    TABLE_COMPETENCIES=ai-co-learner-user-competencies
  }"
```

```bash
# achievement-evaluator 예시
aws lambda update-function-configuration \
  --function-name ai-co-learner-achievement-evaluator \
  --region ap-northeast-2 \
  --environment "Variables={
    TABLE_USERS=ai-co-learner-users,
    TABLE_ANALYTICS=ai-co-learner-learning-analytics,
    TABLE_QUESTS=ai-co-learner-daily-quests,
    TABLE_COMPETENCIES=ai-co-learner-user-competencies,
    TABLE_ACHIEVEMENTS=ai-co-learner-user-achievements
  }"
```

```bash
# learning-pattern-analyzer 예시
aws lambda update-function-configuration \
  --function-name ai-co-learner-learning-pattern-analyzer \
  --region ap-northeast-2 \
  --environment "Variables={
    TABLE_COMPETENCIES=ai-co-learner-user-competencies,
    TABLE_ANALYTICS=ai-co-learner-learning-analytics,
    TABLE_SESSIONS=ai-co-learner-chat-sessions,
    TABLE_BOTS=ai-co-learner-user-bots
  }"
```

```bash
# assessment-analyzer 예시
aws lambda update-function-configuration \
  --function-name ai-co-learner-assessment-analyzer \
  --region ap-northeast-2 \
  --environment "Variables={
    GEMINI_API_KEY=<your-api-key>,
    TABLE_ASSESSMENTS=ai-co-learner-assessments,
    TABLE_COMPETENCIES=ai-co-learner-user-competencies
  }"
```

### 방법 2: AWS Console에서 설정

1. AWS Lambda 콘솔 접속
2. 함수 선택
3. **Configuration** 탭 → **Environment variables** 선택
4. **Edit** 클릭
5. 환경 변수 추가/수정
6. **Save** 클릭

### 방법 3: JSON 파일을 사용한 일괄 설정

환경 변수를 JSON 파일로 관리하는 방법:

**env-config.json** (예시: chat-api):
```json
{
  "Variables": {
    "GEMINI_API_KEY": "<your-api-key>",
    "COGNITO_USER_POOL_ID": "ap-northeast-2_OCntQ228q",
    "TABLE_USERS": "ai-co-learner-users",
    "TABLE_BOTS": "ai-co-learner-user-bots",
    "TABLE_TEMPLATES": "ai-co-learner-bot-templates",
    "TABLE_SESSIONS": "ai-co-learner-chat-sessions",
    "TABLE_COMPETENCIES": "ai-co-learner-user-competencies",
    "TABLE_ASSESSMENTS": "ai-co-learner-assessments",
    "TABLE_QUESTS": "ai-co-learner-daily-quests",
    "TABLE_ACHIEVEMENTS": "ai-co-learner-user-achievements",
    "TABLE_USAGE": "ai-co-learner-usage-tracking"
  }
}
```

설정 적용:
```bash
aws lambda update-function-configuration \
  --function-name ai-co-learner-chat \
  --region ap-northeast-2 \
  --environment file://env-config.json
```

---

## Deploy Script 자동화

### 기존 deploy.bat 구조

현재 deploy.bat 파일은 단순히 코드만 업데이트합니다:

```batch
@echo off
echo Deploying Lambda function...

echo Step 1: Creating deployment package...
powershell "Remove-Item -Path function.zip -ErrorAction SilentlyContinue; Compress-Archive -Path index.mjs,package.json,node_modules -DestinationPath function.zip -Force"

echo Step 2: Uploading to AWS Lambda...
aws lambda update-function-code --function-name ai-co-learner-chat --zip-file fileb://function.zip --region ap-northeast-2

echo Step 3: Waiting for update to complete...
timeout /t 5

echo Step 4: Checking function status...
aws lambda get-function --function-name ai-co-learner-chat --region ap-northeast-2 --query "Configuration.LastUpdateStatus"

echo.
echo Deployment complete!
```

### 개선된 deploy.bat (환경 변수 설정 포함)

**lambda/chat-api/deploy.bat** (개선 예시):

```batch
@echo off
echo ========================================
echo Deploying ai-co-learner-chat Lambda
echo ========================================

SET FUNCTION_NAME=ai-co-learner-chat
SET REGION=ap-northeast-2

echo.
echo Step 1: Creating deployment package...
powershell "Remove-Item -Path function.zip -ErrorAction SilentlyContinue; Compress-Archive -Path index.mjs,package.json,node_modules -DestinationPath function.zip -Force"

echo.
echo Step 2: Uploading function code...
aws lambda update-function-code ^
  --function-name %FUNCTION_NAME% ^
  --zip-file fileb://function.zip ^
  --region %REGION%

echo.
echo Step 3: Updating environment variables...
aws lambda update-function-configuration ^
  --function-name %FUNCTION_NAME% ^
  --region %REGION% ^
  --environment "Variables={GEMINI_API_KEY=%GEMINI_API_KEY%,COGNITO_USER_POOL_ID=ap-northeast-2_OCntQ228q,TABLE_USERS=ai-co-learner-users,TABLE_BOTS=ai-co-learner-user-bots,TABLE_TEMPLATES=ai-co-learner-bot-templates,TABLE_SESSIONS=ai-co-learner-chat-sessions,TABLE_COMPETENCIES=ai-co-learner-user-competencies,TABLE_ASSESSMENTS=ai-co-learner-assessments,TABLE_QUESTS=ai-co-learner-daily-quests,TABLE_ACHIEVEMENTS=ai-co-learner-user-achievements,TABLE_USAGE=ai-co-learner-usage-tracking}"

echo.
echo Step 4: Waiting for update to complete...
timeout /t 5

echo.
echo Step 5: Checking function status...
aws lambda get-function ^
  --function-name %FUNCTION_NAME% ^
  --region %REGION% ^
  --query "Configuration.LastUpdateStatus"

echo.
echo ========================================
echo Deployment complete!
echo ========================================
```

**주의**: `GEMINI_API_KEY`는 시스템 환경 변수로 미리 설정해두어야 합니다:

```batch
# Windows에서 환경 변수 설정 (관리자 권한 cmd)
setx GEMINI_API_KEY "your-actual-api-key" /M
```

또는 `.env` 파일을 사용하는 방법:

**lambda/chat-api/.env.deploy** (Git에 커밋하지 말 것!):
```
GEMINI_API_KEY=your-actual-api-key
```

**deploy.bat** (환경 변수 파일 로드):
```batch
@echo off

REM .env.deploy 파일에서 환경 변수 로드
if exist .env.deploy (
  for /F "tokens=1,2 delims==" %%a in (.env.deploy) do set %%a=%%b
) else (
  echo Error: .env.deploy file not found!
  echo Please create .env.deploy with GEMINI_API_KEY=your-key
  exit /b 1
)

REM ... 나머지 배포 스크립트
```

### 전체 Lambda 함수 일괄 배포 스크립트

**scripts/deploy-all-lambdas.bat**:

```batch
@echo off
echo ========================================
echo Deploying ALL Lambda Functions
echo ========================================

REM 환경 변수 확인
if "%GEMINI_API_KEY%"=="" (
  echo Error: GEMINI_API_KEY environment variable not set!
  exit /b 1
)

SET REGION=ap-northeast-2

echo.
echo [1/8] Deploying chat-api...
cd lambda\chat-api
call deploy.bat
cd ..\..

echo.
echo [2/8] Deploying message-batch-analyzer...
cd lambda\message-batch-analyzer
call deploy.bat
cd ..\..

echo.
echo [3/8] Deploying competency-aggregator...
cd lambda\competency-aggregator
call deploy.bat
cd ..\..

echo.
echo [4/8] Deploying quest-generator...
cd lambda\quest-generator
call deploy.bat
cd ..\..

echo.
echo [5/8] Deploying quest-evaluator...
cd lambda\quest-evaluator
call deploy.bat
cd ..\..

echo.
echo [6/8] Deploying achievement-evaluator...
cd lambda\achievement-evaluator
call deploy.bat
cd ..\..

echo.
echo [7/8] Deploying learning-pattern-analyzer...
cd lambda\learning-pattern-analyzer
call deploy.bat
cd ..\..

echo.
echo [8/8] Deploying assessment-analyzer...
cd lambda\assessment-analyzer
call deploy.bat
cd ..\..

echo.
echo ========================================
echo All Lambda functions deployed!
echo ========================================
```

---

## 트러블슈팅

### 문제 1: 환경 변수가 적용되지 않음

**증상**: Lambda 함수 실행 시 `undefined` 또는 기본값 사용

**원인**:
- 환경 변수 설정 후 함수 재시작 안 함
- 환경 변수 이름 오타

**해결**:
```bash
# 환경 변수 확인
aws lambda get-function-configuration \
  --function-name ai-co-learner-chat \
  --region ap-northeast-2 \
  --query "Environment"

# 환경 변수 재설정
aws lambda update-function-configuration \
  --function-name ai-co-learner-chat \
  --region ap-northeast-2 \
  --environment "Variables={...}"
```

### 문제 2: GEMINI_API_KEY 보안 이슈

**증상**: API 키가 노출될 위험

**권장 해결 방법**: AWS Secrets Manager 사용

1. Secrets Manager에 API 키 저장:
```bash
aws secretsmanager create-secret \
  --name ai-co-learner/gemini-api-key \
  --secret-string "your-actual-api-key" \
  --region ap-northeast-2
```

2. Lambda 함수에 Secrets Manager 접근 권한 부여 (IAM Role)

3. Lambda 코드에서 Secrets Manager 사용:
```javascript
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const secretsClient = new SecretsManagerClient({ region: "ap-northeast-2" });

async function getGeminiApiKey() {
  const response = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: "ai-co-learner/gemini-api-key" })
  );
  return response.SecretString;
}

const GEMINI_API_KEY = await getGeminiApiKey();
```

### 문제 3: 테이블 이름 변경이 모든 Lambda에 반영되지 않음

**증상**: 일부 Lambda는 작동하지만 일부는 `ResourceNotFoundException` 발생

**원인**: 하드코딩된 테이블 이름이 남아있음

**해결**:
1. 모든 Lambda 함수 코드에서 하드코딩 제거
2. 환경 변수로 통일
3. 재배포

```bash
# 모든 Lambda 함수 확인
grep -r "ai-co-learner-" lambda/*/index.mjs
```

### 문제 4: deploy.bat 실행 시 환경 변수 누락

**증상**: `Variables={...}` 파싱 오류

**원인**: Windows 배치 파일에서 특수문자 이스케이프 필요

**해결**: JSON 파일 방식 사용 (방법 3 참조)

---

## 체크리스트

### Lambda 함수 환경 변수 통일 작업 체크리스트

- [ ] 1. 모든 Lambda 함수 코드에서 하드코딩된 테이블 이름 확인
- [ ] 2. 각 Lambda 함수 `index.mjs`에 환경 변수 사용 코드 추가
  ```javascript
  const TABLE_NAME = process.env.TABLE_NAME || "ai-co-learner-default";
  ```
- [ ] 3. AWS Lambda 콘솔 또는 CLI로 환경 변수 설정
- [ ] 4. 각 Lambda 함수의 `deploy.bat`에 환경 변수 설정 명령 추가
- [ ] 5. `.env.deploy` 파일 생성 (.gitignore에 추가)
- [ ] 6. 테스트 실행으로 환경 변수 적용 확인
- [ ] 7. CloudWatch Logs에서 오류 확인
- [ ] 8. 문서 업데이트 (CLAUDE.md)

### 보안 체크리스트

- [ ] `.env.deploy` 파일이 `.gitignore`에 포함되어 있는지 확인
- [ ] GEMINI_API_KEY가 코드에 하드코딩되지 않았는지 확인
- [ ] Secrets Manager 사용 고려 (프로덕션 환경)
- [ ] IAM 권한 최소화 (Principle of Least Privilege)

---

## 참고 자료

- [AWS Lambda 환경 변수 공식 문서](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html)
- [AWS Secrets Manager 사용 가이드](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html)
- [DynamoDB 테이블 설계 모범 사례](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)

---

**마지막 업데이트**: 2025-12-31
**작성자**: Claude Sonnet 4.5
**버전**: 1.0
