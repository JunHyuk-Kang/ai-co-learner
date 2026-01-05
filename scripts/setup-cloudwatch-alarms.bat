@echo off
REM CloudWatch 알림 설정 스크립트 (Windows)
REM 사전 요구사항: AWS CLI 설정 완료

echo ========================================
echo CloudWatch 알림 설정 시작
echo ========================================
echo.

REM SNS Topic ARN 입력 요청
set /p SNS_TOPIC_ARN="SNS Topic ARN 입력 (예: arn:aws:sns:ap-northeast-2:123456789012:ai-co-learner-alerts): "

if "%SNS_TOPIC_ARN%"=="" (
    echo [ERROR] SNS Topic ARN이 필요합니다.
    echo.
    echo 먼저 SNS Topic을 생성하세요:
    echo aws sns create-topic --name ai-co-learner-alerts --region ap-northeast-2
    echo.
    echo 이메일 구독 설정:
    echo aws sns subscribe --topic-arn YOUR_ARN --protocol email --notification-endpoint your@email.com
    exit /b 1
)

echo.
echo SNS Topic ARN: %SNS_TOPIC_ARN%
echo.

REM Lambda 함수 목록
set LAMBDA_FUNCTIONS=ai-co-learner-chat,ai-co-learner-message-batch-analyzer,ai-co-learner-competency-aggregator,ai-co-learner-quest-generator,ai-co-learner-quest-evaluator,ai-co-learner-achievement-evaluator,ai-co-learner-learning-pattern-analyzer,ai-co-learner-assessment-analyzer

echo ========================================
echo [1/5] Lambda 에러율 알림 설정
echo ========================================
echo.

for %%F in (%LAMBDA_FUNCTIONS%) do (
    echo %%F - 에러율 알림 생성 중...

    aws cloudwatch put-metric-alarm ^
      --alarm-name %%F-error-rate ^
      --alarm-description "Lambda %%F 에러율 5%% 초과" ^
      --metric-name Errors ^
      --namespace AWS/Lambda ^
      --statistic Average ^
      --period 300 ^
      --threshold 0.05 ^
      --comparison-operator GreaterThanThreshold ^
      --evaluation-periods 1 ^
      --dimensions Name=FunctionName,Value=%%F ^
      --alarm-actions %SNS_TOPIC_ARN% ^
      --region ap-northeast-2

    if !ERRORLEVEL! NEQ 0 (
        echo [WARNING] %%F 알림 생성 실패
    ) else (
        echo [OK] %%F 알림 생성 완료
    )
    echo.
)

echo ========================================
echo [2/5] Lambda 실행 시간 알림 설정
echo ========================================
echo.

for %%F in (%LAMBDA_FUNCTIONS%) do (
    echo %%F - 실행 시간 알림 생성 중...

    aws cloudwatch put-metric-alarm ^
      --alarm-name %%F-duration ^
      --alarm-description "Lambda %%F 실행 시간 50초 초과 (타임아웃 임박)" ^
      --metric-name Duration ^
      --namespace AWS/Lambda ^
      --statistic Maximum ^
      --period 60 ^
      --threshold 50000 ^
      --comparison-operator GreaterThanThreshold ^
      --evaluation-periods 1 ^
      --dimensions Name=FunctionName,Value=%%F ^
      --alarm-actions %SNS_TOPIC_ARN% ^
      --region ap-northeast-2

    if !ERRORLEVEL! NEQ 0 (
        echo [WARNING] %%F 알림 생성 실패
    ) else (
        echo [OK] %%F 알림 생성 완료
    )
    echo.
)

echo ========================================
echo [3/5] Lambda 동시 실행 수 알림 설정
echo ========================================
echo.

aws cloudwatch put-metric-alarm ^
  --alarm-name lambda-concurrent-executions ^
  --alarm-description "Lambda 동시 실행 수 800 초과 (계정 제한 임박)" ^
  --metric-name ConcurrentExecutions ^
  --namespace AWS/Lambda ^
  --statistic Maximum ^
  --period 60 ^
  --threshold 800 ^
  --comparison-operator GreaterThanThreshold ^
  --evaluation-periods 1 ^
  --alarm-actions %SNS_TOPIC_ARN% ^
  --region ap-northeast-2

if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] 동시 실행 수 알림 생성 실패
) else (
    echo [OK] 동시 실행 수 알림 생성 완료
)

echo.
echo ========================================
echo [4/5] DynamoDB 읽기/쓰기 제한 알림 설정
echo ========================================
echo.

REM DynamoDB 테이블 목록
set DYNAMODB_TABLES=ai-co-learner-users,ai-co-learner-user-bots,ai-co-learner-bot-templates,ai-co-learner-chat-sessions,ai-co-learner-learning-analytics,ai-co-learner-user-competencies,ai-co-learner-assessments,ai-co-learner-daily-quests,ai-co-learner-user-achievements,ai-co-learner-usage-tracking

for %%T in (%DYNAMODB_TABLES%) do (
    echo %%T - 읽기 제한 알림 생성 중...

    aws cloudwatch put-metric-alarm ^
      --alarm-name %%T-read-throttle ^
      --alarm-description "DynamoDB %%T 읽기 제한 발생" ^
      --metric-name ReadThrottleEvents ^
      --namespace AWS/DynamoDB ^
      --statistic Sum ^
      --period 60 ^
      --threshold 10 ^
      --comparison-operator GreaterThanThreshold ^
      --evaluation-periods 1 ^
      --dimensions Name=TableName,Value=%%T ^
      --alarm-actions %SNS_TOPIC_ARN% ^
      --region ap-northeast-2

    if !ERRORLEVEL! NEQ 0 (
        echo [WARNING] %%T 읽기 알림 생성 실패
    ) else (
        echo [OK] %%T 읽기 알림 생성 완료
    )
    echo.
)

echo ========================================
echo [5/5] API Gateway 5xx 에러 알림 설정
echo ========================================
echo.

aws cloudwatch put-metric-alarm ^
  --alarm-name api-gateway-5xx-errors ^
  --alarm-description "API Gateway 5xx 에러 10개 이상 (5분)" ^
  --metric-name 5XXError ^
  --namespace AWS/ApiGateway ^
  --statistic Sum ^
  --period 300 ^
  --threshold 10 ^
  --comparison-operator GreaterThanThreshold ^
  --evaluation-periods 1 ^
  --dimensions Name=ApiName,Value=ai-co-learner-api ^
  --alarm-actions %SNS_TOPIC_ARN% ^
  --region ap-northeast-2

if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] API Gateway 알림 생성 실패
) else (
    echo [OK] API Gateway 알림 생성 완료
)

echo.
echo ========================================
echo CloudWatch 알림 설정 완료!
echo ========================================
echo.
echo 생성된 알림 확인:
echo aws cloudwatch describe-alarms --region ap-northeast-2
echo.
echo SNS 이메일 구독 확인 메일을 확인하세요.
echo.
