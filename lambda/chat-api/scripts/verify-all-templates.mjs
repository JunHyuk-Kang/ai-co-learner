import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "ap-northeast-2" })
);

const TEMPLATES_TABLE = "ai-co-learner-bot-templates";

async function verifyTemplates() {
  try {
    const result = await dynamoClient.send(new ScanCommand({
      TableName: TEMPLATES_TABLE
    }));

    const templates = result.Items || [];
    console.log(`\n📊 Total templates: ${templates.length}\n`);

    // 템플릿 ID별로 정렬
    templates.sort((a, b) => a.templateId.localeCompare(b.templateId));

    templates.forEach(template => {
      console.log(`🤖 ${template.templateId}: ${template.name}`);
      if (template.primaryCompetencies) {
        console.log(`   Primary: ${template.primaryCompetencies.join(', ')}`);
      }
      if (template.secondaryCompetencies) {
        console.log(`   Secondary: ${template.secondaryCompetencies.join(', ')}`);
      }
      console.log(`   Description: ${template.description}`);
      console.log('');
    });

    // 역량별 커버리지 확인
    const competencyCoverage = {
      questionQuality: [],
      thinkingDepth: [],
      creativity: [],
      communicationClarity: [],
      executionOriented: [],
      collaborationSignal: []
    };

    templates.forEach(template => {
      if (template.primaryCompetencies) {
        template.primaryCompetencies.forEach(comp => {
          if (competencyCoverage[comp]) {
            competencyCoverage[comp].push(`${template.templateId}(${template.name})`);
          }
        });
      }
    });

    console.log('\n📈 Competency Coverage:');
    Object.entries(competencyCoverage).forEach(([comp, bots]) => {
      const koreanNames = {
        questionQuality: '질문의 질',
        thinkingDepth: '사고의 깊이',
        creativity: '창의성',
        communicationClarity: '소통 명확성',
        executionOriented: '실행 지향성',
        collaborationSignal: '협업 능력'
      };
      console.log(`   ${koreanNames[comp]}: ${bots.length > 0 ? bots.join(', ') : '❌ None'}`);
    });
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

verifyTemplates();
