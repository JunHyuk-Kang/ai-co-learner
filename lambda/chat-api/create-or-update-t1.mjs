import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "ap-northeast-2" })
);

const TEMPLATES_TABLE = "ai-co-learner-bot-templates";

// t1: 소크라테스 (질문하는 현자)
const t1Data = {
  primaryCompetencies: ["questionQuality", "thinkingDepth"],
  secondaryCompetencies: ["communicationClarity"],
  recommendedFor: {
    competencyBelow: {
      questionQuality: 60,
      thinkingDepth: 60
    }
  }
};

const t1FullTemplate = {
  templateId: "t1",
  name: "소크라테스",
  description: "질문으로 생각을 깊게 만듭니다. 답을 주지 않고 스스로 답을 찾게 합니다.",
  systemPrompt: `당신은 고대 그리스의 철학자 소크라테스입니다.
직접적인 답을 주지 않고, 끊임없는 질문을 통해 사용자가 스스로 생각하도록 유도합니다.
"왜 그렇게 생각하나요?", "그것이 정말 사실인가요?", "다른 가능성은 없나요?" 같은 질문을 던지세요.
사용자의 가정을 검증하고, 모순을 발견하게 하며, 더 깊은 이해에 도달하도록 안내합니다.
겸손하고 호기심 어린 태도로 대화하세요.`,
  themeColor: "blue",
  baseType: "debating",
  ...t1Data,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

async function createOrUpdateT1() {
  try {
    // t1이 존재하는지 확인
    console.log("Checking if t1 exists...");
    const getResult = await dynamoClient.send(new GetCommand({
      TableName: TEMPLATES_TABLE,
      Key: { templateId: "t1" }
    }));

    if (getResult.Item) {
      // 존재하면 업데이트
      console.log("t1 exists, updating with competency data...");
      await dynamoClient.send(new UpdateCommand({
        TableName: TEMPLATES_TABLE,
        Key: { templateId: "t1" },
        UpdateExpression: "SET primaryCompetencies = :primary, secondaryCompetencies = :secondary, recommendedFor = :recommended, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":primary": t1Data.primaryCompetencies,
          ":secondary": t1Data.secondaryCompetencies,
          ":recommended": t1Data.recommendedFor,
          ":updatedAt": new Date().toISOString()
        }
      }));
      console.log("✓ t1 updated successfully");
    } else {
      // 존재하지 않으면 생성
      console.log("t1 does not exist, creating new template...");
      await dynamoClient.send(new PutCommand({
        TableName: TEMPLATES_TABLE,
        Item: t1FullTemplate
      }));
      console.log("✓ t1 created successfully");
    }

    console.log("\n✅ t1 (소크라테스) is ready!");
    console.log("Primary: questionQuality, thinkingDepth");
    console.log("Secondary: communicationClarity");
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

createOrUpdateT1();
