# Lambda Layer: Common Dependencies

이 Lambda Layer는 8개의 Lambda 함수에서 공통으로 사용하는 AWS SDK 의존성을 포함합니다.

## 포함된 패키지

- `@aws-sdk/client-dynamodb` - DynamoDB 클라이언트
- `@aws-sdk/lib-dynamodb` - DynamoDB Document Client (고수준 API)
- `@aws-sdk/client-cognito-identity-provider` - Cognito 사용자 관리
- `@aws-sdk/client-lambda` - Lambda 함수 호출

## 설치 및 배포

### Windows 환경

```bash
# 1. 의존성 설치
cd lambda-layers\common-dependencies
call install.bat

# 2. Layer 배포
call deploy.bat
```

### Linux/Mac 환경

```bash
# 1. 의존성 설치
cd lambda-layers/common-dependencies
./install.sh

# 2. Layer 배포
./deploy.sh
```

## Layer 사용하는 Lambda 함수

1. `chat-api` - 채팅 API
2. `message-batch-analyzer` - 메시지 분석
3. `competency-aggregator` - 역량 계산
4. `quest-generator` - 퀘스트 생성
5. `quest-evaluator` - 퀘스트 평가
6. `achievement-evaluator` - 업적 평가
7. `learning-pattern-analyzer` - 학습 패턴 분석
8. `assessment-analyzer` - 진단 분석

## Layer 연결 방법

Layer 배포 후 ARN을 각 Lambda 함수에 연결:

```bash
# ARN 예시
arn:aws:lambda:ap-northeast-2:ACCOUNT_ID:layer:ai-co-learner-common:1

# Lambda 함수에 Layer 연결
aws lambda update-function-configuration \
  --function-name ai-co-learner-chat \
  --layers arn:aws:lambda:ap-northeast-2:ACCOUNT_ID:layer:ai-co-learner-common:1 \
  --region ap-northeast-2
```

## 효과

- ✅ 배포 패키지 크기 50% 감소
- ✅ 배포 속도 향상
- ✅ 의존성 관리 일원화
- ✅ 버전 일관성 보장

## 업데이트 방법

의존성 버전 변경 시:

1. `package.json` 수정
2. `install.bat` 실행
3. `deploy.bat` 실행 (새 버전 생성)
4. 각 Lambda 함수의 Layer 버전 업데이트

## 참고

- Layer는 `/opt/nodejs/node_modules/` 경로에 설치됨
- Lambda 함수에서 `import` 시 경로 변경 불필요
- Layer 최대 크기: 250MB (압축 해제 시)
