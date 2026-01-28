/**
 * 마이그레이션 스크립트: 기존 봇 템플릿에 organizationId 필드 추가
 *
 * 사용법:
 *   node scripts/migrate-templates-add-org.mjs
 *
 * 사전 조건:
 *   - AWS CLI 자격 증명이 설정되어 있어야 함
 *   - ap-northeast-2 리전의 ai-co-learner-bot-templates 테이블에 접근 가능해야 함
 *
 * GSI 생성 (별도 실행 필요):
 *   aws dynamodb update-table ^
 *     --table-name ai-co-learner-bot-templates ^
 *     --attribute-definitions AttributeName=organizationId,AttributeType=S ^
 *     --global-secondary-index-updates "[{\"Create\":{\"IndexName\":\"organizationId-templateId-index\",\"KeySchema\":[{\"AttributeName\":\"organizationId\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"templateId\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}}]" ^
 *     --region ap-northeast-2
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const REGION = "ap-northeast-2";
const TEMPLATES_TABLE = "ai-co-learner-bot-templates";

const client = new DynamoDBClient({ region: REGION });
const dynamoClient = DynamoDBDocumentClient.from(client);

async function migrate() {
  console.log("=== 봇 템플릿 organizationId 마이그레이션 시작 ===\n");

  // 1. 기존 템플릿 전체 조회
  const response = await dynamoClient.send(
    new ScanCommand({
      TableName: TEMPLATES_TABLE,
    })
  );

  const templates = response.Items || [];
  console.log(`총 ${templates.length}개 템플릿 발견\n`);

  let updated = 0;
  let skipped = 0;

  for (const template of templates) {
    if (template.organizationId) {
      console.log(
        `  [SKIP] ${template.name} (templateId: ${template.templateId}) - 이미 organizationId="${template.organizationId}" 설정됨`
      );
      skipped++;
      continue;
    }

    // 2. organizationId: "GLOBAL" 추가
    await dynamoClient.send(
      new UpdateCommand({
        TableName: TEMPLATES_TABLE,
        Key: { templateId: template.templateId },
        UpdateExpression:
          "SET organizationId = :orgId, updatedAt = :now",
        ExpressionAttributeValues: {
          ":orgId": "GLOBAL",
          ":now": new Date().toISOString(),
        },
      })
    );

    console.log(
      `  [UPDATE] ${template.name} (templateId: ${template.templateId}) -> organizationId="GLOBAL"`
    );
    updated++;
  }

  console.log(`\n=== 마이그레이션 완료 ===`);
  console.log(`  업데이트: ${updated}개`);
  console.log(`  스킵: ${skipped}개`);
  console.log(`  전체: ${templates.length}개\n`);

  console.log("다음 단계: GSI 생성이 필요합니다.");
  console.log(
    "  Index Name: organizationId-templateId-index"
  );
  console.log(
    "  PK: organizationId (String), SK: templateId (String)"
  );
  console.log("  Projection: ALL");
}

migrate().catch((error) => {
  console.error("마이그레이션 실패:", error);
  process.exit(1);
});
