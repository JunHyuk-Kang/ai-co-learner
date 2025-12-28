import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const REGION = "ap-northeast-2";
const USER_POOL_ID = "ap-northeast-2_OCntQ228q";

const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function createTestAccount(index, total) {
  const email = `test${index}@test.com`;
  const password = "Test123!";
  const organization = "어정중학교";
  const name = `테스트${index}`;

  try {
    console.log(`[${index}/${total}] Creating account: ${email}`);

    // 1. Cognito 사용자 생성
    const createUserCommand = new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "email_verified", Value: "true" },
        { Name: "name", Value: name }
      ],
      MessageAction: "SUPPRESS" // 이메일 발송 억제
    });

    const createResult = await cognitoClient.send(createUserCommand);
    const userId = createResult.User.Username;

    // 2. 비밀번호 설정 (영구 비밀번호로)
    const setPasswordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      Password: password,
      Permanent: true
    });

    await cognitoClient.send(setPasswordCommand);

    // 3. DynamoDB에 사용자 정보 저장
    const putCommand = new PutCommand({
      TableName: "ai-co-learner-users",
      Item: {
        userId: userId,
        email: email,
        name: name,
        organization: organization,
        createdAt: new Date().toISOString(),
        role: "student",
        competencies: {
          questionQuality: 0,
          thinkingDepth: 0,
          creativity: 0,
          communicationClarity: 0,
          executionOriented: 0,
          collaborationSignal: 0
        }
      }
    });

    await docClient.send(putCommand);

    console.log(`✅ [${index}/${total}] Successfully created: ${email}`);
    return { success: true, email, userId };

  } catch (error) {
    console.error(`❌ [${index}/${total}] Failed to create ${email}:`, error.message);
    return { success: false, email, error: error.message };
  }
}

async function createAllAccounts() {
  console.log("🚀 Starting test account creation...\n");

  const START_INDEX = 121;
  const END_INDEX = 130;
  const TOTAL_COUNT = END_INDEX - START_INDEX + 1;

  const results = {
    total: TOTAL_COUNT,
    success: 0,
    failed: 0,
    errors: []
  };

  // 동시 실행을 방지하기 위해 순차 실행 (Rate limit 방지)
  for (let i = START_INDEX; i <= END_INDEX; i++) {
    const result = await createTestAccount(i, END_INDEX);

    if (result.success) {
      results.success++;
    } else {
      results.failed++;
      results.errors.push(result);
    }

    // Rate limit 방지를 위한 딜레이 (200ms)
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log("\n📊 Creation Summary:");
  console.log(`Total: ${results.total}`);
  console.log(`✅ Success: ${results.success}`);
  console.log(`❌ Failed: ${results.failed}`);

  if (results.errors.length > 0) {
    console.log("\n❌ Failed accounts:");
    results.errors.forEach(err => {
      console.log(`  - ${err.email}: ${err.error}`);
    });
  }
}

// 실행
createAllAccounts().catch(console.error);
