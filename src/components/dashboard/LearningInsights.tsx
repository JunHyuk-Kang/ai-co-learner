import React, { useEffect, useState } from 'react';
import { LearningAnalysisService, LearningAnalysis } from '../../services/awsBackend';
import { TrendingUp, TrendingDown, AlertCircle, Award, Zap, Lightbulb } from 'lucide-react';
import { logger } from '../../utils/logger';

interface LearningInsightsProps {
  userId: string;
}

const getInsightIcon = (type: string) => {
  switch (type) {
    case 'strength':
      return Award;
    case 'weakness':
      return Lightbulb;
    case 'growth':
      return TrendingUp;
    case 'alert':
      return AlertCircle;
    case 'pattern':
      return Zap;
    case 'achievement':
      return Award;
    default:
      return Lightbulb;
  }
};

const getInsightColor = (type: string) => {
  switch (type) {
    case 'strength':
      return 'text-green-400';
    case 'weakness':
      return 'text-yellow-400';
    case 'growth':
      return 'text-blue-400';
    case 'alert':
      return 'text-red-400';
    case 'pattern':
      return 'text-purple-400';
    case 'achievement':
      return 'text-green-400';
    default:
      return 'text-gray-400';
  }
};

const getPriorityBadge = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'bg-red-500/10 text-red-400 border-red-500/20';
    case 'medium':
      return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    case 'low':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    default:
      return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  }
};

export const LearningInsights: React.FC<LearningInsightsProps> = ({ userId }) => {
  const [analysis, setAnalysis] = useState<LearningAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalysis();
  }, [userId]);

  const loadAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await LearningAnalysisService.getAnalysis(userId);
      setAnalysis(data);
    } catch (err) {
      logger.error('Failed to load learning analysis:', err);
      setError('학습 분석 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-400 py-8">{error}</div>;
  }

  if (!analysis || !analysis.dataAvailable) {
    return (
      <div>
        <h2 className="text-xl font-bold text-gray-200 mb-4">학습 인사이트</h2>
        <div className="text-center text-gray-400 py-12">
          <p className="mb-2">아직 충분한 데이터가 없습니다</p>
          <p className="text-sm">AI 봇과 대화하면서 데이터가 쌓이면 맞춤형 인사이트를 제공합니다</p>
        </div>
      </div>
    );
  }

  const { competencyAnalysis, activityAnalysis, growthAnalysis, insights } = analysis;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-200 mb-6">학습 인사이트</h2>

      {/* 인사이트 카드들 */}
      {insights.length > 0 && (
        <div className="space-y-4 mb-8">
          {insights.map((insight, index) => {
            const IconComponent = getInsightIcon(insight.type);
            const iconColor = getInsightColor(insight.type);
            const priorityBadge = getPriorityBadge(insight.priority);

            return (
              <div
                key={index}
                className="bg-[#2A2A2A] rounded-lg p-4 border border-[#333] hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${iconColor}`}>
                    <IconComponent size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-200">{insight.title}</h3>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border ${priorityBadge} font-semibold uppercase`}
                      >
                        {insight.priority}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">{insight.message}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 상세 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 역량 분석 */}
        {competencyAnalysis && (
          <div className="bg-[#2A2A2A] rounded-lg p-4 border border-[#333]">
            <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
              <Award size={16} className="text-green-400" />
              역량 분석
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">평균 점수</span>
                <span className="text-sm font-bold text-gray-200">
                  {competencyAnalysis.avgScore}점
                </span>
              </div>
              {competencyAnalysis.strengths.length > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">강점</span>
                  <span className="text-xs font-semibold text-green-400">
                    {competencyAnalysis.strengths.length}개
                  </span>
                </div>
              )}
              {competencyAnalysis.weaknesses.length > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">개선 기회</span>
                  <span className="text-xs font-semibold text-yellow-400">
                    {competencyAnalysis.weaknesses.length}개
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 활동 패턴 */}
        {activityAnalysis && (
          <div className="bg-[#2A2A2A] rounded-lg p-4 border border-[#333]">
            <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
              <Zap size={16} className="text-purple-400" />
              활동 패턴
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">총 메시지</span>
                <span className="text-sm font-bold text-gray-200">
                  {activityAnalysis.totalMessages}개
                </span>
              </div>
              {activityAnalysis.peakHours.length > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">주 활동 시간</span>
                  <span className="text-xs font-semibold text-purple-400">
                    {activityAnalysis.peakHours[0].hour}시
                  </span>
                </div>
              )}
              {activityAnalysis.peakDays.length > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">주 활동 요일</span>
                  <span className="text-xs font-semibold text-purple-400">
                    {activityAnalysis.peakDays[0].dayName}요일
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 성장 추세 */}
        {growthAnalysis && (
          <div className="bg-[#2A2A2A] rounded-lg p-4 border border-[#333]">
            <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
              {growthAnalysis.trend === 'improving' ? (
                <TrendingUp size={16} className="text-blue-400" />
              ) : (
                <TrendingDown size={16} className="text-orange-400" />
              )}
              성장 추세
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">전체 성장률</span>
                <span
                  className={`text-sm font-bold ${growthAnalysis.growthRate >= 0 ? 'text-green-400' : 'text-red-400'}`}
                >
                  {growthAnalysis.growthRate >= 0 ? '+' : ''}
                  {growthAnalysis.growthRate}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">분석 기간</span>
                <span className="text-xs font-semibold text-gray-400">
                  {growthAnalysis.daysCovered}일
                </span>
              </div>
              {growthAnalysis.improvingCompetencies.length > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">개선 역량</span>
                  <span className="text-xs font-semibold text-green-400">
                    {growthAnalysis.improvingCompetencies.length}개
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
