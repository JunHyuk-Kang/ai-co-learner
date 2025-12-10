import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'ap-northeast-2' });
const docClient = DynamoDBDocumentClient.from(client);

// 역량 분석: 강점과 약점 식별
function analyzeCompetencies(competencies) {
  const competencyArray = Object.entries(competencies).map(([name, score]) => ({
    name,
    score,
  }));

  // 평균 점수
  const avgScore = competencyArray.reduce((sum, c) => sum + c.score, 0) / competencyArray.length;

  // 강점 (평균보다 10점 이상 높음)
  const strengths = competencyArray
    .filter(c => c.score >= avgScore + 10)
    .sort((a, b) => b.score - a.score);

  // 약점 (평균보다 10점 이상 낮음)
  const weaknesses = competencyArray
    .filter(c => c.score <= avgScore - 10)
    .sort((a, b) => a.score - b.score);

  // 균형잡힌 역량 (평균 근처)
  const balanced = competencyArray
    .filter(c => Math.abs(c.score - avgScore) < 10);

  return {
    strengths,
    weaknesses,
    balanced,
    avgScore: Math.round(avgScore),
    highest: competencyArray.sort((a, b) => b.score - a.score)[0],
    lowest: competencyArray.sort((a, b) => a.score - b.score)[0],
  };
}

// 학습 활동 패턴 분석
function analyzeLearningActivity(analytics) {
  // 시간대별 활동 분석
  const hourDistribution = {};
  const dayOfWeekDistribution = {};
  let totalMessages = analytics.length;
  let avgMessageLength = 0;

  analytics.forEach(item => {
    const date = new Date(item.timestamp);
    const hour = date.getHours();
    const dayOfWeek = date.getDay(); // 0=일요일, 6=토요일

    // 시간대별 카운트
    hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;

    // 요일별 카운트
    dayOfWeekDistribution[dayOfWeek] = (dayOfWeekDistribution[dayOfWeek] || 0) + 1;

    // 메시지 길이 누적
    if (item.messageLength) {
      avgMessageLength += item.messageLength;
    }
  });

  // 가장 활발한 시간대 (Top 3)
  const peakHours = Object.entries(hourDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour, count]) => ({
      hour: parseInt(hour),
      count,
      percentage: Math.round((count / totalMessages) * 100),
    }));

  // 가장 활발한 요일
  const peakDays = Object.entries(dayOfWeekDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([day, count]) => ({
      day: parseInt(day),
      dayName: ['일', '월', '화', '수', '목', '금', '토'][parseInt(day)],
      count,
      percentage: Math.round((count / totalMessages) * 100),
    }));

  // 평균 메시지 길이
  avgMessageLength = totalMessages > 0 ? Math.round(avgMessageLength / totalMessages) : 0;

  return {
    totalMessages,
    avgMessageLength,
    peakHours,
    peakDays,
  };
}

// 성장 추이 분석
function analyzeGrowthTrend(competencyHistory) {
  if (!competencyHistory || competencyHistory.length < 2) {
    return {
      trend: 'insufficient_data',
      growthRate: 0,
      improvingCompetencies: [],
      decliningCompetencies: [],
    };
  }

  // 첫 기록과 최근 기록 비교
  const earliest = competencyHistory[0];
  const latest = competencyHistory[competencyHistory.length - 1];

  const competencyChanges = {};
  Object.keys(latest.competencies).forEach(comp => {
    const oldScore = earliest.competencies[comp] || 0;
    const newScore = latest.competencies[comp] || 0;
    const change = newScore - oldScore;
    const changePercent = oldScore > 0 ? Math.round((change / oldScore) * 100) : 0;

    competencyChanges[comp] = {
      oldScore,
      newScore,
      change,
      changePercent,
    };
  });

  // 개선된 역량 (증가한 것들)
  const improvingCompetencies = Object.entries(competencyChanges)
    .filter(([_, data]) => data.change > 0)
    .sort((a, b) => b[1].change - a[1].change)
    .map(([name, data]) => ({ name, ...data }));

  // 하락한 역량
  const decliningCompetencies = Object.entries(competencyChanges)
    .filter(([_, data]) => data.change < 0)
    .sort((a, b) => a[1].change - b[1].change)
    .map(([name, data]) => ({ name, ...data }));

  // 전체 성장률 계산
  const totalOldScore = Object.values(competencyChanges).reduce((sum, d) => sum + d.oldScore, 0);
  const totalNewScore = Object.values(competencyChanges).reduce((sum, d) => sum + d.newScore, 0);
  const overallGrowthRate = totalOldScore > 0
    ? Math.round(((totalNewScore - totalOldScore) / totalOldScore) * 100)
    : 0;

  // 추세 판단
  let trend = 'stable';
  if (overallGrowthRate > 10) trend = 'improving';
  else if (overallGrowthRate < -10) trend = 'declining';

  return {
    trend,
    growthRate: overallGrowthRate,
    improvingCompetencies,
    decliningCompetencies,
    daysCovered: competencyHistory.length,
  };
}

// 개인화된 인사이트 생성
function generateInsights(competencyAnalysis, activityAnalysis, growthAnalysis) {
  const insights = [];

  // 1. 강점 활용 인사이트
  if (competencyAnalysis.strengths.length > 0) {
    const topStrength = competencyAnalysis.strengths[0];
    insights.push({
      type: 'strength',
      title: '당신의 강점',
      message: `${getCompetencyLabel(topStrength.name)}이(가) 뛰어납니다 (${topStrength.score}점)! 이 강점을 활용해보세요.`,
      priority: 'high',
    });
  }

  // 2. 약점 개선 인사이트
  if (competencyAnalysis.weaknesses.length > 0) {
    const topWeakness = competencyAnalysis.weaknesses[0];
    insights.push({
      type: 'weakness',
      title: '개선 기회',
      message: `${getCompetencyLabel(topWeakness.name)}을(를) 향상시키면 더 균형잡힌 성장이 가능합니다 (현재 ${topWeakness.score}점).`,
      priority: 'high',
    });
  }

  // 3. 성장 추세 인사이트
  if (growthAnalysis.trend === 'improving') {
    insights.push({
      type: 'growth',
      title: '성장 중!',
      message: `지난 ${growthAnalysis.daysCovered}일간 ${growthAnalysis.growthRate}% 성장했습니다. 꾸준히 유지해보세요!`,
      priority: 'high',
    });
  } else if (growthAnalysis.trend === 'declining') {
    insights.push({
      type: 'alert',
      title: '주의 필요',
      message: `최근 활동이 다소 감소했습니다. 꾸준한 학습이 중요합니다.`,
      priority: 'medium',
    });
  }

  // 4. 학습 시간 패턴 인사이트
  if (activityAnalysis.peakHours.length > 0) {
    const peakHour = activityAnalysis.peakHours[0];
    insights.push({
      type: 'pattern',
      title: '학습 패턴',
      message: `주로 ${peakHour.hour}시에 활발히 학습하시네요. 이 시간대를 활용해 집중 학습을 해보세요!`,
      priority: 'low',
    });
  }

  // 5. 특정 역량 급상승 인사이트
  if (growthAnalysis.improvingCompetencies.length > 0) {
    const topImproving = growthAnalysis.improvingCompetencies[0];
    if (topImproving.change >= 15) {
      insights.push({
        type: 'achievement',
        title: '눈에 띄는 성장',
        message: `${getCompetencyLabel(topImproving.name)}이(가) ${topImproving.change}점 상승했습니다! 훌륭합니다!`,
        priority: 'high',
      });
    }
  }

  return insights.sort((a, b) => {
    const priority = { high: 0, medium: 1, low: 2 };
    return priority[a.priority] - priority[b.priority];
  });
}

// 역량 라벨 매핑
function getCompetencyLabel(competency) {
  const labels = {
    questionQuality: '질문력',
    thinkingDepth: '사고력',
    creativity: '창의력',
    communicationClarity: '소통력',
    executionOriented: '실행력',
    collaborationSignal: '협업력',
  };
  return labels[competency] || competency;
}

// 봇 선호도 분석
function analyzeBotPreferences(chatSessions, userBots) {
  if (chatSessions.length === 0) {
    return null;
  }

  // 1. 봇 타입별 사용 빈도 (sessionId로 봇 구분)
  const botUsageCount = {};
  const sessionBotMap = {}; // sessionId -> botId 매핑

  chatSessions.forEach(session => {
    const sessionId = session.sessionId;
    if (!sessionBotMap[sessionId]) {
      sessionBotMap[sessionId] = sessionId;
      botUsageCount[sessionId] = 0;
    }
    botUsageCount[sessionId]++;
  });

  // 2. 대화 길이 선호도 분석
  const sessionMessageCounts = {};
  chatSessions.forEach(session => {
    const sessionId = session.sessionId;
    sessionMessageCounts[sessionId] = (sessionMessageCounts[sessionId] || 0) + 1;
  });

  const messageCounts = Object.values(sessionMessageCounts);
  const avgMessagesPerSession = messageCounts.length > 0
    ? Math.round(messageCounts.reduce((sum, c) => sum + c, 0) / messageCounts.length)
    : 0;

  let conversationLengthPreference = 'medium';
  if (avgMessagesPerSession < 5) {
    conversationLengthPreference = 'short';
  } else if (avgMessagesPerSession > 15) {
    conversationLengthPreference = 'long';
  }

  // 3. 학습 시간대 패턴 분석
  const hourDistribution = {};
  chatSessions.forEach(session => {
    const hour = new Date(session.timestamp).getHours();
    hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;
  });

  const peakHour = Object.entries(hourDistribution)
    .sort((a, b) => b[1] - a[1])[0];

  let learningTimePattern = 'afternoon';
  if (peakHour) {
    const hour = parseInt(peakHour[0]);
    if (hour >= 6 && hour < 12) {
      learningTimePattern = 'morning';
    } else if (hour >= 12 && hour < 18) {
      learningTimePattern = 'afternoon';
    } else if (hour >= 18 && hour < 22) {
      learningTimePattern = 'evening';
    } else {
      learningTimePattern = 'night';
    }
  }

  // 4. 선호 봇 타입 분석 (user-bots의 templateId 기반)
  const botTypeCount = {};
  userBots.forEach(bot => {
    const baseType = bot.baseType || 'general';
    botTypeCount[baseType] = (botTypeCount[baseType] || 0) + 1;
  });

  const preferredBotTypes = Object.entries(botTypeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([baseType, count]) => ({
      baseType,
      usageCount: count,
      percentage: Math.round((count / userBots.length) * 100)
    }));

  // 5. 주제 선호도 (봇의 primaryCompetencies 기반)
  const topicCount = {};
  userBots.forEach(bot => {
    if (bot.primaryCompetencies && Array.isArray(bot.primaryCompetencies)) {
      bot.primaryCompetencies.forEach(comp => {
        topicCount[comp] = (topicCount[comp] || 0) + 1;
      });
    }
  });

  const preferredTopics = Object.entries(topicCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([competency, frequency]) => ({
      competency,
      frequency
    }));

  return {
    preferredBotTypes,
    conversationLengthPreference,
    avgMessagesPerSession,
    preferredTopics,
    learningTimePattern
  };
}


// 메인 분석 함수
async function analyzeLearningPattern(userId) {
  try {
    // 1. 역량 데이터 조회
    const competenciesResponse = await docClient.send(new QueryCommand({
      TableName: 'ai-co-learner-user-competencies',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    }));

    const competencies = {};
    if (competenciesResponse.Items) {
      competenciesResponse.Items.forEach(item => {
        competencies[item.competency] = item.score;
      });
    }

    // 2. 학습 분석 데이터 조회 (최근 30일)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startTimestamp = Math.floor(thirtyDaysAgo.getTime() / 1000);

    const analyticsResponse = await docClient.send(new QueryCommand({
      TableName: 'ai-co-learner-learning-analytics',
      KeyConditionExpression: 'userId = :userId AND #timestamp > :start',
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp',
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':start': startTimestamp,
      },
    }));

    const analytics = analyticsResponse.Items || [];

    // 2-1. chat-sessions 데이터 조회 (최근 30일)
    const chatSessionsResponse = await docClient.send(new QueryCommand({
      TableName: 'ai-co-learner-chat-sessions',
      IndexName: 'userId-timestamp-index',
      KeyConditionExpression: 'userId = :userId AND #timestamp > :start',
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp',
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':start': startTimestamp,
      },
    }));

    const chatSessions = chatSessionsResponse.Items || [];

    // 2-2. user-bots 데이터 조회
    const userBotsResponse = await docClient.send(new QueryCommand({
      TableName: 'ai-co-learner-user-bots',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    }));

    const userBots = userBotsResponse.Items || [];

    // 3. 역량 히스토리 계산 (일별 평균)
    const dailyAverages = {};
    analytics.forEach(item => {
      const date = item.timestamp.split('T')[0];
      const scores = item.competencyScores || {};

      if (!dailyAverages[date]) {
        dailyAverages[date] = { date, competencies: {}, count: {} };
      }

      Object.entries(scores).forEach(([competency, score]) => {
        if (!dailyAverages[date].competencies[competency]) {
          dailyAverages[date].competencies[competency] = 0;
          dailyAverages[date].count[competency] = 0;
        }
        dailyAverages[date].competencies[competency] += score;
        dailyAverages[date].count[competency] += 1;
      });
    });

    const competencyHistory = Object.values(dailyAverages)
      .map(day => {
        const avgScores = {};
        Object.entries(day.competencies).forEach(([competency, total]) => {
          avgScores[competency] = Math.round(total / day.count[competency]);
        });
        return { date: day.date, competencies: avgScores };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    // 4. 각종 분석 수행
    const competencyAnalysis = Object.keys(competencies).length > 0
      ? analyzeCompetencies(competencies)
      : null;

    const activityAnalysis = analytics.length > 0
      ? analyzeLearningActivity(analytics)
      : null;

    const growthAnalysis = competencyHistory.length > 0
      ? analyzeGrowthTrend(competencyHistory)
      : null;

    // 4-1. 봇 선호도 분석
    const botPreferences = chatSessions.length > 0
      ? analyzeBotPreferences(chatSessions, userBots)
      : null;

    // 5. 인사이트 생성
    const insights = (competencyAnalysis && activityAnalysis && growthAnalysis)
      ? generateInsights(competencyAnalysis, activityAnalysis, growthAnalysis)
      : [];

    return {
      userId,
      analyzedAt: new Date().toISOString(),
      competencyAnalysis,
      activityAnalysis,
      growthAnalysis,
      botPreferences,
      insights,
      dataAvailable: analytics.length > 0,
    };
  } catch (error) {
    console.error('Error analyzing learning pattern:', error);
    throw error;
  }
}

// Lambda 핸들러
export const handler = async (event) => {
  console.log('Learning Pattern Analyzer started');

  try {
    // API Gateway 호출인 경우 (특정 사용자)
    if (event.httpMethod) {
      const pathParts = event.path.split('/');
      const userId = pathParts[pathParts.indexOf('analysis') + 1] ||
        pathParts[pathParts.length - 1];

      if (!userId || userId === 'analysis') {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ error: 'userId is required' }),
        };
      }

      const analysis = await analyzeLearningPattern(userId);

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(analysis),
      };
    }

    // 직접 호출인 경우
    const userId = event.userId;
    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'userId is required' }),
      };
    }

    const analysis = await analyzeLearningPattern(userId);

    return {
      statusCode: 200,
      body: JSON.stringify(analysis),
    };
  } catch (error) {
    console.error('Error in learning pattern analyzer:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Failed to analyze learning pattern',
        message: error.message,
      }),
    };
  }
};
