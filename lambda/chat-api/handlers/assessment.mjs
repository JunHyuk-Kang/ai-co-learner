import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "../lib/clients.mjs";
import { TABLES } from "../lib/config.mjs";

// ============================================================
// SJT (Situational Judgment Test) 기반 역량 평가 20문항
// ============================================================
// 각 문항: 구체적 상황 제시 → 4개 선택지 (각각 다른 역량 성향 반영)
// 정답 없음 → 선택 패턴으로 역량 프로파일 도출
// 선택지 순서는 매번 랜덤 셔플
// ============================================================

const ASSESSMENT_QUESTIONS = [
  // Q1: competencies = Q, T, C, Co
  {
    id: "q1",
    question: "학습 모임에서 어려운 주제를 발표해야 합니다. 일주일의 준비 시간이 있을 때, 가장 먼저 무엇을 하겠습니까?",
    options: [
      { text: "'이 주제의 핵심이 뭘까?' 스스로에게 질문 목록부터 만든다", primaryCompetency: "questionQuality", secondaryCompetency: "thinkingDepth" },
      { text: "관련 자료를 깊이 분석하여 주제의 본질을 파악한다", primaryCompetency: "thinkingDepth", secondaryCompetency: "questionQuality" },
      { text: "독창적이고 흥미로운 발표 구성을 먼저 구상한다", primaryCompetency: "creativity", secondaryCompetency: "communicationClarity" },
      { text: "청중이 쉽게 이해할 수 있는 설명 흐름을 설계한다", primaryCompetency: "communicationClarity", secondaryCompetency: "creativity" }
    ]
  },
  // Q2: competencies = Q, T, C, E
  {
    id: "q2",
    question: "전혀 모르는 새로운 분야를 학습해야 합니다. 어떻게 시작하겠습니까?",
    options: [
      { text: "'이 분야에서 가장 중요한 질문은 무엇일까?' 핵심 질문부터 찾는다", primaryCompetency: "questionQuality", secondaryCompetency: "thinkingDepth" },
      { text: "전체 구조를 파악하고 개념 간 관계를 분석한다", primaryCompetency: "thinkingDepth", secondaryCompetency: "questionQuality" },
      { text: "기존에 알던 분야와 연결점을 찾아 새로운 관점으로 접근한다", primaryCompetency: "creativity", secondaryCompetency: "thinkingDepth" },
      { text: "작은 프로젝트를 직접 시작하면서 실전으로 배운다", primaryCompetency: "executionOriented", secondaryCompetency: "creativity" }
    ]
  },
  // Q3: competencies = Q, T, C, Cl
  {
    id: "q3",
    question: "팀에서 브레인스토밍 중 나온 아이디어가 현실성이 부족해 보입니다. 어떻게 하겠습니까?",
    options: [
      { text: "'이 아이디어가 해결하려는 진짜 문제는 무엇인가?' 근본 질문을 던진다", primaryCompetency: "questionQuality", secondaryCompetency: "thinkingDepth" },
      { text: "아이디어의 전제와 가정을 하나씩 논리적으로 검증한다", primaryCompetency: "thinkingDepth", secondaryCompetency: "questionQuality" },
      { text: "원래 아이디어에서 영감을 받아 전혀 다른 방향을 제안한다", primaryCompetency: "creativity", secondaryCompetency: "collaborationSignal" },
      { text: "팀원들과 함께 아이디어를 수정·보완하는 방향으로 논의한다", primaryCompetency: "collaborationSignal", secondaryCompetency: "creativity" }
    ]
  },
  // Q4: competencies = Q, T, Co, E
  {
    id: "q4",
    question: "중요한 결정을 내려야 하는데 관련 정보가 너무 많아 혼란스럽습니다. 어떻게 하겠습니까?",
    options: [
      { text: "'이 결정에서 가장 중요한 기준은?' 핵심 질문으로 정보를 걸러낸다", primaryCompetency: "questionQuality", secondaryCompetency: "thinkingDepth" },
      { text: "정보를 카테고리별로 분류하고 우선순위를 매겨 체계적으로 정리한다", primaryCompetency: "thinkingDepth", secondaryCompetency: "executionOriented" },
      { text: "핵심만 간추려 한 페이지로 명확하게 요약한다", primaryCompetency: "communicationClarity", secondaryCompetency: "thinkingDepth" },
      { text: "핵심 정보만 빠르게 파악하고 일단 결정 후 수정해나간다", primaryCompetency: "executionOriented", secondaryCompetency: "communicationClarity" }
    ]
  },
  // Q5: competencies = Q, T, Co, Cl
  {
    id: "q5",
    question: "발표 후 여러 가지 피드백을 받았습니다. 어떻게 처리하겠습니까?",
    options: [
      { text: "'피드백의 핵심 메시지는 무엇인가?' 질문으로 본질을 파악한다", primaryCompetency: "questionQuality", secondaryCompetency: "thinkingDepth" },
      { text: "피드백들의 패턴을 분석해서 근본적인 개선점을 찾는다", primaryCompetency: "thinkingDepth", secondaryCompetency: "questionQuality" },
      { text: "피드백을 반영해 내용을 더 명확하고 체계적으로 재구성한다", primaryCompetency: "communicationClarity", secondaryCompetency: "executionOriented" },
      { text: "피드백을 준 사람들과 대화하며 구체적인 개선 방향을 함께 논의한다", primaryCompetency: "collaborationSignal", secondaryCompetency: "communicationClarity" }
    ]
  },
  // Q6: competencies = Q, T, E, Cl
  {
    id: "q6",
    question: "열심히 준비한 프로젝트가 기대한 결과를 내지 못했습니다. 어떻게 대응하겠습니까?",
    options: [
      { text: "'무엇이 잘못되었을까?' 원인에 대한 질문 목록을 작성한다", primaryCompetency: "questionQuality", secondaryCompetency: "executionOriented" },
      { text: "과정 전체를 단계별로 복기하며 근본 원인을 분석한다", primaryCompetency: "thinkingDepth", secondaryCompetency: "executionOriented" },
      { text: "배운 교훈을 정리하고 바로 개선된 새 계획을 실행한다", primaryCompetency: "executionOriented", secondaryCompetency: "thinkingDepth" },
      { text: "팀원들과 회고를 진행하여 함께 개선점을 도출한다", primaryCompetency: "collaborationSignal", secondaryCompetency: "questionQuality" }
    ]
  },
  // Q7: competencies = Q, C, Co, E
  {
    id: "q7",
    question: "반복적인 업무를 더 효율적으로 개선할 방법을 찾아야 합니다. 어떻게 접근하겠습니까?",
    options: [
      { text: "'왜 이 방식으로 하고 있었지?' 기존 방식의 전제를 의심해본다", primaryCompetency: "questionQuality", secondaryCompetency: "creativity" },
      { text: "전혀 다른 분야에서 영감을 얻어 새로운 방법을 고안한다", primaryCompetency: "creativity", secondaryCompetency: "executionOriented" },
      { text: "개선 과정과 결과를 팀이 이해할 수 있도록 문서화한다", primaryCompetency: "communicationClarity", secondaryCompetency: "executionOriented" },
      { text: "기존 방식과 새 방식을 직접 비교 실험해본다", primaryCompetency: "executionOriented", secondaryCompetency: "creativity" }
    ]
  },
  // Q8: competencies = Q, C, Co, Cl
  {
    id: "q8",
    question: "스터디 그룹에서 한 팀원이 개념을 이해하지 못하고 있습니다. 어떻게 도울 것인가요?",
    options: [
      { text: "'정확히 어디서부터 헷갈리는지' 구체적으로 질문한다", primaryCompetency: "questionQuality", secondaryCompetency: "collaborationSignal" },
      { text: "다른 분야의 비유를 창의적으로 활용해서 설명한다", primaryCompetency: "creativity", secondaryCompetency: "communicationClarity" },
      { text: "일상적인 예시를 들어 단계적으로 쉽게 풀어 설명한다", primaryCompetency: "communicationClarity", secondaryCompetency: "creativity" },
      { text: "다른 팀원들도 합류시켜 함께 토론하며 이해를 높인다", primaryCompetency: "collaborationSignal", secondaryCompetency: "communicationClarity" }
    ]
  },
  // Q9: competencies = Q, C, E, Cl
  {
    id: "q9",
    question: "지금까지 해본 적 없는 완전히 새로운 유형의 과제를 받았습니다. 어떻게 시작하겠습니까?",
    options: [
      { text: "'이 과제에서 진짜 요구하는 것은 무엇인가?' 핵심 질문부터 정리한다", primaryCompetency: "questionQuality", secondaryCompetency: "executionOriented" },
      { text: "기존의 틀을 벗어나 독창적인 접근법을 탐색한다", primaryCompetency: "creativity", secondaryCompetency: "questionQuality" },
      { text: "일단 작게라도 시작해서 빠르게 시행착오를 겪으며 배운다", primaryCompetency: "executionOriented", secondaryCompetency: "creativity" },
      { text: "비슷한 경험이 있는 사람을 찾아 조언을 구한다", primaryCompetency: "collaborationSignal", secondaryCompetency: "executionOriented" }
    ]
  },
  // Q10: competencies = Q, Co, E, Cl
  {
    id: "q10",
    question: "마감이 임박했는데 할 일이 아직 많이 남았습니다. 어떻게 하겠습니까?",
    options: [
      { text: "'반드시 해야 할 것과 선택적인 것은?' 우선순위를 질문으로 정리한다", primaryCompetency: "questionQuality", secondaryCompetency: "executionOriented" },
      { text: "상황을 명확하게 정리해서 관계자들에게 공유한다", primaryCompetency: "communicationClarity", secondaryCompetency: "collaborationSignal" },
      { text: "가장 중요한 것부터 즉시 실행하고 완성도를 높여간다", primaryCompetency: "executionOriented", secondaryCompetency: "communicationClarity" },
      { text: "팀원들에게 상황을 공유하고 도움을 요청하거나 역할을 재분배한다", primaryCompetency: "collaborationSignal", secondaryCompetency: "executionOriented" }
    ]
  },
  // Q11: competencies = T, C, Co, E
  {
    id: "q11",
    question: "복잡한 주제를 잘 모르는 사람에게 설명해야 합니다. 어떻게 하겠습니까?",
    options: [
      { text: "핵심 원리를 깊이 이해한 후 가장 본질적인 설명을 찾는다", primaryCompetency: "thinkingDepth", secondaryCompetency: "communicationClarity" },
      { text: "비유나 스토리텔링 등 참신한 방식으로 전달한다", primaryCompetency: "creativity", secondaryCompetency: "communicationClarity" },
      { text: "상대의 수준에 맞춰 논리적 순서로 차근차근 설명한다", primaryCompetency: "communicationClarity", secondaryCompetency: "thinkingDepth" },
      { text: "간단한 실습이나 데모를 준비해서 직접 체험하게 한다", primaryCompetency: "executionOriented", secondaryCompetency: "communicationClarity" }
    ]
  },
  // Q12: competencies = T, C, Co, Cl
  {
    id: "q12",
    question: "팀 프로젝트에서 당신과 팀원의 접근 방식이 완전히 다릅니다. 어떻게 하겠습니까?",
    options: [
      { text: "두 방식의 장단점을 객관적 기준으로 분석해서 비교한다", primaryCompetency: "thinkingDepth", secondaryCompetency: "communicationClarity" },
      { text: "두 방식을 결합한 새로운 대안을 제안한다", primaryCompetency: "creativity", secondaryCompetency: "collaborationSignal" },
      { text: "각자의 논리를 명확하게 설명하고 공통점을 찾는다", primaryCompetency: "communicationClarity", secondaryCompetency: "collaborationSignal" },
      { text: "서로의 입장을 충분히 듣고 팀 전체와 함께 결정한다", primaryCompetency: "collaborationSignal", secondaryCompetency: "communicationClarity" }
    ]
  },
  // Q13: competencies = T, C, E, Cl
  {
    id: "q13",
    question: "검증되지 않은 새로운 방법이 기존보다 나을 것 같다는 직감이 듭니다. 어떻게 하겠습니까?",
    options: [
      { text: "기존 방법과 새 방법의 차이를 논리적으로 분석한다", primaryCompetency: "thinkingDepth", secondaryCompetency: "executionOriented" },
      { text: "관련된 전혀 다른 접근법도 함께 탐색해본다", primaryCompetency: "creativity", secondaryCompetency: "thinkingDepth" },
      { text: "작은 규모로 빠르게 실험해보고 결과를 확인한다", primaryCompetency: "executionOriented", secondaryCompetency: "creativity" },
      { text: "팀원들과 의견을 나누어 다양한 시각에서 검토한다", primaryCompetency: "collaborationSignal", secondaryCompetency: "thinkingDepth" }
    ]
  },
  // Q14: competencies = T, Co, E, Cl
  {
    id: "q14",
    question: "갑자기 팀의 리더를 맡게 되었습니다. 가장 먼저 무엇을 하겠습니까?",
    options: [
      { text: "프로젝트의 목표와 현재 상황을 체계적으로 분석한다", primaryCompetency: "thinkingDepth", secondaryCompetency: "executionOriented" },
      { text: "팀의 비전과 방향을 명확하게 공유한다", primaryCompetency: "communicationClarity", secondaryCompetency: "executionOriented" },
      { text: "역할을 분담하고 첫 번째 실행 단계를 즉시 시작한다", primaryCompetency: "executionOriented", secondaryCompetency: "collaborationSignal" },
      { text: "팀원 각자의 강점과 기대를 파악하고 의견을 수렴한다", primaryCompetency: "collaborationSignal", secondaryCompetency: "communicationClarity" }
    ]
  },
  // Q15: competencies = C, Co, E, Cl
  {
    id: "q15",
    question: "당신의 학습 성과를 다른 사람들에게 공유할 기회가 생겼습니다. 어떻게 하겠습니까?",
    options: [
      { text: "흥미로운 관점이나 독창적인 해석을 중심으로 공유한다", primaryCompetency: "creativity", secondaryCompetency: "communicationClarity" },
      { text: "핵심 내용을 쉽고 체계적으로 전달하는 데 집중한다", primaryCompetency: "communicationClarity", secondaryCompetency: "creativity" },
      { text: "실제 적용 사례나 실습을 포함해 실용적으로 전달한다", primaryCompetency: "executionOriented", secondaryCompetency: "communicationClarity" },
      { text: "함께 토론하고 배울 수 있는 참여형 형태로 진행한다", primaryCompetency: "collaborationSignal", secondaryCompetency: "creativity" }
    ]
  },
  // Q16: competencies = Q, T, Co, E (repeat combo 4)
  {
    id: "q16",
    question: "한 달 안에 새로운 기술을 익혀야 합니다. 어떻게 계획을 세우겠습니까?",
    options: [
      { text: "먼저 '이 기술의 핵심 원리는 무엇인가?'를 파악한다", primaryCompetency: "questionQuality", secondaryCompetency: "thinkingDepth" },
      { text: "기술의 구조와 원리를 깊이 이해한 뒤 학습 순서를 결정한다", primaryCompetency: "thinkingDepth", secondaryCompetency: "executionOriented" },
      { text: "배운 내용을 정리하며 자신만의 설명 노트를 만들어간다", primaryCompetency: "communicationClarity", secondaryCompetency: "thinkingDepth" },
      { text: "주차별 구체적 목표를 설정하고 매일 실습한다", primaryCompetency: "executionOriented", secondaryCompetency: "communicationClarity" }
    ]
  },
  // Q17: competencies = Q, C, Co, Cl (repeat combo 8)
  {
    id: "q17",
    question: "아무리 공부해도 특정 개념이 이해되지 않습니다. 어떻게 하겠습니까?",
    options: [
      { text: "'정확히 어떤 부분이, 왜 이해가 안 되는지' 질문을 구체화한다", primaryCompetency: "questionQuality", secondaryCompetency: "communicationClarity" },
      { text: "완전히 다른 각도나 비유를 사용해서 이해를 시도한다", primaryCompetency: "creativity", secondaryCompetency: "questionQuality" },
      { text: "그 개념을 다른 사람에게 설명해보면서 이해를 점검한다", primaryCompetency: "communicationClarity", secondaryCompetency: "creativity" },
      { text: "같은 내용을 공부하는 사람들과 함께 토론하며 이해를 넓힌다", primaryCompetency: "collaborationSignal", secondaryCompetency: "communicationClarity" }
    ]
  },
  // Q18: competencies = Q, T, E, Cl (repeat combo 6)
  {
    id: "q18",
    question: "최근 자신의 성장이 정체된 것 같다고 느낍니다. 어떻게 하겠습니까?",
    options: [
      { text: "'지금 나에게 부족한 것은 무엇인가?' 자기 진단 질문을 만든다", primaryCompetency: "questionQuality", secondaryCompetency: "thinkingDepth" },
      { text: "지난 경험들을 돌아보며 성장 패턴과 정체 원인을 분석한다", primaryCompetency: "thinkingDepth", secondaryCompetency: "questionQuality" },
      { text: "새로운 도전을 즉시 시작하여 변화를 만든다", primaryCompetency: "executionOriented", secondaryCompetency: "creativity" },
      { text: "멘토나 동료에게 솔직한 피드백을 요청한다", primaryCompetency: "collaborationSignal", secondaryCompetency: "questionQuality" }
    ]
  },
  // Q19: competencies = T, C, Co, E (repeat combo 11)
  {
    id: "q19",
    question: "여러 자료를 조사했는데 서로 상반된 정보들이 있습니다. 어떻게 하겠습니까?",
    options: [
      { text: "각 정보의 근거와 출처를 추적하여 신뢰성을 분석한다", primaryCompetency: "thinkingDepth", secondaryCompetency: "executionOriented" },
      { text: "상반된 정보를 통합해 새로운 시각을 만들어본다", primaryCompetency: "creativity", secondaryCompetency: "thinkingDepth" },
      { text: "정보의 차이점을 명확하게 정리하여 비교표를 만든다", primaryCompetency: "communicationClarity", secondaryCompetency: "thinkingDepth" },
      { text: "직접 실험하거나 테스트해서 어떤 정보가 맞는지 확인한다", primaryCompetency: "executionOriented", secondaryCompetency: "creativity" }
    ]
  },
  // Q20: competencies = C, Co, E, Cl (repeat combo 15)
  {
    id: "q20",
    question: "1년 후 자신의 성장을 위해 지금 시작할 것을 하나 고르라면?",
    options: [
      { text: "매주 작은 것이라도 새로운 시도와 실험을 한다", primaryCompetency: "creativity", secondaryCompetency: "executionOriented" },
      { text: "배운 것을 주기적으로 글이나 발표로 정리하는 습관을 만든다", primaryCompetency: "communicationClarity", secondaryCompetency: "creativity" },
      { text: "구체적인 목표를 세우고 매일 꾸준히 실천한다", primaryCompetency: "executionOriented", secondaryCompetency: "communicationClarity" },
      { text: "배움을 나눌 수 있는 커뮤니티를 만들거나 참여한다", primaryCompetency: "collaborationSignal", secondaryCompetency: "creativity" }
    ]
  }
];

// ============================================================
// 역량별 PRIMARY 분포 (총 80 = 20문항 × 4선택지)
// questionQuality: 13회 (Q1-Q10, Q16-Q18)
// thinkingDepth: 13회 (Q1-Q6, Q11-Q14, Q16, Q18-Q19)
// creativity: 13회 (Q1-Q3, Q7-Q9, Q11-Q13, Q15, Q17, Q19-Q20)
// communicationClarity: 14회 (Q1, Q4-Q5, Q7-Q8, Q10-Q12, Q14-Q17, Q19-Q20)
// executionOriented: 14회 (Q2, Q4, Q6-Q7, Q9-Q11, Q13-Q16, Q18-Q20)
// collaborationSignal: 13회 (Q3, Q5-Q6, Q8-Q10, Q12-Q15, Q17-Q18, Q20)
// ============================================================

const PRIMARY_SCORE = 3;
const SECONDARY_SCORE = 1;

const ALL_COMPETENCIES = [
  "questionQuality",
  "thinkingDepth",
  "creativity",
  "communicationClarity",
  "executionOriented",
  "collaborationSignal"
];

// Fisher-Yates 셔플
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// 질문과 선택지를 랜덤 셔플하여 반환
function prepareRandomizedQuestions() {
  const shuffledQuestions = shuffleArray(ASSESSMENT_QUESTIONS).map(q => ({
    ...q,
    options: shuffleArray(q.options)
  }));
  return shuffledQuestions;
}

// 프론트엔드에 보낼 질문 형태 (채점 정보 제거)
function sanitizeQuestionForClient(question) {
  return {
    id: question.id,
    question: question.question,
    options: question.options.map(opt => ({ text: opt.text }))
  };
}

export async function startAssessment(event, headers) {
  const body = JSON.parse(event.body || "{}");
  const { userId } = body;

  if (!userId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing required field: userId" })
    };
  }

  const assessmentId = `assess-${Date.now()}`;
  const randomizedQuestions = prepareRandomizedQuestions();

  const assessmentData = {
    userId,
    assessmentId,
    assessmentType: "initial_sjt",
    status: "in_progress",
    questions: randomizedQuestions, // 셔플된 질문 (채점 정보 포함) 저장
    answers: [],
    currentQuestionIndex: 0,
    createdAt: Date.now()
  };

  await dynamoClient.send(new PutCommand({
    TableName: TABLES.ASSESSMENTS,
    Item: assessmentData
  }));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      assessmentId,
      firstQuestion: sanitizeQuestionForClient(randomizedQuestions[0]),
      totalQuestions: randomizedQuestions.length
    })
  };
}

export async function submitAssessmentAnswer(event, headers) {
  const body = JSON.parse(event.body || "{}");
  const { userId, assessmentId, questionId, selectedOptionIndex } = body;

  if (!userId || !assessmentId || !questionId || selectedOptionIndex === undefined) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing required fields" })
    };
  }

  try {
    const getResult = await dynamoClient.send(new GetCommand({
      TableName: TABLES.ASSESSMENTS,
      Key: { userId, assessmentId }
    }));

    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Assessment not found" })
      };
    }

    const assessment = getResult.Item;
    const questionIndex = assessment.questions.findIndex(q => q.id === questionId);

    if (questionIndex === -1) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Question not found" })
      };
    }

    const question = assessment.questions[questionIndex];
    const selectedOption = question.options[selectedOptionIndex];

    if (!selectedOption) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid option index" })
      };
    }

    // SJT 답변 저장
    const answerData = {
      questionId,
      selectedOptionIndex,
      selectedText: selectedOption.text,
      primaryCompetency: selectedOption.primaryCompetency,
      secondaryCompetency: selectedOption.secondaryCompetency,
      timestamp: Date.now()
    };

    assessment.answers = assessment.answers || [];
    assessment.answers.push(answerData);
    assessment.currentQuestionIndex = questionIndex + 1;

    const isCompleted = assessment.currentQuestionIndex >= assessment.questions.length;

    if (isCompleted) {
      const finalScores = calculateSJTScores(assessment.answers);
      assessment.status = "completed";
      assessment.results = finalScores;
      assessment.completedAt = Date.now();

      await saveCompetenciesToUserTable(userId, finalScores);
    }

    await dynamoClient.send(new PutCommand({
      TableName: TABLES.ASSESSMENTS,
      Item: assessment
    }));

    const nextQuestion = isCompleted
      ? null
      : assessment.questions[assessment.currentQuestionIndex];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        isCompleted,
        nextQuestion: nextQuestion ? sanitizeQuestionForClient(nextQuestion) : null,
        progress: {
          current: assessment.currentQuestionIndex,
          total: assessment.questions.length
        },
        results: isCompleted ? assessment.results : null
      })
    };
  } catch (error) {
    console.error("Submit answer error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

export async function getAssessmentResults(event, headers) {
  const pathParts = event.path.split('/');
  const userId = pathParts[3]; // /assessment/results/{userId}

  try {
    const result = await dynamoClient.send(new QueryCommand({
      TableName: TABLES.ASSESSMENTS,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId
      },
      ScanIndexForward: false,
      Limit: 1
    }));

    if (!result.Items || result.Items.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "No assessment found for this user" })
      };
    }

    const assessment = result.Items[0];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        assessmentId: assessment.assessmentId,
        status: assessment.status,
        results: assessment.results,
        completedAt: assessment.completedAt,
        createdAt: assessment.createdAt
      })
    };
  } catch (error) {
    console.error("Get assessment results error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

// ============================================================
// SJT 채점 로직
// ============================================================
// 각 선택지: primary 역량 +3점, secondary 역량 +1점
//
// 정규화 방식: "기대값 기준 정규화"
//   총 배분 점수 = 20문항 × (3 + 1) = 80점
//   역량당 기대값 = 80 / 6 ≈ 13.3점 (균형 선택 시)
//   ratio = 획득 / 기대값
//     ratio 0   → 1점 (해당 역량 전혀 선택 안 함)
//     ratio 1   → 5.5점 (균형 잡힌 선택)
//     ratio 2+  → 10점 (해당 역량 강한 선호)
//
// 스케일 예시:
//   균형 사용자 → 각 역량 5~6점
//   약간의 선호 → 주 역량 7~8점, 나머지 4~5점
//   강한 선호   → 주 역량 9~10점, 나머지 3~4점
// ============================================================

function calculateSJTScores(answers) {
  const totalEarned = {};

  for (const comp of ALL_COMPETENCIES) {
    totalEarned[comp] = 0;
  }

  // 각 답변에서 획득한 점수 합산
  for (const answer of answers) {
    totalEarned[answer.primaryCompetency] =
      (totalEarned[answer.primaryCompetency] || 0) + PRIMARY_SCORE;
    totalEarned[answer.secondaryCompetency] =
      (totalEarned[answer.secondaryCompetency] || 0) + SECONDARY_SCORE;
  }

  // 기대값 기준 정규화
  const totalPoints = Object.values(totalEarned).reduce((a, b) => a + b, 0);
  const expectedPerCompetency = totalPoints / ALL_COMPETENCIES.length;

  const scores = {};
  for (const comp of ALL_COMPETENCIES) {
    if (expectedPerCompetency > 0) {
      const ratio = totalEarned[comp] / expectedPerCompetency;
      // ratio 0 → 1점, ratio 1 → 5.5점, ratio 2 → 10점
      const rawScore = 1 + ratio * 4.5;
      scores[comp] = Math.min(10, Math.max(1, Math.round(rawScore)));
    } else {
      scores[comp] = 5;
    }
  }

  return scores;
}

async function saveCompetenciesToUserTable(userId, scores) {
  const competencies = Object.keys(scores);

  for (const competency of competencies) {
    await dynamoClient.send(new PutCommand({
      TableName: TABLES.COMPETENCIES,
      Item: {
        userId,
        competency,
        score: scores[competency],
        updatedAt: Date.now(),
        totalMessages: 0,
        historicalScores: [
          {
            score: scores[competency],
            timestamp: Date.now(),
            source: "initial_assessment_sjt"
          }
        ]
      }
    }));
  }
}
