@echo off
REM SNS Topic 및 이메일 구독 설정 스크립트 (Windows)

echo ========================================
echo SNS Topic 생성 및 이메일 구독 설정
echo ========================================
echo.

REM 이메일 주소 입력
set /p EMAIL="알림을 받을 이메일 주소: "

if "%EMAIL%"=="" (
    echo [ERROR] 이메일 주소가 필요합니다.
    exit /b 1
)

echo.
echo [1/3] SNS Topic 생성 중...
echo.

REM SNS Topic 생성
aws sns create-topic ^
  --name ai-co-learner-alerts ^
  --region ap-northeast-2 ^
  --output json > sns-topic.json

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] SNS Topic 생성 실패
    exit /b 1
)

REM Topic ARN 추출 (PowerShell 사용)
for /f "delims=" %%A in ('powershell -Command "(Get-Content sns-topic.json | ConvertFrom-Json).TopicArn"') do set TOPIC_ARN=%%A

echo [OK] SNS Topic 생성 완료
echo Topic ARN: %TOPIC_ARN%

echo.
echo [2/3] 이메일 구독 설정 중...
echo.

REM 이메일 구독
aws sns subscribe ^
  --topic-arn %TOPIC_ARN% ^
  --protocol email ^
  --notification-endpoint %EMAIL% ^
  --region ap-northeast-2

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] 이메일 구독 실패
    del sns-topic.json
    exit /b 1
)

echo [OK] 이메일 구독 요청 완료

echo.
echo [3/3] Topic ARN 저장 중...
echo.

REM Topic ARN을 파일로 저장
echo %TOPIC_ARN% > sns-topic-arn.txt

echo [OK] Topic ARN 저장 완료: sns-topic-arn.txt

echo.
echo ========================================
echo SNS 설정 완료!
echo ========================================
echo.
echo ** 중요 **
echo %EMAIL% 으로 전송된 확인 메일을 확인하고
echo "Confirm subscription" 링크를 클릭하세요.
echo.
echo 구독 확인 후:
echo 1. setup-cloudwatch-alarms.bat 실행
echo 2. SNS Topic ARN: %TOPIC_ARN%
echo.

REM 임시 파일 삭제
del sns-topic.json

echo Topic ARN이 sns-topic-arn.txt에 저장되었습니다.
echo.
