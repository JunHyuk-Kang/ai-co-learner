// 개선된 객관식 질문 (20문항)
// 변경 사항: 추상적이거나 헷갈릴 수 있는 질문들을 명확하게 개선

const IMPROVED_ASSESSMENT_QUESTIONS = [
  // questionQuality (질문력) - 4문항
  {
    id: "q1",
    question: "문제를 해결할 때 나의 접근 방식은?",
    options: [
      { text: "일단 시작하고 부딪히면서 배운다", score: 1 },
      { text: "기본적인 질문 몇 가지를 생각해본다", score: 2 },
      { text: "문제를 분석하고 핵심 질문들을 정리한다", score: 3 },
      { text: "다각도로 질문을 만들어 문제의 본질을 파악한다", score: 4 }
    ],
    competency: "questionQuality"
  },
  {
    id: "q2",
    question: "새로운 주제를 학습할 때 나는?",
    options: [
      { text: "주어진 내용을 그대로 받아들인다", score: 1 },
      { text: "이해가 안 되는 부분만 질문한다", score: 2 },
      { text: "'왜 그럴까?'라는 질문을 자주 던진다", score: 3 },
      { text: "연관된 질문들을 계속 만들어가며 깊이 탐구한다", score: 4 }
    ],
    competency: "questionQuality"
  },
  {
    id: "q3",
    question: "다른 사람의 의견을 들을 때 나는?",
    options: [
      { text: "경청하고 받아들인다", score: 1 },
      { text: "궁금한 점이 있으면 질문한다", score: 2 },
      { text: "의견의 근거가 무엇인지 파악하려 한다", score: 3 },
      { text: "질문을 통해 숨어있는 가정이나 전제를 발견한다", score: 4 }
    ],
    competency: "questionQuality"
  },

  // thinkingDepth (사고력) - 4문항
  {
    id: "q4",
    question: "복잡한 문제를 마주했을 때 나는?",
    options: [
      { text: "빠르게 해결책을 찾으려 한다", score: 1 },
      { text: "여러 가지 방법을 시도해본다", score: 2 },
      { text: "문제를 작은 부분으로 나누어 하나씩 분석한다", score: 3 },
      { text: "문제가 왜 발생했는지 근본 원인부터 깊이 파고든다", score: 4 }
    ],
    competency: "thinkingDepth"
  },
  {
    id: "q5",
    question: "새로운 정보를 학습할 때 나의 방식은?",
    options: [
      { text: "당장 필요한 핵심만 빠르게 파악한다", score: 1 },
      { text: "중요한 내용을 정리하고 요약한다", score: 2 },
      { text: "이미 알고 있는 지식과 연결지어 이해한다", score: 3 },
      { text: "여러 관점에서 깊이 분석하고 실제로 어떻게 활용할지 고민한다", score: 4 }
    ],
    competency: "thinkingDepth"
  },
  {
    id: "q6",
    question: "중요한 결정을 내릴 때 나는?",
    options: [
      { text: "직감을 믿고 빠르게 결정한다", score: 1 },
      { text: "좋은 점과 나쁜 점을 간단히 비교한다", score: 2 },
      { text: "여러 요소를 종합적으로 따져본다", score: 3 },
      { text: "나중에 미칠 영향까지 생각하며 신중히 판단한다", score: 4 }
    ],
    competency: "thinkingDepth"
  },

  // creativity (창의력) - 3문항
  {
    id: "q7",
    question: "문제 해결할 때 나의 아이디어 스타일은?",
    options: [
      { text: "이미 검증된 안전한 방법을 따른다", score: 1 },
      { text: "기존 방법을 조금 변형해본다", score: 2 },
      { text: "여러 방법을 새롭게 조합해본다", score: 3 },
      { text: "아무도 시도하지 않은 완전히 새로운 방법을 만든다", score: 4 }
    ],
    competency: "creativity"
  },
  {
    id: "q8",
    question: "일상에서 새로운 것을 접했을 때 나는?",
    options: [
      { text: "익숙한 방식을 선호한다", score: 1 },
      { text: "가끔 새로운 것을 시도한다", score: 2 },
      { text: "자주 새로운 방식을 실험해본다", score: 3 },
      { text: "항상 '이걸 다르게 하면 어떨까?' 상상한다", score: 4 }
    ],
    competency: "creativity"
  },
  {
    id: "q9",
    question: "아이디어를 떠올릴 때 나는?",
    options: [
      { text: "대부분 사람들이 하는 일반적인 생각을 한다", score: 1 },
      { text: "다른 사람의 좋은 아이디어를 참고한다", score: 2 },
      { text: "서로 다른 분야의 아이디어를 섞어본다", score: 3 },
      { text: "전혀 관련 없어 보이는 것들을 창의적으로 연결한다", score: 4 }
    ],
    competency: "creativity"
  },

  // communicationClarity (소통력) - 3문항
  {
    id: "q10",
    question: "복잡한 내용을 다른 사람에게 설명할 때 나는?",
    options: [
      { text: "내가 아는 대로 그대로 설명한다", score: 1 },
      { text: "핵심 내용만 간단히 전달한다", score: 2 },
      { text: "듣는 사람 수준에 맞춰 쉽게 풀어 설명한다", score: 3 },
      { text: "일상 속 비유와 예시를 들어 누구나 이해하도록 전달한다", score: 4 }
    ],
    competency: "communicationClarity"
  },
  {
    id: "q11",
    question: "내 의견을 전달할 때 나는?",
    options: [
      { text: "내 생각을 말한다", score: 1 },
      { text: "간결하게 핵심만 전달한다", score: 2 },
      { text: "왜 그렇게 생각하는지 근거와 함께 설명한다", score: 3 },
      { text: "상대방이 공감할 수 있게 논리적으로 구조화해서 전달한다", score: 4 }
    ],
    competency: "communicationClarity"
  },
  {
    id: "q12",
    question: "글이나 발표 자료를 만들 때 나는?",
    options: [
      { text: "생각나는 대로 내용을 나열한다", score: 1 },
      { text: "중요한 부분을 강조한다", score: 2 },
      { text: "논리적 흐름을 고려해서 구성한다", score: 3 },
      { text: "메시지가 명확히 전달되도록 체계적으로 설계한다", score: 4 }
    ],
    competency: "communicationClarity"
  },

  // executionOriented (실행력) - 3문항
  {
    id: "q13",
    question: "계획을 세운 후 나는?",
    options: [
      { text: "계획만 세우고 실행은 미루는 편이다", score: 1 },
      { text: "시작은 하지만 끝까지 하지 못하는 경우가 많다", score: 2 },
      { text: "대부분 계획한 것을 실행에 옮긴다", score: 3 },
      { text: "즉시 행동하고 반드시 끝까지 완수한다", score: 4 }
    ],
    competency: "executionOriented"
  },
  {
    id: "q14",
    question: "목표를 달성하는 과정에서 나는?",
    options: [
      { text: "흐름에 맡기고 자연스럽게 진행한다", score: 1 },
      { text: "기본적인 단계를 밟아간다", score: 2 },
      { text: "구체적인 실행 계획을 세우고 따라간다", score: 3 },
      { text: "중간 목표를 정하고 계속 점검하며 적극적으로 추진한다", score: 4 }
    ],
    competency: "executionOriented"
  },
  {
    id: "q15",
    question: "새로운 프로젝트를 시작할 때 나는?",
    options: [
      { text: "일단 머릿속으로만 생각해본다", score: 1 },
      { text: "모든 준비가 완벽해지면 시작한다", score: 2 },
      { text: "작은 것부터 빠르게 시작한다", score: 3 },
      { text: "핵심 기능만 빠르게 만들어 테스트하고 계속 개선한다", score: 4 }
    ],
    competency: "executionOriented"
  },

  // collaborationSignal (협업력) - 3문항
  {
    id: "q16",
    question: "팀 프로젝트에서 나는?",
    options: [
      { text: "내가 맡은 역할만 수행한다", score: 1 },
      { text: "필요할 때 다른 사람을 돕는다", score: 2 },
      { text: "적극적으로 협력하고 의견을 조율한다", score: 3 },
      { text: "팀 전체가 잘되도록 능동적으로 도우며 기여한다", score: 4 }
    ],
    competency: "collaborationSignal"
  },
  {
    id: "q17",
    question: "팀원과 의견이 충돌했을 때 나는?",
    options: [
      { text: "내 의견이 옳다고 주장한다", score: 1 },
      { text: "서로 양보할 점을 찾으려 한다", score: 2 },
      { text: "서로의 입장을 이해하고 조율한다", score: 3 },
      { text: "대화를 통해 더 나은 제3의 해결책을 함께 만든다", score: 4 }
    ],
    competency: "collaborationSignal"
  },
  {
    id: "q18",
    question: "팀원이 어려움을 겪는 것을 발견했을 때 나는?",
    options: [
      { text: "각자 알아서 해결할 문제라고 생각한다", score: 1 },
      { text: "도움을 요청하면 도와준다", score: 2 },
      { text: "먼저 다가가 도움을 제안한다", score: 3 },
      { text: "선제적으로 지원하고 함께 성장할 방법을 찾는다", score: 4 }
    ],
    competency: "collaborationSignal"
  },

  // 추가 균형 문항 (thinkingDepth)
  {
    id: "q19",
    question: "실패를 경험했을 때 나는?",
    options: [
      { text: "아쉽지만 빨리 잊고 넘어간다", score: 1 },
      { text: "무엇이 잘못되었는지 간단히 생각해본다", score: 2 },
      { text: "실패 원인을 분석하고 교훈을 얻는다", score: 3 },
      { text: "깊이 성찰해 근본 원인을 찾고 구체적인 개선 방안을 만든다", score: 4 }
    ],
    competency: "thinkingDepth"
  },
  {
    id: "q20",
    question: "처음 해보는 어려운 과제를 받았을 때 나는?",
    options: [
      { text: "부담스럽고 걱정된다", score: 1 },
      { text: "일단 해보면서 배운다", score: 2 },
      { text: "필요한 것을 학습하고 준비해서 도전한다", score: 3 },
      { text: "성장할 기회로 받아들이고 전략적으로 접근한다", score: 4 }
    ],
    competency: "thinkingDepth"
  }
];

export default IMPROVED_ASSESSMENT_QUESTIONS;
