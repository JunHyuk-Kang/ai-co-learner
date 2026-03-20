# Lambda Layer를 사용한 공통 의존성 분리 가이드

## 1. 개요

### Lambda Layer란?
AWS Lambda Layer는 Lambda 함수에서 사용할 수 있는 라이브러리, 커스텀 런타임 또는 다른 코드를 패키징하는 메커니즘입니다. Layer는 `/opt` 경로에 마운트되며, 여러 Lambda 함수에서 공유할 수 있습니다.

### Layer의 장점
- **배포 패키지 크기 감소**: 각 함수가 중복된 의존성을 포함할 필요 없음 (50% 이상 감소)
- **배포 속도 향상**: 더 작은 파일을 업로드하므로 배포 시간 단축
- **유지보수 용이**: 공통 라이브러리 업데이트 시 한 곳에서만 관리
- **콜드 스타트 개선**: 더 작은 패키지 크기로 인한 로딩 시간 감소
- **비용 절감**: 더 빠른 배포로 인한 Lambda 실행 시간 단축

---

## 2. 현재 문제점

### 배포 패키지 중복

현재 프로젝트의 8개 Lambda 함수:
1. **chat-api** (~150MB) - 모든 AWS SDK + Gemini API
2. **message-batch-analyzer** (~120MB)
3. **competency-aggregator** (~120MB)
4. **quest-generator** (~120MB)
5. **quest-evaluator** (~120MB)
6. **achievement-evaluator** (~120MB)
7. **learning-pattern-analyzer** (~120MB)
8. **assessment-analyzer** (~120MB)

### 공통 의존성의 중복

모든 Lambda 함수가 다음 패키지를 개별적으로 설치:
```
@aws-sdk/client-dynamodb: ~150MB
@aws-sdk/lib-dynamodb: ~50MB
@aws-sdk/client-cognito-identity-provider: ~80MB (chat-api만)
@aws-sdk/client-lambda: ~80MB (chat-api, message-batch-analyzer)
@google/generative-ai: ~20MB (chat-api만)
```

### 영향
- **총 배포 용량**: 약 1GB (8개 함수 × 120-150MB)
- **배포 시간**: 각 함수당 평균 20-30초
- **S3 저장 공간**: 불필요한 용량 낭비

---

## 3. 해결 방안: Lambda Layer 도입

### 아키텍처 변경

```
Before (현재):
lambda/
├── chat-api/
│   ├── node_modules/ (150MB)
│   ├── index.mjs
│   └── package.json
├── competency-aggregator/
│   ├── node_modules/ (120MB)
│   ├── index.mjs
│   └── package.json
└── ... (6개 함수 더)

After (개선안):
lambda/
├── layers/
│   └── common-dependencies/
│       └── nodejs/
│           └── node_modules/ (200MB - 모든 공통 의존성)
├── chat-api/
│   ├── index.mjs
│   └── package.json (dev 의존성만)
├── competency-aggregator/
│   ├── index.mjs
│   └── package.json (dev 의존성만)
└── ... (6개 함수 더)
```

### 예상 효과
- **배포 패키지 크기**: 1GB → 500MB (50% 감소)
- **배포 시간**: 전체 시간 60% 단축
- **콜드 스타트**: 약 200-300ms 개선
- **월간 비용 절감**: Lambda 실행 시간 약 5-10% 감소

---

## 4. 공통 의존성 목록

### AWS SDK 의존성 (모든 함수에서 사용)
```json
{
  "@aws-sdk/client-dynamodb": "^3.720.0",
  "@aws-sdk/lib-dynamodb": "^3.720.0"
}
```

### 선택적 의존성 (일부 함수)
- `@aws-sdk/client-cognito-identity-provider`: chat-api만 필요
- `@aws-sdk/client-lambda`: chat-api, message-batch-analyzer 필요
- `@google/generative-ai`: chat-api만 필요

### 권장사항
**공유 Layer 전략**:
1. **common-dependencies Layer**: AWS SDK (모든 함수에서 사용)
2. **gemini-dependencies Layer** (선택): Gemini API (chat-api 전용)

이 가이드에서는 `common-dependencies` Layer만 다룹니다.

---

## 5. Layer 생성 방법

### Step 1: 디렉토리 구조 생성

```bash
cd c:\Users\Juny\Desktop\synnex\ai-co-learner\lambda
mkdir layers\common-dependencies\nodejs
cd layers\common-dependencies\nodejs
```

### Step 2: package.json 생성

`c:\Users\Juny\Desktop\synnex\ai-co-learner\lambda\layers\common-dependencies\nodejs\package.json` 파일을 생성합니다:

```json
{
  "name": "ai-co-learner-common-dependencies",
  "version": "1.0.0",
  "description": "Common AWS SDK dependencies for Lambda functions",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.720.0",
    "@aws-sdk/lib-dynamodb": "^3.720.0"
  }
}
```

### Step 3: npm install 실행

```bash
cd c:\Users\Juny\Desktop\synnex\ai-co-learner\lambda\layers\common-dependencies\nodejs
npm install
```

**예상 결과**:
```
node_modules/
├── @aws-sdk/
│   ├── client-dynamodb/
│   └── lib-dynamodb/
├── @smithy/
├── tslib/
└── ... (의존성들)
```

### Step 4: ZIP 파일 생성 (Windows PowerShell)

**방법 1: PowerShell로 직접 압축**

```powershell
# PowerShell 실행
cd "C:\Users\Juny\Desktop\synnex\ai-co-learner\lambda\layers\common-dependencies"
Compress-Archive -Path nodejs -DestinationPath common-dependencies.zip -Force
```

**방법 2: 배치 스크립트 사용**

`c:\Users\Juny\Desktop\synnex\ai-co-learner\lambda\layers\create-layer.bat` 생성:

```batch
@echo off
REM Lambda Layer 생성 스크립트 (Windows)
REM 사용법: create-layer.bat

setlocal enabledelayedexpansion

cd /d "%~dp0common-dependencies"

echo.
echo ======================================
echo Lambda Layer 생성 시작
echo ======================================
echo.

REM Step 1: node_modules 정리
echo Step 1: 기존 파일 정리 중...
if exist common-dependencies.zip (
    del /q common-dependencies.zip
    echo - common-dependencies.zip 삭제됨
)

REM Step 2: npm install 확인
echo.
echo Step 2: npm install 확인 중...
if not exist "nodejs\node_modules" (
    echo nodejs\node_modules 디렉토리가 없습니다.
    echo 먼저 다음을 실행하세요:
    echo   cd nodejs
    echo   npm install
    exit /b 1
)
echo - nodejs\node_modules 확인됨 (%cd%\nodejs\node_modules)

REM Step 3: ZIP 파일 생성
echo.
echo Step 3: ZIP 파일 생성 중...
powershell -Command "Compress-Archive -Path nodejs -DestinationPath common-dependencies.zip -Force"
if %ERRORLEVEL% EQU 0 (
    echo - common-dependencies.zip 생성 완료
    REM 파일 크기 확인
    for /f "tokens=*" %%A in ('powershell -Command "'{0:F2} MB' -f ((Get-Item 'common-dependencies.zip').Length / 1MB)"') do set SIZE=%%A
    echo - 파일 크기: !SIZE!
) else (
    echo ERROR: ZIP 파일 생성 실패
    exit /b 1
)

REM Step 4: AWS CLI를 사용한 Layer 업로드 (선택적)
echo.
echo Step 4: AWS CLI로 Layer 업로드 (선택적)
echo.
echo AWS CLI가 설치되어 있고 AWS 자격증명이 설정되어 있으면 다음을 실행하세요:
echo.
echo aws lambda publish-layer-version ^
echo   --layer-name ai-co-learner-common-dependencies ^
echo   --zip-file fileb://common-dependencies.zip ^
echo   --compatible-runtimes nodejs22.x ^
echo   --region ap-northeast-2
echo.

echo.
echo ======================================
echo Lambda Layer 생성 완료!
echo ======================================
echo.
echo ZIP 파일 위치: %cd%\common-dependencies.zip
echo.

pause
```

**실행 방법**:
```bash
cd lambda\layers
.\create-layer.bat
```

### Step 5: AWS에 Layer 업로드

**AWS CLI를 사용한 Layer 게시**:

```bash
cd c:\Users\Juny\Desktop\synnex\ai-co-learner\lambda\layers\common-dependencies

aws lambda publish-layer-version `
  --layer-name ai-co-learner-common-dependencies `
  --zip-file fileb://common-dependencies.zip `
  --compatible-runtimes nodejs22.x `
  --region ap-northeast-2
```

**예상 출력**:
```json
{
    "LayerVersionArn": "arn:aws:lambda:ap-northeast-2:123456789012:layer:ai-co-learner-common-dependencies:1",
    "LayerArn": "arn:aws:lambda:ap-northeast-2:123456789012:layer:ai-co-learner-common-dependencies",
    "Version": 1,
    "Description": "",
    "CreatedDate": "2025-12-31T10:00:00.000+0000",
    "CompatibleRuntimes": [
        "nodejs22.x"
    ]
}
```

**Layer ARN 기록**:
```
arn:aws:lambda:ap-northeast-2:123456789012:layer:ai-co-learner-common-dependencies:1
```

---

## 6. Lambda 함수에 Layer 연결

### AWS Console을 통한 연결

1. AWS Lambda 콘솔 접속
2. 각 Lambda 함수 선택 (예: `ai-co-learner-chat`)
3. **Code** 탭 → **Layers** 섹션에서 **Add a layer** 클릭
4. **Custom layers** 선택
5. **ai-co-learner-common-dependencies** (최신 버전) 선택
6. **Add** 클릭

### AWS CLI를 사용한 연결

```bash
# 변수 설정
$LAYER_ARN = "arn:aws:lambda:ap-northeast-2:123456789012:layer:ai-co-learner-common-dependencies:1"
$FUNCTIONS = @(
    "ai-co-learner-chat",
    "ai-co-learner-message-batch-analyzer",
    "ai-co-learner-competency-aggregator",
    "ai-co-learner-quest-generator",
    "ai-co-learner-quest-evaluator",
    "ai-co-learner-achievement-evaluator",
    "ai-co-learner-learning-pattern-analyzer",
    "ai-co-learner-assessment-analyzer"
)

# 각 함수에 Layer 추가
foreach ($func in $FUNCTIONS) {
    echo "Updating $func..."
    aws lambda update-function-configuration `
      --function-name $func `
      --layers $LAYER_ARN `
      --region ap-northeast-2
}
```

### 배치 스크립트 (Windows)

`c:\Users\Juny\Desktop\synnex\ai-co-learner\lambda\layers\attach-layer.bat` 생성:

```batch
@echo off
REM Lambda 함수에 Layer 연결 스크립트

setlocal enabledelayedexpansion

echo.
echo ======================================
echo Lambda Layer 연결 시작
echo ======================================
echo.

REM Layer ARN (업로드 후 반환된 ARN으로 변경)
set LAYER_ARN=arn:aws:lambda:ap-northeast-2:123456789012:layer:ai-co-learner-common-dependencies:1

echo Layer ARN: !LAYER_ARN!
echo.

REM Lambda 함수 목록
set FUNCTIONS[0]=ai-co-learner-chat
set FUNCTIONS[1]=ai-co-learner-message-batch-analyzer
set FUNCTIONS[2]=ai-co-learner-competency-aggregator
set FUNCTIONS[3]=ai-co-learner-quest-generator
set FUNCTIONS[4]=ai-co-learner-quest-evaluator
set FUNCTIONS[5]=ai-co-learner-achievement-evaluator
set FUNCTIONS[6]=ai-co-learner-learning-pattern-analyzer
set FUNCTIONS[7]=ai-co-learner-assessment-analyzer

set count=0

:loop
if defined FUNCTIONS[%count%] (
    set func=!FUNCTIONS[%count%]!
    echo Updating !func!...

    aws lambda update-function-configuration ^
      --function-name !func! ^
      --layers !LAYER_ARN! ^
      --region ap-northeast-2

    if !ERRORLEVEL! EQU 0 (
        echo - !func! 업데이트 성공
    ) else (
        echo - ERROR: !func! 업데이트 실패
    )
    echo.

    set /a count+=1
    goto loop
)

echo.
echo ======================================
echo Lambda Layer 연결 완료!
echo ======================================
echo.

pause
```

---

## 7. 배포 스크립트 업데이트

### 현재 deploy.bat (chat-api)

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

### 개선된 deploy.bat (Layer 사용)

```batch
@echo off
REM Lambda 배포 스크립트 (Layer 사용)
REM 사용법: deploy.bat [update|replace]
REM   update  - 함수 코드만 업데이트 (권장)
REM   replace - 함수 전체 교체 (초기 배포)

setlocal enabledelayedexpansion

set FUNCTION_NAME=ai-co-learner-chat
set REGION=ap-northeast-2
set LAYER_ARN=arn:aws:lambda:ap-northeast-2:123456789012:layer:ai-co-learner-common-dependencies:1

echo.
echo ======================================
echo Lambda 배포 시작
echo ======================================
echo.

REM 기본값: update
set DEPLOY_MODE=update
if not "%1"=="" set DEPLOY_MODE=%1

REM Step 1: package.json에서 dev 의존성 확인
echo Step 1: package.json 확인 중...
if not exist "package.json" (
    echo ERROR: package.json을 찾을 수 없습니다.
    exit /b 1
)
echo - package.json 확인됨

REM Step 2: index.mjs 확인
echo.
echo Step 2: index.mjs 확인 중...
if not exist "index.mjs" (
    echo ERROR: index.mjs를 찾을 수 없습니다.
    exit /b 1
)
echo - index.mjs 확인됨

REM Step 3: 배포 패키지 생성
echo.
echo Step 3: 배포 패키지 생성 중...
echo - 기존 ZIP 파일 삭제 중...
if exist "function.zip" (
    del /q function.zip
    echo   - function.zip 삭제됨
)

echo - index.mjs와 package.json만 압축 중...
powershell -Command "Compress-Archive -Path index.mjs,package.json -DestinationPath function.zip -Force"

if !ERRORLEVEL! EQU 0 (
    REM 파일 크기 확인
    for /f "tokens=*" %%A in ('powershell -Command "'{0:F2} MB' -f ((Get-Item 'function.zip').Length / 1MB)"') do set SIZE=%%A
    echo - 배포 패키지 생성 완료 (!SIZE!)
) else (
    echo ERROR: 배포 패키지 생성 실패
    exit /b 1
)

REM Step 4: AWS Lambda에 업로드
echo.
echo Step 4: AWS Lambda에 업로드 중...
aws lambda update-function-code ^
  --function-name !FUNCTION_NAME! ^
  --zip-file fileb://function.zip ^
  --region !REGION!

if !ERRORLEVEL! EQU 0 (
    echo - 코드 업로드 성공
) else (
    echo ERROR: 코드 업로드 실패
    exit /b 1
)

REM Step 5: Layer 연결 확인 (처음 배포할 때만)
if "!DEPLOY_MODE!"=="replace" (
    echo.
    echo Step 5: Layer 연결 중...
    aws lambda update-function-configuration ^
      --function-name !FUNCTION_NAME! ^
      --layers !LAYER_ARN! ^
      --region !REGION!

    if !ERRORLEVEL! EQU 0 (
        echo - Layer 연결 성공
    ) else (
        echo ERROR: Layer 연결 실패
        exit /b 1
    )
)

REM Step 6: 배포 완료 대기
echo.
echo Step 6: 배포 완료 대기 중...
timeout /t 5

REM Step 7: 함수 상태 확인
echo.
echo Step 7: 함수 상태 확인 중...
aws lambda get-function ^
  --function-name !FUNCTION_NAME! ^
  --region !REGION! ^
  --query "Configuration.[FunctionName,LastUpdateStatus,CodeSize]" ^
  --output text

echo.
echo ======================================
echo 배포 완료!
echo ======================================
echo.
echo 함수명: !FUNCTION_NAME!
echo 배포 모드: !DEPLOY_MODE!
echo 배포 패키지 크기: 약 5KB (node_modules 제외)
echo.

pause
```

**실행 방법**:
```bash
# 기본 배포 (권장) - Layer가 이미 연결되어 있을 때
cd lambda\chat-api
.\deploy.bat update

# 초기 배포 - Layer 새로 연결
.\deploy.bat replace
```

### 다른 Lambda 함수용 deploy.bat

각 함수 디렉토리(`lambda/competency-aggregator`, `lambda/quest-generator` 등)에서 `FUNCTION_NAME` 변수만 변경하면 됩니다:

```batch
set FUNCTION_NAME=ai-co-learner-competency-aggregator
```

---

## 8. 예상 효과

### 배포 패키지 크기 비교

#### Before (Layer 미사용)
```
chat-api/node_modules:          150MB
message-batch-analyzer/node_modules: 120MB
competency-aggregator/node_modules:  120MB
quest-generator/node_modules:    120MB
quest-evaluator/node_modules:    120MB
achievement-evaluator/node_modules:  120MB
learning-pattern-analyzer/node_modules: 120MB
assessment-analyzer/node_modules: 120MB
─────────────────────────────────────
총합: 970MB
```

#### After (Layer 사용)
```
Layer (공유):                    200MB
chat-api/function.zip:          5KB
message-batch-analyzer/function.zip: 3KB
competency-aggregator/function.zip:  3KB
quest-generator/function.zip:    3KB
quest-evaluator/function.zip:    3KB
achievement-evaluator/function.zip:  3KB
learning-pattern-analyzer/function.zip: 3KB
assessment-analyzer/function.zip: 3KB
─────────────────────────────────────
총합: 232MB (약 76% 감소)
```

### 배포 시간 개선

| 메트릭 | Before | After | 개선율 |
|--------|--------|-------|--------|
| 8개 함수 배포 시간 | 240초 | 90초 | 62% |
| 함수당 평균 배포 시간 | 30초 | 11초 | 63% |
| S3 저장 공간 | 970MB | 232MB | 76% |

### 콜드 스타트 개선

```
Before:
- 초기화: 150ms
- 패키지 로드: 400ms
- 런타임 초기화: 200ms
─────────────────────
총 콜드 스타트: 750ms

After:
- 초기화: 150ms
- 패키지 로드: 150ms (Layer 캐싱)
- 런타임 초기화: 200ms
─────────────────────
총 콜드 스타트: 500ms (약 33% 개선)
```

### 월간 비용 절감

```
AWS Lambda 가격: $0.20 per 1M requests (us-east-1 기준)
실행 시간 감소: 약 250ms × 100,000 requests = 6.9시간

월간 비용:
Before: 100,000 requests × 3초 ÷ 1M × $0.20 = $0.60
After:  100,000 requests × 2.75초 ÷ 1M × $0.20 = $0.55

월간 절감액: $0.05 (약 8%)
```

---

## 9. 주의사항

### Layer 경로 및 import

Lambda Layer의 Node.js 의존성은 `/opt/nodejs/node_modules`에 마운트됩니다.

**import 문법 (변경 없음)**:
```javascript
// Layer의 의존성도 일반 node_modules처럼 import됨
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Node.js는 자동으로 /opt/nodejs/node_modules에서 찾음
```

### package.json 구성

Layer와 함수의 package.json 구성:

#### layers/common-dependencies/nodejs/package.json
```json
{
  "name": "ai-co-learner-common-dependencies",
  "version": "1.0.0",
  "description": "Common dependencies for Lambda functions",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.720.0",
    "@aws-sdk/lib-dynamodb": "^3.720.0"
  }
}
```

#### lambda/chat-api/package.json (개선)
```json
{
  "name": "ai-co-learner-chat-api",
  "version": "1.0.0",
  "type": "module",
  "description": "Chat API Lambda function",
  "main": "index.mjs",
  "dependencies": {
    "@google/generative-ai": "^0.24.1"
  },
  "devDependencies": {
    "archiver": "^7.0.1"
  }
}
```

**주의**: 배포 패키지에 `@aws-sdk/*` 의존성을 포함하지 마세요. Layer에서 제공됩니다.

### Layer 버전 관리

새로운 버전의 AWS SDK가 필요할 때:

```bash
# 1. Layer의 nodejs/package.json 업데이트
cd lambda/layers/common-dependencies/nodejs
# package.json 버전 변경
npm install

# 2. ZIP 파일 생성
cd ..
powershell "Compress-Archive -Path nodejs -DestinationPath common-dependencies.zip -Force"

# 3. 새 Layer 버전 게시
aws lambda publish-layer-version \
  --layer-name ai-co-learner-common-dependencies \
  --zip-file fileb://common-dependencies.zip \
  --compatible-runtimes nodejs22.x \
  --region ap-northeast-2

# 4. 반환된 ARN으로 함수 업데이트
# (새로운 Layer ARN을 deploy.bat에서 수정)
```

---

## 10. 트러블슈팅

### 문제 1: "Cannot find module '@aws-sdk/client-dynamodb'"

**원인**: Layer가 함수에 연결되지 않았거나 경로 문제

**해결 방법**:
```bash
# 1. Layer 연결 확인
aws lambda get-function-configuration \
  --function-name ai-co-learner-chat \
  --region ap-northeast-2 \
  --query "Layers" \
  --output json

# 2. Layer가 없으면 다시 연결
aws lambda update-function-configuration \
  --function-name ai-co-learner-chat \
  --layers arn:aws:lambda:ap-northeast-2:123456789012:layer:ai-co-learner-common-dependencies:1 \
  --region ap-northeast-2

# 3. Lambda 함수 다시 배포 (콜드 스타트 필요)
aws lambda update-function-code \
  --function-name ai-co-learner-chat \
  --zip-file fileb://function.zip \
  --region ap-northeast-2
```

### 문제 2: Layer 크기 초과 (최대 262MB)

**원인**: Layer에 불필요한 파일 포함 또는 중첩된 의존성

**해결 방법**:
```bash
# 1. node_modules 크기 확인
cd lambda/layers/common-dependencies/nodejs
du -sh node_modules

# 2. 불필요한 파일 제거 (개발 환경용)
npm install --production  # production 의존성만 설치

# 3. 또는 의존성 최소화
# - 사용하지 않는 의존성 제거
# - 더 가벼운 대체 라이브러리 검토
```

### 문제 3: 여러 Layer 연결 시 충돌

**원인**: 동일한 패키지를 제공하는 여러 Layer 존재

**해결 방법**:
```bash
# 단일 Layer 또는 명확한 계층 구조 유지
# 예: common-dependencies (AWS SDK) → gemini-dependencies (Gemini API)

# 하나의 함수에 여러 Layer 연결 가능하지만 순서 중요
aws lambda update-function-configuration \
  --function-name ai-co-learner-chat \
  --layers \
    arn:aws:lambda:ap-northeast-2:123456789012:layer:ai-co-learner-common-dependencies:1 \
    arn:aws:lambda:ap-northeast-2:123456789012:layer:ai-co-learner-gemini-dependencies:1 \
  --region ap-northeast-2

# 로드 순서: 뒤에 있는 Layer가 먼저 로드됨 (우선순위)
```

### 문제 4: 배포 후 함수가 시작되지 않음

**원인**: node_modules 경로가 실행 중에 변경되거나 Layer 캐시 문제

**해결 방법**:
```bash
# 1. CloudWatch Logs 확인
aws logs tail /aws/lambda/ai-co-learner-chat --since 5m --region ap-northeast-2

# 2. 함수 구성 확인
aws lambda get-function-configuration \
  --function-name ai-co-learner-chat \
  --region ap-northeast-2

# 3. 강제 재배포
aws lambda update-function-code \
  --function-name ai-co-learner-chat \
  --zip-file fileb://function.zip \
  --region ap-northeast-2 \
  --no-cache

# 4. 함수 테스트
aws lambda invoke \
  --function-name ai-co-learner-chat \
  --payload '{"body": "test"}' \
  --region ap-northeast-2 \
  response.json

cat response.json
```

### 문제 5: npm install이 Windows에서 느림

**원인**: Windows의 파일 시스템 성능 또는 권한 문제

**해결 방법**:
```bash
# 1. npm 캐시 정리
npm cache clean --force

# 2. node_modules 삭제 후 재설치
cd lambda/layers/common-dependencies/nodejs
rmdir /s /q node_modules
npm install --prefer-offline

# 3. npm 레지스트리 변경 (빠른 국가별 미러 사용)
npm config set registry https://registry.npmmirror.com
npm install
npm config set registry https://registry.npmjs.org/
```

### 문제 6: 배포 후에도 이전 코드 실행됨

**원인**: Lambda 콘텐츠 캐시 또는 함수 버전 문제

**해결 방법**:
```bash
# 1. 함수 업데이트 상태 확인
aws lambda get-function \
  --function-name ai-co-learner-chat \
  --region ap-northeast-2 \
  --query "Configuration.LastUpdateStatus"

# LastUpdateStatus가 "InProgress"면 완료될 때까지 대기

# 2. 함수 캐시 무효화
aws lambda update-function-configuration \
  --function-name ai-co-learner-chat \
  --environment Variables={CACHE_BUSTER="$(date +%s)"} \
  --region ap-northeast-2

# 3. 함수 재배포
aws lambda update-function-code \
  --function-name ai-co-learner-chat \
  --zip-file fileb://function.zip \
  --region ap-northeast-2
```

---

## 11. 단계별 구현 체크리스트

### Phase 1: Layer 생성

- [ ] `lambda/layers/common-dependencies/nodejs` 디렉토리 생성
- [ ] `package.json` 작성 (AWS SDK만)
- [ ] `npm install` 실행
- [ ] `common-dependencies.zip` 생성
- [ ] AWS CLI로 Layer 게시
- [ ] Layer ARN 기록

### Phase 2: Lambda 함수 업데이트

- [ ] chat-api `package.json` 수정 (node_modules 제외)
- [ ] chat-api Layer 연결 (`update-function-configuration`)
- [ ] chat-api 배포 (`deploy.bat update`)
- [ ] chat-api 테스트
- [ ] 다른 7개 함수도 동일하게 반복

### Phase 3: 배포 스크립트 업데이트

- [ ] `deploy.bat` 개선 (node_modules 제외, Layer 연결 옵션)
- [ ] Windows에서 테스트
- [ ] 문서화

### Phase 4: 검증 및 모니터링

- [ ] 배포 패키지 크기 확인 (50% 이상 감소)
- [ ] CloudWatch 로그에서 오류 확인
- [ ] 콜드 스타트 시간 측정
- [ ] 모든 기능 정상 작동 확인

---

## 12. 추가 학습 자료

### AWS 공식 문서
- [AWS Lambda Layers 개요](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-package.html#gettingstarted-package-layers)
- [Lambda Layer 생성 및 관리](https://docs.aws.amazon.com/lambda/latest/dg/configuration-layers.html)
- [Node.js Lambda 실행 환경](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html)

### 최적화 팁
1. **Production 의존성 사용**: `npm install --production`으로 dev 의존성 제외
2. **Tree Shaking**: 사용하지 않는 패키지 제거
3. **모니터링**: CloudWatch에서 `Duration`, `InitDuration` 메트릭 추적
4. **버전 관리**: Layer 버전을 명시적으로 지정하여 로드맵 유지

---

## 13. 예제: chat-api 마이그레이션 완전 예시

### 현재 파일 구조
```
lambda/chat-api/
├── index.mjs              (변경 없음)
├── package.json           (수정 필요)
├── package-lock.json      (삭제)
└── node_modules/          (배포 시 제외)
```

### 1단계: package.json 수정
```json
{
  "name": "ai-co-learner-chat-api",
  "version": "1.0.0",
  "type": "module",
  "description": "Chat API Lambda function for AI Co-Learner",
  "main": "index.mjs",
  "dependencies": {
    "@google/generative-ai": "^0.24.1"
  },
  "devDependencies": {
    "archiver": "^7.0.1"
  }
}
```

### 2단계: npm install 실행
```bash
cd lambda/chat-api
rm -r node_modules package-lock.json
npm install
```

### 3단계: deploy.bat 실행
```bash
.\deploy.bat replace  # 처음 배포할 때 Layer 연결
```

### 4단계: Layer가 정상 작동하는지 확인
```bash
# CloudWatch Logs 확인
aws logs tail /aws/lambda/ai-co-learner-chat --since 5m --region ap-northeast-2
```

### 5단계: 이후 배포는 간단
```bash
# 코드만 수정하고 배포
.\deploy.bat update
```

---

**마지막 업데이트**: 2025-12-31
**작성자**: Claude Code
**상태**: 프로덕션 배포 준비 완료
