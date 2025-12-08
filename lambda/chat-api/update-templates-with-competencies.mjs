import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "ap-northeast-2" })
);

const TEMPLATES_TABLE = "ai-co-learner-bot-templates";

// 각 봇의 역량 매핑 정의
const templateCompetencies = {
  "t1": { // 소크라테스 (질문하는 현자)
    primaryCompetencies: ["questionQuality", "thinkingDepth"],
    secondaryCompetencies: ["communicationClarity"],
    recommendedFor: {
      competencyBelow: {
        questionQuality: 60,
        thinkingDepth: 60
      }
    }
  },
  "t2": { // 헤겔 (논리적 사색가)
    primaryCompetencies: ["thinkingDepth", "communicationClarity"],
    secondaryCompetencies: ["questionQuality"],
    recommendedFor: {
      competencyBelow: {
        thinkingDepth: 60,
        communicationClarity: 60
      }
    }
  },
  "t3": { // 다빈치 (창의적 멘토)
    primaryCompetencies: ["creativity", "thinkingDepth"],
    secondaryCompetencies: ["executionOriented"],
    recommendedFor: {
      competencyBelow: {
        creativity: 60
      }
    }
  },
  "t4": { // 실행 코치
    primaryCompetencies: ["executionOriented", "communicationClarity"],
    secondaryCompetencies: ["collaborationSignal"],
    recommendedFor: {
      competencyBelow: {
        executionOriented: 60
      }
    }
  },
  "t5": { // 협업 촉진자
    primaryCompetencies: ["collaborationSignal", "communicationClarity"],
    secondaryCompetencies: ["thinkingDepth"],
    recommendedFor: {
      competencyBelow: {
        collaborationSignal: 60
      }
    }
  }
};

async function updateTemplates() {
  try {
    // 1. 모든 템플릿 조회
    console.log("Fetching all templates...");
    const scanResult = await dynamoClient.send(new ScanCommand({
      TableName: TEMPLATES_TABLE
    }));

    const templates = scanResult.Items || [];
    console.log(`Found ${templates.length} templates`);

    // 2. 각 템플릿에 역량 데이터 추가
    for (const template of templates) {
      const templateId = template.templateId;
      const competencyData = templateCompetencies[templateId];

      if (!competencyData) {
        console.log(`No competency data for template ${templateId}, skipping...`);
        continue;
      }

      console.log(`Updating template ${templateId} (${template.name})...`);

      await dynamoClient.send(new UpdateCommand({
        TableName: TEMPLATES_TABLE,
        Key: { templateId },
        UpdateExpression: "SET primaryCompetencies = :primary, secondaryCompetencies = :secondary, recommendedFor = :recommended, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":primary": competencyData.primaryCompetencies,
          ":secondary": competencyData.secondaryCompetencies,
          ":recommended": competencyData.recommendedFor,
          ":updatedAt": new Date().toISOString()
        }
      }));

      console.log(`✓ Updated ${templateId}`);
    }

    console.log("\n✅ All templates updated successfully!");
  } catch (error) {
    console.error("Error updating templates:", error);
    throw error;
  }
}

// 실행
updateTemplates();
