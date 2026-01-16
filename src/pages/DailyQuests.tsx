import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { QuestService, Quest, UserQuests } from '../services/awsBackend';
import { PageTransition } from '../components/layout/PageTransition';
import { logger } from '../utils/logger';

const DailyQuests: React.FC = () => {
  const { user } = useAuth();
  const [questsData, setQuestsData] = useState<UserQuests | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadQuests();

    // 30초마다 자동 새로고침 (진행도 업데이트 확인)
    const interval = setInterval(() => {
      loadQuests();
    }, 30000); // 30초

    return () => clearInterval(interval);
  }, [user]);

  const loadQuests = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);
      const data = await QuestService.getUserQuests(user.id);
      setQuestsData(data);
    } catch (err) {
      logger.error('Failed to load quests:', err);
      setError('퀘스트를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'text-green-600 bg-green-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'hard':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getQuestTypeLabel = (type: string) => {
    switch (type) {
      case 'conversation':
        return '대화';
      case 'challenge':
        return '도전';
      case 'reflection':
        return '성찰';
      default:
        return type;
    }
  };

  const getCompetencyLabel = (competency: string) => {
    const labels: Record<string, string> = {
      questionQuality: '질문력',
      thinkingDepth: '사고력',
      creativity: '창의력',
      communicationClarity: '소통력',
      executionOriented: '실행력',
      collaborationSignal: '협업력',
    };
    return labels[competency] || competency;
  };

  const calculateProgress = (quest: Quest) => {
    const messageProgress =
      (quest.progress.currentMessages / quest.completionCriteria.messageCount) * 100;
    const scoreProgress = (quest.progress.currentScore / quest.completionCriteria.minScore) * 100;
    return Math.min(Math.max(messageProgress, scoreProgress), 100);
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">퀘스트 불러오는 중...</p>
          </div>
        </div>
      </PageTransition>
    );
  }

  if (error) {
    return (
      <PageTransition>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800">{error}</p>
            <button
              onClick={loadQuests}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              다시 시도
            </button>
          </div>
        </div>
      </PageTransition>
    );
  }

  if (!questsData || !questsData.quests || questsData.quests.length === 0) {
    return (
      <PageTransition>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <p className="text-yellow-800 text-lg mb-2">오늘의 퀘스트가 아직 준비되지 않았습니다</p>
            <p className="text-yellow-600 text-sm">매일 오전 9시에 새로운 퀘스트가 생성됩니다</p>
          </div>
        </div>
      </PageTransition>
    );
  }

  const completedQuests = questsData.quests.filter(q => q.status === 'completed').length;
  const totalQuests = questsData.quests.length;

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">오늘의 퀘스트</h1>
          <p className="text-gray-600">
            {new Date().toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* 진행도 요약 */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-6 text-white mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-bold">
                {completedQuests} / {totalQuests}
              </h2>
              <p className="text-indigo-100">퀘스트 완료</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-indigo-100">오늘의 중점 역량</p>
              <p className="text-xl font-semibold">
                {getCompetencyLabel(questsData.targetCompetency)}
              </p>
            </div>
          </div>
          <div className="w-full bg-indigo-400 rounded-full h-3">
            <div
              className="bg-white rounded-full h-3 transition-all duration-500"
              style={{ width: `${(completedQuests / totalQuests) * 100}%` }}
            />
          </div>
        </div>

        {/* 퀘스트 카드 목록 */}
        <div className="space-y-4">
          {questsData.quests.map(quest => {
            const progress = calculateProgress(quest);
            const isCompleted = quest.status === 'completed';

            return (
              <div
                key={quest.questId}
                className={`bg-white rounded-lg shadow-md p-6 transition-all ${
                  isCompleted ? 'border-2 border-green-500' : 'border border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 text-xs font-semibold rounded bg-indigo-100 text-indigo-700">
                        {getQuestTypeLabel(quest.questType)}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${getDifficultyColor(quest.difficulty)}`}
                      >
                        {quest.difficulty.toUpperCase()}
                      </span>
                      <span className="px-2 py-1 text-xs font-semibold rounded bg-purple-100 text-purple-700">
                        {getCompetencyLabel(quest.targetCompetency)}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{quest.title}</h3>
                    <p className="text-gray-600 text-sm">{quest.description}</p>
                  </div>
                  {isCompleted && (
                    <div className="flex-shrink-0 ml-4">
                      <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>

                {/* 진행도 */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">진행도</span>
                    <span className="text-gray-900 font-semibold">{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        isCompleted ? 'bg-green-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* 완료 조건 */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-50 rounded p-3">
                    <p className="text-xs text-gray-600 mb-1">메시지 수</p>
                    <p className="text-lg font-bold text-gray-900">
                      {quest.progress.currentMessages} / {quest.completionCriteria.messageCount}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded p-3">
                    <p className="text-xs text-gray-600 mb-1">평균 점수</p>
                    <p className="text-lg font-bold text-gray-900">
                      {quest.progress.currentScore} / {quest.completionCriteria.minScore}
                    </p>
                  </div>
                </div>

                {/* 보상 */}
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-600 mb-2">보상</p>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-semibold rounded">
                      ⭐ {quest.rewards.xp} XP
                    </span>
                    {Object.entries(quest.rewards.competencyBoost).map(([competency, boost]) => (
                      <span
                        key={competency}
                        className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded"
                      >
                        📈 {getCompetencyLabel(competency)} +{boost}
                      </span>
                    ))}
                  </div>
                </div>

                {isCompleted && quest.completedAt && (
                  <div className="mt-4 text-sm text-green-600">
                    ✅ {new Date(quest.completedAt).toLocaleString('ko-KR')} 완료
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 하단 안내 */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm">
            💡 <strong>팁:</strong> AI 봇과 대화하면서 퀘스트가 자동으로 진행됩니다. 진행도는
            30초마다 자동으로 업데이트됩니다! (백엔드는 5분마다 분석)
          </p>
        </div>
      </div>
    </PageTransition>
  );
};

export default DailyQuests;
