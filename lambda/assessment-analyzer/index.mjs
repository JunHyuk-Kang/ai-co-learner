// Gemini imports
import { GoogleGenerativeAI } from "@google/generative-ai";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// Google Gemini 클라이언트
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "ap-northeast-2" })
);

const ASSESSMENTS_TABLE = "ai-co-learner-assessments";
const COMPETENCIES_TABLE = "ai-co-learner-user-competencies";
const MODEL_ID = "gemini-2.5-flash";

// Exponential Backoff 재시도 설정
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2
};

// Exponential Backoff 재시도 헬퍼 함수
async function retryWithBackoff(fn, retries = RETRY_CONFIG.maxRetries) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const isRetryable =
        error.message?.includes('quota') ||
        error.message?.includes('limit') ||
        error.message?.includes('RESOURCE_EXHAUSTED') ||
        error.status === 429 ||
        error.status === 503;

      if (!isRetryable || attempt === retries) {
        throw error;
      }

      const delay = Math.min(
        RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt),
        RETRY_CONFIG.maxDelay
      );

      console.log(`Retry attempt ${attempt + 1}/${retries} after ${delay}ms delay. Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// 역량 평가를 위한 질문 템플릿
const ASSESSMENT_QUESTIONS = [
  {
    id: "q1",
    question: "최근에 해결하고 싶었던 문제나 궁금했던 주제가 있나요? 그것에 대해 어떤 질문을 스스로에게 던졌는지 설명해주세요.",
    expectedCompetencies: ["questionQuality", "thinkingDepth"]
  },
  {
    id: "q2",
    question: "일상에서 마주친 평범한 상황이나 물건을 하나 떠올려보세요. 그것을 완전히 다른 방식으로 활용하거나 개선한다면 어떻게 하시겠어요?",
    expectedCompetencies: ["creativity", "thinkingDepth"]
  },
  {
    id: "q3",
    question: "복잡한 개념이나 아이디어를 다른 사람에게 설명해야 했던 경험이 있나요? 어떻게 설명했는지 구체적으로 말씀해주세요.",
    expectedCompetencies: ["communicationClarity", "thinkingDepth"]
  },
  {
    id: "q4",
    question: "최근에 계획을 세우고 실행에 옮긴 경험이 있나요? 어떤 단계를 거쳤고, 어떤 결과가 나왔나요?",
    expectedCompetencies: ["executionOriented", "thinkingDepth"]
  },
  {
    id: "q5",
    question: "다른 사람과 함께 무언가를 해결하거나 만들어낸 경험을 공유해주세요. 그 과정에서 어떤 역할을 하셨나요?",
    expectedCompetencies: ["collaborationSignal", "communicationClarity"]
  },
  {
    id: "q6",
    question: "어떤 문제를 깊이 파고들어 생각해본 적이 있나요? 표면적인 답 너머에서 발견한 것이 있다면 무엇인가요?",
    expectedCompetencies: ["thinkingDepth", "questionQuality"]
  },
  {
    id: "q7",
    question: "기존에 없던 새로운 것을 시도하거나 만들어본 경험이 있나요? 그 아이디어는 어디서 왔고, 어떻게 실현했나요?",
    expectedCompetencies: ["creativity", "executionOriented"]
  },
  {
    id: "q8",
    question: "복잡한 정보나 데이터를 단순하고 명확하게 정리해본 적이 있나요? 어떤 방법을 사용했나요?",
    expectedCompetencies: ["communicationClarity", "thinkingDepth"]
  }
];

// Gemini를 사용하여 답변 분석
async function analyzeAnswerWithGemini(question, answer) {
  const prompt = `당신은 학습자의 역량을 분석하는 전문가입니다. 다음 질문과 답변을 분석하여 6가지 역량을 1-10점으로 평가해주세요.

질문: ${question}
답변: ${answer}

평가해야 할 6가지 역량:
1. questionQuality (질문의 질): 깊이 있고 핵심을 파고드는 질문을 하는 능력
2. thinkingDepth (사고의 깊이): 표면적이지 않고 본질을 파악하는 사고 능력
3. creativity (창의성): 새롭고 독창적인 관점이나 아이디어를 제시하는 능력
4. communicationClarity (소통 명확성): 명확하고 이해하기 쉽게 설명하는 능력
5. executionOriented (실행 지향성): 계획을 세우고 실제로 실행하는 능력
6. collaborationSignal (협업 신호): 타인과 협력하고 소통하는 능력

답변 형식:
{
  "questionQuality": <1-10 점수>,
  "thinkingDepth": <1-10 점수>,
  "creativity": <1-10 점수>,
  "communicationClarity": <1-10 점수>,
  "executionOriented": <1-10 점수>,
  "collaborationSignal": <1-10 점수>,
  "analysis": "<간단한 분석 코멘트>"
}

JSON만 반환해주세요.`;

  try {
    return await retryWithBackoff(async () => {
      const model = genAI.getGenerativeModel({
        model: MODEL_ID,
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.3
        }
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const analysisText = response.text();

      // JSON 추출 (```json ``` 태그가 있을 수 있음)
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return JSON.parse(analysisText);
    });
  } catch (error) {
    console.error("Gemini analysis error:", error);
    throw error;
  }
}

// 진단 시작
export async function startAssessment(userId) {
  const assessmentId = `assess-${Date.now()}`;

  const assessmentData = {
    userId,
    assessmentId,
    assessmentType: "initial",
    status: "in_progress",
    questions: ASSESSMENT_QUESTIONS,
    answers: [],
    currentQuestionIndex: 0,
    createdAt: Date.now()
  };

  await dynamoClient.send(new PutCommand({
    TableName: ASSESSMENTS_TABLE,
    Item: assessmentData
  }));

  return {
    assessmentId,
    firstQuestion: ASSESSMENT_QUESTIONS[0]
  };
}

// 답변 제출
export async function submitAnswer(userId, assessmentId, questionId, answer) {
  // 1. 진단 데이터 가져오기
  const getResult = await dynamoClient.send(new GetCommand({
    TableName: ASSESSMENTS_TABLE,
    Key: { userId, assessmentId }
  }));

  if (!getResult.Item) {
    throw new Error("Assessment not found");
  }

  const assessment = getResult.Item;
  const questionIndex = assessment.questions.findIndex(q => q.id === questionId);

  if (questionIndex === -1) {
    throw new Error("Question not found");
  }

  const question = assessment.questions[questionIndex];

  // 2. Gemini로 답변 분석
  const analysis = await analyzeAnswerWithGemini(question.question, answer);

  // 3. 답변 및 분석 결과 저장
  const answerData = {
    questionId,
    answer,
    analysis,
    timestamp: Date.now()
  };

  assessment.answers = assessment.answers || [];
  assessment.answers.push(answerData);
  assessment.currentQuestionIndex = questionIndex + 1;

  // 4. 모든 질문을 완료했는지 확인
  const isCompleted = assessment.currentQuestionIndex >= assessment.questions.length;

  if (isCompleted) {
    // 최종 점수 계산
    const finalScores = calculateFinalScores(assessment.answers);
    assessment.status = "completed";
    assessment.results = finalScores;
    assessment.completedAt = Date.now();

    // 사용자 역량 테이블에 저장
    await saveCompetenciesToUserTable(userId, finalScores);
  }

  // 5. 진단 데이터 업데이트
  await dynamoClient.send(new PutCommand({
    TableName: ASSESSMENTS_TABLE,
    Item: assessment
  }));

  // 6. 다음 질문 반환
  const nextQuestion = isCompleted
    ? null
    : assessment.questions[assessment.currentQuestionIndex];

  return {
    analysis: analysis.analysis,
    isCompleted,
    nextQuestion,
    progress: {
      current: assessment.currentQuestionIndex,
      total: assessment.questions.length
    },
    results: isCompleted ? assessment.results : null
  };
}

// 최종 점수 계산 (모든 답변의 평균)
function calculateFinalScores(answers) {
  const competencies = [
    "questionQuality",
    "thinkingDepth",
    "creativity",
    "communicationClarity",
    "executionOriented",
    "collaborationSignal"
  ];

  const scores = {};

  for (const competency of competencies) {
    const sum = answers.reduce((acc, answer) => {
      return acc + (answer.analysis[competency] || 0);
    }, 0);
    scores[competency] = Math.round((sum / answers.length) * 10) / 10; // 소수점 1자리
  }

  return scores;
}

// 사용자 역량 테이블에 저장
async function saveCompetenciesToUserTable(userId, scores) {
  const competencies = Object.keys(scores);

  for (const competency of competencies) {
    await dynamoClient.send(new PutCommand({
      TableName: COMPETENCIES_TABLE,
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
            source: "initial_assessment"
          }
        ]
      }
    }));
  }
}

// 진단 결과 조회
export async function getAssessmentResults(userId, assessmentId) {
  const result = await dynamoClient.send(new GetCommand({
    TableName: ASSESSMENTS_TABLE,
    Key: { userId, assessmentId }
  }));

  if (!result.Item) {
    throw new Error("Assessment not found");
  }

  return {
    assessmentId: result.Item.assessmentId,
    status: result.Item.status,
    results: result.Item.results,
    completedAt: result.Item.completedAt,
    createdAt: result.Item.createdAt
  };
}

// Lambda Handler (API Gateway와 통합용)
export const handler = async (event) => {
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    const body = JSON.parse(event.body || "{}");
    const { action, userId, assessmentId, questionId, answer } = body;

    let result;

    switch (action) {
      case "start":
        result = await startAssessment(userId);
        break;
      case "submit":
        result = await submitAnswer(userId, assessmentId, questionId, answer);
        break;
      case "results":
        result = await getAssessmentResults(userId, assessmentId);
        break;
      default:
        throw new Error("Invalid action");
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};
