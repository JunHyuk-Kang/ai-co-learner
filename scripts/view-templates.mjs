import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "ap-northeast-2" })
);

async function viewTemplates() {
  try {
    const response = await dynamoClient.send(new ScanCommand({
      TableName: "ai-co-learner-bot-templates"
    }));

    console.log(`\n총 ${response.Items.length}개의 봇 템플릿:\n`);
    console.log("=".repeat(80));

    response.Items.forEach((item, index) => {
      console.log(`\n[${index + 1}] ${item.name}`);
      console.log(`ID: ${item.templateId}`);
      console.log(`설명: ${item.description}`);
      console.log(`테마 색상: ${item.themeColor}`);
      console.log(`\n주요 역량 (Primary):`);
      if (item.primaryCompetencies && item.primaryCompetencies.length > 0) {
        item.primaryCompetencies.forEach(comp => console.log(`  - ${comp}`));
      } else {
        console.log(`  (없음)`);
      }
      console.log(`\n보조 역량 (Secondary):`);
      if (item.secondaryCompetencies && item.secondaryCompetencies.length > 0) {
        item.secondaryCompetencies.forEach(comp => console.log(`  - ${comp}`));
      } else {
        console.log(`  (없음)`);
      }
      console.log(`\n시스템 프롬프트:`);
      console.log(`${item.systemPrompt}`);
      console.log("\n" + "=".repeat(80));
    });

  } catch (error) {
    console.error("Error:", error);
  }
}

viewTemplates();
