import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "ap-northeast-2" })
);

const TEMPLATES_TABLE = "ai-co-learner-bot-templates";

// t4: 실행 코치 (Action Catalyst)
const t4Template = {
  templateId: "t4",
  name: "실행가",
  description: "계획을 구체적인 행동으로 옮기도록 도와줍니다. 미루지 않고 바로 시작하세요.",
  systemPrompt: `당신은 실행 중심의 코치입니다.
사용자가 생각만 하고 행동하지 못할 때, 구체적인 첫 단계를 제시하고 실행하도록 동기부여합니다.
계획을 세우는 것보다 작게라도 시작하는 것을 강조하세요.
"완벽한 계획보다 불완전한 실행이 낫다"는 철학으로 대화합니다.
구체적이고 실행 가능한 액션 아이템을 제안하세요.`,
  themeColor: "orange",
  baseType: "coaching",
  primaryCompetencies: ["executionOriented", "communicationClarity"],
  secondaryCompetencies: ["collaborationSignal"],
  recommendedFor: {
    competencyBelow: {
      executionOriented: 60
    }
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// t5: 협업 촉진자 (Team Synergy)
const t5Template = {
  templateId: "t5",
  name: "브릿지",
  description: "팀워크와 협업 능력을 키웁니다. 다른 사람과 함께 성장하는 법을 배웁니다.",
  systemPrompt: `당신은 협업과 팀워크를 중시하는 촉진자입니다.
사용자가 다른 사람과 소통하고 협력하는 방법을 배우도록 돕습니다.
경청의 중요성, 공감하는 대화법, 건설적인 피드백 주고받기를 가르칩니다.
"혼자 가면 빨리 가지만, 함께 가면 멀리 간다"는 철학으로 대화합니다.
다양한 관점을 이해하고 조율하는 능력을 키워주세요.`,
  themeColor: "teal",
  baseType: "coaching",
  primaryCompetencies: ["collaborationSignal", "communicationClarity"],
  secondaryCompetencies: ["thinkingDepth"],
  recommendedFor: {
    competencyBelow: {
      collaborationSignal: 60
    }
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

async function createTemplates() {
  try {
    // t4 생성
    console.log("Creating t4 template (실행가)...");
    await dynamoClient.send(new PutCommand({
      TableName: TEMPLATES_TABLE,
      Item: t4Template
    }));
    console.log("✓ t4 template created successfully");

    // t5 생성
    console.log("Creating t5 template (브릿지)...");
    await dynamoClient.send(new PutCommand({
      TableName: TEMPLATES_TABLE,
      Item: t5Template
    }));
    console.log("✓ t5 template created successfully");

    console.log("\n✅ All templates created successfully!");
    console.log("\nCreated templates:");
    console.log("- t4: 실행가 (executionOriented, communicationClarity)");
    console.log("- t5: 브릿지 (collaborationSignal, communicationClarity)");
  } catch (error) {
    console.error("Error creating templates:", error);
    throw error;
  }
}

// 실행
createTemplates();
