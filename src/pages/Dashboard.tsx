import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBots } from '../contexts/BotContext';
import { CompetencyRadar } from '../components/dashboard/CompetencyRadar';
import { CompetencyGrowthChart } from '../components/dashboard/CompetencyGrowthChart';
import { LearningInsights } from '../components/dashboard/LearningInsights';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { BotService, UserService, AchievementService, Achievement } from '../services/awsBackend';
import { BotTemplate, SubscriptionTier, TIER_CONFIGS } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Plus,
  X,
  Rocket,
  Brain,
  Crown,
  Users,
  Trash2,
  ClipboardList,
  Target,
  Sparkles,
  Flame,
  Zap,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { logger } from '../utils/logger';

// Mapping theme colors to Tailwind classes
const colorMap: Record<string, string> = {
  blue: 'bg-blue-600',
  purple: 'bg-purple-600',
  green: 'bg-green-600',
  orange: 'bg-orange-600',
  pink: 'bg-pink-600',
  red: 'bg-red-600',
};

const bgMap: Record<string, string> = {
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  green: 'bg-green-500/10 text-green-400 border-green-500/20',
  orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  pink: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  red: 'bg-red-500/10 text-red-400 border-red-500/20',
};

// 역량 이름 매핑
const competencyNames: Record<string, string> = {
  questionQuality: '질문력',
  thinkingDepth: '사고력',
  creativity: '창의성',
  communicationClarity: '소통력',
  executionOriented: '실행력',
  collaborationSignal: '협업력',
};

// 배지 아이콘 매핑
const getAchievementIcon = (iconName: string) => {
  const icons: Record<string, React.ComponentType<any>> = {
    MessageSquare,
    Target,
    Crown,
    Brain,
    Sparkles,
    MessageCircle: MessageSquare,
    Rocket,
    Users,
    Flame,
  };
  return icons[iconName] || Crown;
};

// 배지 티어 색상
const getTierColor = (tier: string) => {
  switch (tier) {
    case 'gold':
      return 'text-yellow-400';
    case 'silver':
      return 'text-gray-400';
    case 'bronze':
      return 'text-orange-400';
    default:
      return 'text-gray-400';
  }
};

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { bots: myBots, loadBots } = useBots();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasCompetencies, setHasCompetencies] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const [templates, setTemplates] = useState<BotTemplate[]>([]);
  const [recommendedTemplates, setRecommendedTemplates] = useState<BotTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<BotTemplate | null>(null);
  const [newBotName, setNewBotName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [totalAchievements, setTotalAchievements] = useState(0);

  useEffect(() => {
    BotService.getTemplates().then(setTemplates);

    // 역량 데이터가 있는지 확인
    if (user) {
      UserService.getCompetencies(user.id).then(data => {
        setHasCompetencies(data !== null && data.competencies.length > 0);
      });

      // 추천 봇 조회
      BotService.getRecommendedTemplates(user.id).then(setRecommendedTemplates);

      // 배지 조회
      AchievementService.getUserAchievements(user.id).then(data => {
        if (data) {
          setAchievements(data.allAchievements);
          setTotalAchievements(data.totalAchievements);
        }
      });
    }
  }, [user]);

  const handleCreateBot = async () => {
    if (!user || !selectedTemplateId || !newBotName) return;
    setIsCreating(true);
    try {
      await BotService.createUserBot(user.id, selectedTemplateId, newBotName);
      await loadBots();
      setIsModalOpen(false);
      setNewBotName('');
      setSelectedTemplateId('');
    } finally {
      setIsCreating(false);
    }
  };

  // 추천 봇 빠른 생성 (이름만 입력)
  const handleQuickCreateRecommended = async (template: BotTemplate) => {
    setSelectedTemplate(template);
    setSelectedTemplateId(template.id);
    setIsQuickCreateOpen(true);
  };

  const handleQuickCreate = async () => {
    if (!user || !selectedTemplateId || !newBotName || !selectedTemplate) {
      logger.error('Missing required data for bot creation', {
        user: !!user,
        selectedTemplateId,
        newBotName,
        selectedTemplate: !!selectedTemplate,
      });
      return;
    }
    setIsCreating(true);
    try {
      logger.debug('Creating bot:', {
        userId: user.id,
        templateId: selectedTemplateId,
        name: newBotName,
      });
      await BotService.createUserBot(user.id, selectedTemplateId, newBotName);
      await loadBots();
      setIsQuickCreateOpen(false);
      setNewBotName('');
      setSelectedTemplateId('');
      setSelectedTemplate(null);
    } catch (error) {
      logger.error('Failed to create bot:', error);
      alert(
        `봇 생성에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteBot = async (botId: string, botName: string) => {
    if (!user) return;

    const confirmed = window.confirm(
      `"${botName}" 봇을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 모든 대화 내역이 함께 삭제됩니다.`
    );

    if (!confirmed) return;

    try {
      await BotService.deleteUserBot(user.id, botId);
      await loadBots();
    } catch (error) {
      logger.error('Failed to delete bot:', error);
      alert('봇 삭제에 실패했습니다.');
    }
  };

  if (!user) return null;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#121212] text-white relative">
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            AI Co-Learner <span className="text-primary">✨</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">의도적 제약을 통한 사고력 확장 플랫폼</p>
        </div>

        {/* User Profile Pill */}
        <div className="flex items-center bg-[#1E1E1E] border border-[#333] rounded-full pr-4 pl-1 py-1 gap-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold text-white text-sm">
            {user.name.charAt(0)}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white">{user.name}</span>
            <span className="text-[10px] text-primary">
              {user.title || `Lv.${user.level} 학습자`}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN (Subscription, Radar & Badges) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Subscription Widget */}
          {user.subscriptionTier !== SubscriptionTier.UNLIMITED && (
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-6 border border-primary/20">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/20">
                    <Zap className="text-primary" size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">구독 플랜</h3>
                    <p className="text-xs text-gray-400">
                      {TIER_CONFIGS[user.subscriptionTier]?.displayName || user.subscriptionTier}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-bold ${TIER_CONFIGS[user.subscriptionTier]?.colorClass || 'bg-gray-500'} text-white`}
                >
                  {user.subscriptionTier}
                </span>
              </div>

              {/* Message Quota Progress */}
              {user.messageQuota && (
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-400">메시지 사용량</span>
                    <span className="text-xs font-bold text-white">
                      {user.messageQuota.currentMonthUsage} / {user.messageQuota.monthlyLimit}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        (user.messageQuota.currentMonthUsage / user.messageQuota.monthlyLimit) *
                          100 >=
                        90
                          ? 'bg-error'
                          : (user.messageQuota.currentMonthUsage / user.messageQuota.monthlyLimit) *
                                100 >=
                              70
                            ? 'bg-amber-500'
                            : 'bg-primary'
                      } transition-all`}
                      style={{
                        width: `${Math.min((user.messageQuota.currentMonthUsage / user.messageQuota.monthlyLimit) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {Math.round(
                      (user.messageQuota.currentMonthUsage / user.messageQuota.monthlyLimit) * 100
                    )}
                    % 사용
                  </p>
                </div>
              )}

              {/* Trial Period Countdown */}
              {user.subscriptionTier === SubscriptionTier.TRIAL && user.trialPeriod && (
                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock size={14} className="text-blue-400" />
                    <span className="text-xs font-bold text-blue-400">체험 기간</span>
                  </div>
                  <p className="text-sm text-white font-bold">
                    {user.trialPeriod.daysRemaining}일 남음
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(user.trialPeriod.endDate).toLocaleDateString('ko-KR')}까지
                  </p>
                </div>
              )}

              {/* Features List */}
              <div className="mb-4 space-y-1">
                {TIER_CONFIGS[user.subscriptionTier]?.features.slice(0, 3).map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-gray-300">
                    <TrendingUp size={12} className="text-primary" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              {/* Upgrade Button */}
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="w-full py-2 px-4 bg-primary hover:bg-primary-hover text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Zap size={16} />
                플랜 업그레이드
              </button>
            </div>
          )}

          {/* Radar Chart Card */}
          <div className="bg-[#1E1E1E] rounded-xl p-6 border border-[#333]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-200">핵심 역량 분석</h3>
              {hasCompetencies && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/assessment')}
                  className="gap-2 text-xs"
                >
                  <ClipboardList size={14} />
                  재진단
                </Button>
              )}
            </div>
            {!hasCompetencies ? (
              <div className="text-center py-8">
                <ClipboardList className="mx-auto mb-4 text-gray-500" size={48} />
                <p className="text-sm text-gray-400 mb-4">
                  아직 역량 진단을 완료하지 않으셨습니다.
                  <br />
                  진단을 통해 맞춤형 학습 경로를 받아보세요!
                </p>
                <Button size="sm" onClick={() => navigate('/assessment')} className="gap-2">
                  <ClipboardList size={16} />
                  진단 시작하기
                </Button>
              </div>
            ) : (
              <CompetencyRadar userId={user?.id || ''} />
            )}
          </div>

          {/* Competency Growth Chart */}
          {hasCompetencies && (
            <div className="bg-[#1E1E1E] rounded-xl p-6 border border-[#333]">
              <CompetencyGrowthChart userId={user?.id || ''} days={30} />
            </div>
          )}

          {/* Learning Insights */}
          {hasCompetencies && (
            <div className="bg-[#1E1E1E] rounded-xl p-6 border border-[#333]">
              <LearningInsights userId={user?.id || ''} />
            </div>
          )}

          {/* Badges Card */}
          <div className="bg-[#1E1E1E] rounded-xl p-6 border border-[#333]">
            <h3 className="font-bold text-gray-200 mb-4 flex items-center gap-2">
              <Crown className="text-yellow-500" size={18} />
              배지 ({achievements.filter(a => a.unlocked).length}/{totalAchievements})
            </h3>

            {achievements.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <p className="mb-2">아직 배지 정보가 없습니다</p>
                <p className="text-sm">AI 봇과 대화하면서 배지를 획득해보세요!</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {achievements
                  .sort((a, b) => {
                    // 먼저 획득한 배지, 그 다음 진행중인 배지, 마지막으로 잠긴 배지
                    if (a.unlocked && !b.unlocked) return -1;
                    if (!a.unlocked && b.unlocked) return 1;
                    if (!a.unlocked && !b.unlocked) {
                      return (b.progress || 0) - (a.progress || 0);
                    }
                    return 0;
                  })
                  .map(achievement => {
                    const IconComponent = getAchievementIcon(achievement.icon);
                    const isUnlocked = achievement.unlocked;
                    const progress = achievement.progress || 0;
                    const hasProgress = !isUnlocked && progress > 0;

                    return (
                      <div
                        key={achievement.id}
                        className={`flex items-center gap-4 ${!isUnlocked ? 'opacity-50' : ''}`}
                      >
                        <div
                          className={`w-10 h-10 rounded-lg bg-[#2A2A2A] flex items-center justify-center ${!isUnlocked ? 'grayscale' : ''}`}
                        >
                          <IconComponent className={getTierColor(achievement.tier)} size={20} />
                        </div>
                        <div className="flex-1">
                          <div
                            className={`text-sm font-bold ${isUnlocked ? 'text-gray-200' : 'text-gray-400'}`}
                          >
                            {achievement.name}
                          </div>
                          {isUnlocked ? (
                            <div className="text-xs text-green-400 font-medium">획득 완료!</div>
                          ) : hasProgress ? (
                            <div className="space-y-1">
                              <div className="h-1.5 w-full bg-[#333] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <div className="text-[10px] text-gray-500">{progress}%</div>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">잠김</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (Bot Selection) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Recommended Bots Section */}
          {recommendedTemplates.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Rocket className="text-primary" size={20} />
                <h2 className="text-lg font-bold text-gray-100">당신을 위한 추천 봇</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {recommendedTemplates.map(template => {
                  const bgColorClass = colorMap[template.themeColor || 'blue'] || 'bg-blue-600';

                  return (
                    <div
                      key={template.id}
                      className="bg-[#1E1E1E] border-2 border-primary/30 rounded-xl p-5 hover:border-primary transition-all relative"
                    >
                      <div className="absolute top-2 right-2">
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold">
                          추천
                        </span>
                      </div>

                      <div
                        className={`w-10 h-10 rounded-full ${bgColorClass} flex items-center justify-center text-white font-bold mb-3 shadow-lg`}
                      >
                        {template.name.charAt(0)}
                      </div>

                      <h3 className="text-base font-bold text-white mb-2">{template.name}</h3>

                      {template.primaryCompetencies && template.primaryCompetencies.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {template.primaryCompetencies.map(comp => (
                            <span
                              key={comp}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20"
                            >
                              {competencyNames[comp] || comp}
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="text-xs text-gray-400 mb-4 line-clamp-2">
                        {template.description}
                      </p>

                      <button
                        onClick={() => handleQuickCreateRecommended(template)}
                        className="w-full py-2 text-xs font-medium bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                      >
                        생성하기
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-between items-end mb-4">
            <h2 className="text-lg font-bold text-gray-100">학습 파트너 선택</h2>
            <button className="text-xs text-primary hover:text-primary-hover transition-colors">
              모두 보기
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
            {myBots.map(bot => {
              const bgColorClass = colorMap[bot.themeColor || 'blue'] || 'bg-blue-600';
              const labelClass = bgMap[bot.themeColor || 'blue'] || bgMap['blue'];

              return (
                <div
                  key={bot.id}
                  className="bg-[#1E1E1E] border border-[#333] rounded-xl p-6 hover:border-primary/50 transition-all group relative overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div
                      className={`w-12 h-12 rounded-full ${bgColorClass} flex items-center justify-center text-white font-bold text-lg shadow-lg`}
                    >
                      {bot.name.charAt(0)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono bg-[#121212] border border-[#333] px-2 py-1 rounded text-gray-400">
                        Lv.{bot.currentLevel}
                      </span>
                      <button
                        onClick={e => {
                          e.preventDefault();
                          handleDeleteBot(bot.id, bot.name);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400"
                        title="봇 삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-white mb-1">{bot.name}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${labelClass}`}>
                        {bot.templateName}
                      </span>
                    </div>

                    {bot.primaryCompetencies && bot.primaryCompetencies.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {bot.primaryCompetencies.map(comp => (
                          <span
                            key={comp}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-400 border border-gray-500/20"
                          >
                            {competencyNames[comp] || comp}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                      {bot.description}
                    </p>
                  </div>

                  <Link to={`/chat/${bot.id}`}>
                    <button className="flex items-center gap-2 text-xs font-bold text-gray-300 group-hover:text-white transition-colors mt-2">
                      <MessageSquare size={14} />
                      대화하기
                    </button>
                  </Link>
                </div>
              );
            })}

            {/* Placeholder Card */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="border border-dashed border-[#333] bg-[#121212] rounded-xl p-6 flex flex-col items-center justify-center text-gray-600 hover:text-gray-400 hover:border-gray-500 transition-all min-h-[240px]"
            >
              <Plus size={32} className="mb-3 opacity-50" />
              <span className="text-sm font-medium">새로운 에이전트 준비중...</span>
            </button>
          </div>
        </div>
      </div>

      {/* QUICK CREATE MODAL (추천 봇 빠른 생성) */}
      {isQuickCreateOpen && selectedTemplate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1A1A1A] border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">{selectedTemplate.name} 생성</h2>
              <button
                onClick={() => {
                  setIsQuickCreateOpen(false);
                  setNewBotName('');
                  setSelectedTemplate(null);
                  setSelectedTemplateId('');
                }}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-400 mb-4">{selectedTemplate.description}</p>
                {selectedTemplate.primaryCompetencies &&
                  selectedTemplate.primaryCompetencies.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {selectedTemplate.primaryCompetencies.map(comp => (
                        <span
                          key={comp}
                          className="text-xs px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20"
                        >
                          {competencyNames[comp] || comp}
                        </span>
                      ))}
                    </div>
                  )}
              </div>

              <Input
                label="에이전트 이름"
                placeholder={`나만의 ${selectedTemplate.name}`}
                value={newBotName}
                onChange={e => setNewBotName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="p-6 border-t border-border flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsQuickCreateOpen(false);
                  setNewBotName('');
                  setSelectedTemplate(null);
                  setSelectedTemplateId('');
                }}
              >
                취소
              </Button>
              <Button onClick={handleQuickCreate} disabled={!newBotName || isCreating}>
                {isCreating ? '생성 중...' : '생성하기'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE BOT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#1A1A1A] border border-border rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] my-4">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">새 파트너 추가</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-6">
                <Input
                  label="에이전트 이름"
                  placeholder="나의 전담 코치"
                  value={newBotName}
                  onChange={e => setNewBotName(e.target.value)}
                  autoFocus
                />
              </div>

              <label className="block text-xs font-medium text-gray-400 mb-3">템플릿 선택</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {templates.map(tmpl => {
                  const labelClass = bgMap[tmpl.themeColor || 'blue'] || bgMap['blue'];
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => setSelectedTemplateId(tmpl.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedTemplateId === tmpl.id
                          ? 'bg-[#252525] border-primary ring-1 ring-primary'
                          : 'bg-[#1E1E1E] border-[#333] hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-white">{tmpl.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${labelClass}`}>
                          {tmpl.name}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-2">{tmpl.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 border-t border-border flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                취소
              </Button>
              <Button
                onClick={handleCreateBot}
                disabled={!newBotName || !selectedTemplateId || isCreating}
              >
                {isCreating ? '생성 중...' : '추가하기'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Contact Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 rounded-full bg-primary/20">
                <Zap className="text-primary" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2">플랜 업그레이드 문의</h3>
                <p className="text-sm text-gray-300">
                  더 많은 메시지와 기능을 사용하고 싶으신가요?
                  <br />
                  관리자에게 문의해주세요.
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6 bg-background/50 p-4 rounded-lg">
              <div>
                <p className="text-xs text-gray-400 mb-1">현재 티어</p>
                <p className="text-sm text-white font-bold">{user.subscriptionTier}</p>
              </div>
              {user.messageQuota && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">사용량</p>
                  <p className="text-sm text-white font-bold">
                    {user.messageQuota.currentMonthUsage} /{' '}
                    {user.messageQuota.monthlyLimit === -1
                      ? '무제한'
                      : user.messageQuota.monthlyLimit}
                  </p>
                </div>
              )}
              <div className="pt-3 border-t border-border">
                <p className="text-xs text-gray-400 mb-2">문의 방법</p>
                <p className="text-sm text-white">
                  관리자에게 직접 연락하여 플랜 업그레이드를 요청하세요.
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  관리자가 귀하의 계정을 원하는 티어로 변경해드립니다.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="flex-1 px-4 py-2 bg-surface border border-border text-white rounded-lg hover:bg-border/20 transition-colors"
              >
                닫기
              </button>
              <button
                onClick={() => {
                  setShowUpgradeModal(false);
                }}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-bold"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
