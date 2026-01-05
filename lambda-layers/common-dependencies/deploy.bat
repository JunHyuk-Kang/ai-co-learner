@echo off
REM Lambda Layer 배포 스크립트 (Windows)
REM AWS CLI 필요

echo ========================================
echo Lambda Layer 배포 시작
echo ========================================

REM nodejs 디렉토리 확인
if not exist nodejs (
    echo [ERROR] nodejs 디렉토리가 없습니다.
    echo install.bat를 먼저 실행하세요.
    exit /b 1
)

REM ZIP 파일 생성 (PowerShell 사용)
echo.
echo [1/3] ZIP 파일 생성 중...

if exist common-dependencies.zip del common-dependencies.zip

powershell -Command "Compress-Archive -Path nodejs -DestinationPath common-dependencies.zip -Force"

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] ZIP 생성 실패
    exit /b 1
)

echo ZIP 생성 완료: common-dependencies.zip

REM ZIP 파일 크기 확인
for %%A in (common-dependencies.zip) do echo 파일 크기: %%~zA bytes

REM AWS Lambda Layer 배포
echo.
echo [2/3] AWS Lambda Layer 배포 중...
echo.

aws lambda publish-layer-version ^
  --layer-name ai-co-learner-common ^
  --description "Common AWS SDK dependencies for AI Co-Learner" ^
  --zip-file fileb://common-dependencies.zip ^
  --compatible-runtimes nodejs20.x ^
  --region ap-northeast-2

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Layer 배포 실패
    echo AWS CLI 설정을 확인하세요.
    exit /b 1
)

echo.
echo [3/3] Layer 배포 완료!

echo.
echo ========================================
echo 다음 단계: Lambda 함수에 Layer 연결
echo ========================================
echo.
echo 예시 명령어:
echo aws lambda update-function-configuration \
echo   --function-name ai-co-learner-chat \
echo   --layers arn:aws:lambda:ap-northeast-2:ACCOUNT_ID:layer:ai-co-learner-common:VERSION \
echo   --region ap-northeast-2
echo.
echo Layer ARN은 위 출력의 "LayerVersionArn"을 사용하세요.
echo.
