@echo off
echo Deploying achievement-evaluator Lambda function...

echo Step 1: Creating deployment package...
powershell "Remove-Item -Path function.zip -ErrorAction SilentlyContinue; Compress-Archive -Path index.mjs,package.json,node_modules -DestinationPath function.zip -Force"

echo Step 2: Uploading to AWS Lambda...
aws lambda update-function-code --function-name ai-co-learner-achievement-evaluator --zip-file fileb://function.zip --region ap-northeast-2

echo Step 3: Waiting for update to complete...
timeout /t 5

echo Step 4: Checking function status...
aws lambda get-function --function-name ai-co-learner-achievement-evaluator --region ap-northeast-2 --query "Configuration.LastUpdateStatus"

echo.
echo Deployment complete!
