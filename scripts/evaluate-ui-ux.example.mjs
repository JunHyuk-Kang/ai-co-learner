/**
 * AI Co-Learner Dashboard UI/UX 평가 스크립트
 * Google Gemini 2.5 Flash를 사용하여 메인페이지의 UI/UX를 전문적으로 평가합니다.
 *
 * Usage:
 *   node scripts/evaluate-ui-ux.mjs
 *
 * Environment Variables Required:
 *   GEMINI_API_KEY - Google Gemini API 키
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 환경 변수 확인
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("❌ Error: GEMINI_API_KEY environment variable is required");
  console.log("\n💡 Setup instructions:");
  console.log("  1. Copy .env.example to .env.local");
  console.log("  2. Set GEMINI_API_KEY in .env.local");
  console.log("  3. Run: node scripts/evaluate-ui-ux.mjs");
  process.exit(1);
}

// Gemini API 초기화
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// 파일 읽기
const dashboardCode = fs.readFileSync(
  path.join(__dirname, '../src/pages/Dashboard.tsx'),
  'utf-8'
);
const uiGuide = fs.readFileSync(
  path.join(__dirname, '../docs/ui-ux-guide.md'),
  'utf-8'
);

const prompt = `
당신은 10년 경력의 UX/UI 전문가입니다. 아래 정보를 바탕으로 AI Co-Learner 플랫폼의 메인 대시보드 페이지를 **UI/UX 관점에서 전문적으로 평가**해주세요.

## 제공 자료

### 1. UI/UX 디자인 가이드
\`\`\`markdown
${uiGuide}
\`\`\`

### 2. Dashboard 페이지 코드 (React + TypeScript)
\`\`\`typescript
${dashboardCode}
\`\`\`

---

## 평가 요청사항

다음 기준에 따라 **상세하게** 평가해주세요:

### 1. 정보 아키텍처 (Information Architecture)
- 레이아웃 구조 (2컬럼 그리드)의 적절성
- 콘텐츠 우선순위 배치
- 시각적 계층 (Visual Hierarchy)
- 정보 그룹핑 및 카테고리화

### 2. 사용성 (Usability)
- 주요 과업(AI 봇 선택, 역량 확인, 퀘스트 체크) 수행의 용이성
- 네비게이션 및 인터랙션 흐름
- 에러 처리 및 피드백 (로딩 상태, 빈 상태)
- 학습 곡선 (신규 사용자가 이해하기 쉬운가?)

### 3. 타겟 사용자 적합성
- 청소년(13-18세) 60%, 대학생(19-25세) 30%, 직장인 10%
- 청소년 사용자를 위한 게이미피케이션 요소 (배지, 레벨, 추천 봇)
- 직관성 및 즉각적 피드백
- 긍정적 강화 요소

### 4. 시각 디자인 (Visual Design)
- 다크 테마 (#121212 배경) 적용 적절성
- 색상 대비 및 가독성
- 타이포그래피 (폰트 크기, 굵기, 간격)
- 아이콘 활용 (lucide-react)
- 공백(Whitespace) 활용

### 5. 인터랙션 디자인
- 버튼 및 CTA (Call-to-Action) 명확성
- 호버 효과, 트랜지션
- 모달 디자인 (봇 생성, 빠른 생성)
- 삭제 확인 다이얼로그

### 6. 반응형 디자인
- 모바일/태블릿/데스크톱 대응
- Grid 시스템 (lg:col-span-4 / lg:col-span-8)
- 터치 타겟 크기 (44x44px 이상)

### 7. 접근성 (Accessibility)
- 키보드 네비게이션 가능성
- 스크린 리더 지원 (ARIA 라벨)
- 색상 대비 (WCAG 2.1 AA 기준)

### 8. 개선 제안 (최소 5개 이상)
- 구체적인 개선 방안 및 이유
- 우선순위 표시 (상/중/하)
- 코드 예시 제공 (가능한 경우)

---

## 출력 형식

다음 형식으로 **한글**로 작성해주세요:

# AI Co-Learner Dashboard UI/UX 평가 보고서

## 요약 (Executive Summary)
- 전체 점수: X/100
- 주요 강점 (3가지)
- 주요 개선점 (3가지)

## 1. 정보 아키텍처
[평가 내용]

## 2. 사용성
[평가 내용]

## 3. 타겟 사용자 적합성
[평가 내용]

## 4. 시각 디자인
[평가 내용]

## 5. 인터랙션 디자인
[평가 내용]

## 6. 반응형 디자인
[평가 내용]

## 7. 접근성
[평가 내용]

## 8. 개선 제안
### [우선순위: 상] 제목
- 현재 상태:
- 문제점:
- 개선 방안:
- 기대 효과:

(5개 이상)

## 결론
[종합 평가 및 향후 방향성]

---

**전문적이고 객관적인 평가를 부탁드립니다. 칭찬과 비판을 균형있게 제공해주세요.**
`;

console.log('🤖 Gemini AI에게 UI/UX 평가 요청 중...\n');
console.log('─'.repeat(80));

try {
  const result = await model.generateContent(prompt);
  const response = result.response;
  const evaluation = response.text();

  console.log(evaluation);
  console.log('\n' + '─'.repeat(80));

  // 결과를 파일로 저장
  const outputPath = path.join(__dirname, '../docs/ui-ux-evaluation.md');
  fs.writeFileSync(
    outputPath,
    `# AI Co-Learner Dashboard UI/UX 평가 보고서

**평가일**: ${new Date().toISOString().split('T')[0]}
**평가자**: Google Gemini 2.5 Flash
**대상**: Dashboard 페이지 (src/pages/Dashboard.tsx)

---

${evaluation}

---

**자동 생성 보고서**: scripts/evaluate-ui-ux.mjs
`,
    'utf-8'
  );

  console.log(`\n✅ 평가 결과가 저장되었습니다: ${outputPath}`);
} catch (error) {
  console.error('❌ 평가 중 오류 발생:', error.message);
  process.exit(1);
}
