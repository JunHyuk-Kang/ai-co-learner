#!/usr/bin/env node

/**
 * Admin 권한 관리 스크립트
 *
 * 사용법:
 *   node manage-admin.mjs set <username> <role>     - 역할 변경 (ADMIN/SUPER_USER/USER)
 *   node manage-admin.mjs get <username>            - 현재 역할 확인
 *   node manage-admin.mjs list                      - 모든 관리자 목록
 *   node manage-admin.mjs list-all                  - 모든 사용자 목록
 *
 * 예시:
 *   node manage-admin.mjs set john.doe ADMIN
 *   node manage-admin.mjs get john.doe
 *   node manage-admin.mjs list
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "ap-northeast-2" })
);

const USERS_TABLE = "ai-co-learner-users";
const VALID_ROLES = ["USER", "SUPER_USER", "ADMIN"];

// 색상 코드 (터미널 출력용)
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

// username으로 사용자 찾기
async function findUserByUsername(username) {
  try {
    const result = await dynamoClient.send(new ScanCommand({
      TableName: USERS_TABLE,
      FilterExpression: "username = :username",
      ExpressionAttributeValues: { ":username": username }
    }));

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    return result.Items[0];
  } catch (error) {
    console.error(`${colors.red}❌ 사용자 검색 실패:${colors.reset}`, error.message);
    throw error;
  }
}

// 역할 변경
async function setUserRole(username, newRole) {
  // 역할 유효성 검사
  if (!VALID_ROLES.includes(newRole)) {
    console.error(`${colors.red}❌ 잘못된 역할: ${newRole}${colors.reset}`);
    console.log(`${colors.yellow}📌 사용 가능한 역할: ${VALID_ROLES.join(", ")}${colors.reset}`);
    return;
  }

  // 사용자 찾기
  const user = await findUserByUsername(username);
  if (!user) {
    console.error(`${colors.red}❌ 사용자를 찾을 수 없습니다: ${username}${colors.reset}`);
    return;
  }

  const userId = user.userId;
  const currentRole = user.role || "USER";

  // 이미 같은 역할이면 스킵
  if (currentRole === newRole) {
    console.log(`${colors.yellow}⚠️  ${username}은(는) 이미 ${newRole} 역할입니다.${colors.reset}`);
    return;
  }

  try {
    // 역할 업데이트
    await dynamoClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: "SET #role = :role, updatedAt = :updatedAt",
      ExpressionAttributeNames: { "#role": "role" },
      ExpressionAttributeValues: {
        ":role": newRole,
        ":updatedAt": new Date().toISOString()
      }
    }));

    console.log(`${colors.green}✅ 역할 변경 완료!${colors.reset}`);
    console.log(`${colors.cyan}   사용자: ${user.name} (@${username})${colors.reset}`);
    console.log(`${colors.cyan}   UserId: ${userId}${colors.reset}`);
    console.log(`${colors.yellow}   이전 역할: ${currentRole}${colors.reset}`);
    console.log(`${colors.green}   새 역할: ${newRole}${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}❌ 역할 변경 실패:${colors.reset}`, error.message);
    throw error;
  }
}

// 현재 역할 확인
async function getUserRole(username) {
  const user = await findUserByUsername(username);
  if (!user) {
    console.error(`${colors.red}❌ 사용자를 찾을 수 없습니다: ${username}${colors.reset}`);
    return;
  }

  const role = user.role || "USER";
  const roleColor = role === "ADMIN" ? colors.magenta : role === "SUPER_USER" ? colors.blue : colors.green;

  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}사용자 정보${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`  이름: ${user.name}`);
  console.log(`  아이디: @${user.username}`);
  console.log(`  UserId: ${user.userId}`);
  console.log(`  소속: ${user.organization || "-"}`);
  console.log(`  레벨: Lv.${user.level || 1} (XP: ${user.experience || 0})`);
  console.log(`  역할: ${roleColor}${role}${colors.reset}`);
  console.log(`  가입일: ${user.createdAt || "-"}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
}

// 관리자 목록 조회
async function listAdmins() {
  try {
    const result = await dynamoClient.send(new ScanCommand({
      TableName: USERS_TABLE,
      FilterExpression: "#role = :admin OR #role = :superUser",
      ExpressionAttributeNames: { "#role": "role" },
      ExpressionAttributeValues: {
        ":admin": "ADMIN",
        ":superUser": "SUPER_USER"
      }
    }));

    const admins = result.Items || [];

    if (admins.length === 0) {
      console.log(`${colors.yellow}⚠️  관리자가 없습니다.${colors.reset}`);
      return;
    }

    // 역할별로 정렬 (ADMIN > SUPER_USER)
    admins.sort((a, b) => {
      const roleOrder = { ADMIN: 1, SUPER_USER: 2 };
      return roleOrder[a.role] - roleOrder[b.role];
    });

    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bright}관리자 목록 (총 ${admins.length}명)${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

    admins.forEach((user, index) => {
      const roleColor = user.role === "ADMIN" ? colors.magenta : colors.blue;
      const roleBadge = user.role === "ADMIN" ? "👑" : "⭐";

      console.log(`${colors.bright}${index + 1}.${colors.reset} ${roleBadge} ${user.name} (@${user.username})`);
      console.log(`   역할: ${roleColor}${user.role}${colors.reset}`);
      console.log(`   소속: ${user.organization || "-"}`);
      console.log(`   가입일: ${user.createdAt || "-"}`);
      console.log("");
    });

    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}❌ 관리자 목록 조회 실패:${colors.reset}`, error.message);
    throw error;
  }
}

// 전체 사용자 목록 조회
async function listAllUsers() {
  try {
    const result = await dynamoClient.send(new ScanCommand({
      TableName: USERS_TABLE
    }));

    const users = result.Items || [];

    if (users.length === 0) {
      console.log(`${colors.yellow}⚠️  사용자가 없습니다.${colors.reset}`);
      return;
    }

    // 역할별로 정렬 (ADMIN > SUPER_USER > USER)
    users.sort((a, b) => {
      const roleOrder = { ADMIN: 1, SUPER_USER: 2, USER: 3 };
      const aRole = a.role || "USER";
      const bRole = b.role || "USER";
      return roleOrder[aRole] - roleOrder[bRole];
    });

    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bright}전체 사용자 목록 (총 ${users.length}명)${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

    // 역할별 통계
    const roleCounts = users.reduce((acc, user) => {
      const role = user.role || "USER";
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});

    console.log(`${colors.yellow}📊 역할별 통계:${colors.reset}`);
    console.log(`   ADMIN: ${roleCounts.ADMIN || 0}명 👑`);
    console.log(`   SUPER_USER: ${roleCounts.SUPER_USER || 0}명 ⭐`);
    console.log(`   USER: ${roleCounts.USER || 0}명 👤`);
    console.log("");

    users.forEach((user, index) => {
      const role = user.role || "USER";
      const roleColor =
        role === "ADMIN" ? colors.magenta :
        role === "SUPER_USER" ? colors.blue :
        colors.green;
      const roleBadge =
        role === "ADMIN" ? "👑" :
        role === "SUPER_USER" ? "⭐" :
        "👤";

      console.log(`${colors.bright}${index + 1}.${colors.reset} ${roleBadge} ${user.name} (@${user.username})`);
      console.log(`   역할: ${roleColor}${role}${colors.reset} | 레벨: Lv.${user.level || 1} | 소속: ${user.organization || "-"}`);
    });

    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}❌ 사용자 목록 조회 실패:${colors.reset}`, error.message);
    throw error;
  }
}

// 도움말 출력
function printHelp() {
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}Admin 권한 관리 스크립트${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log("");
  console.log(`${colors.yellow}사용법:${colors.reset}`);
  console.log(`  ${colors.green}node manage-admin.mjs set <username> <role>${colors.reset}`);
  console.log(`    - 사용자 역할 변경 (ADMIN/SUPER_USER/USER)`);
  console.log("");
  console.log(`  ${colors.green}node manage-admin.mjs get <username>${colors.reset}`);
  console.log(`    - 현재 역할 확인`);
  console.log("");
  console.log(`  ${colors.green}node manage-admin.mjs list${colors.reset}`);
  console.log(`    - 모든 관리자 목록 (ADMIN + SUPER_USER)`);
  console.log("");
  console.log(`  ${colors.green}node manage-admin.mjs list-all${colors.reset}`);
  console.log(`    - 전체 사용자 목록 (역할별 통계 포함)`);
  console.log("");
  console.log(`${colors.yellow}예시:${colors.reset}`);
  console.log(`  ${colors.cyan}node manage-admin.mjs set john.doe ADMIN${colors.reset}`);
  console.log(`  ${colors.cyan}node manage-admin.mjs get john.doe${colors.reset}`);
  console.log(`  ${colors.cyan}node manage-admin.mjs list${colors.reset}`);
  console.log(`  ${colors.cyan}node manage-admin.mjs list-all${colors.reset}`);
  console.log("");
  console.log(`${colors.yellow}역할 설명:${colors.reset}`);
  console.log(`  ${colors.magenta}ADMIN${colors.reset}       👑 - 모든 관리 기능 접근 (사용자 관리, 사용량 통계)`);
  console.log(`  ${colors.blue}SUPER_USER${colors.reset}  ⭐ - 봇 템플릿 관리만 가능`);
  console.log(`  ${colors.green}USER${colors.reset}        👤 - 일반 사용자`);
  console.log("");
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
}

// 메인 함수
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case "set":
        if (args.length < 3) {
          console.error(`${colors.red}❌ 사용법: node manage-admin.mjs set <username> <role>${colors.reset}`);
          process.exit(1);
        }
        await setUserRole(args[1], args[2]);
        break;

      case "get":
        if (args.length < 2) {
          console.error(`${colors.red}❌ 사용법: node manage-admin.mjs get <username>${colors.reset}`);
          process.exit(1);
        }
        await getUserRole(args[1]);
        break;

      case "list":
        await listAdmins();
        break;

      case "list-all":
        await listAllUsers();
        break;

      case "help":
      case "--help":
      case "-h":
        printHelp();
        break;

      default:
        console.error(`${colors.red}❌ 알 수 없는 명령어: ${command}${colors.reset}\n`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error(`${colors.red}❌ 오류 발생:${colors.reset}`, error);
    process.exit(1);
  }
}

// 스크립트 실행
main();
