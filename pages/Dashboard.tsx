import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBots } from '../contexts/BotContext';
import { CompetencyRadar } from '../components/dashboard/CompetencyRadar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { BotService } from '../services/awsBackend';
import { BotTemplate } from '../types';
import { Link } from 'react-router-dom';
import { MessageSquare, Plus, X, Rocket, Brain, Crown, Users, Trash2 } from 'lucide-react';

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

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { bots: myBots, loadBots } = useBots();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [templates, setTemplates] = useState<BotTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [newBotName, setNewBotName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    BotService.getTemplates().then(setTemplates);
  }, []);

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
      console.error('Failed to delete bot:', error);
      alert('봇 삭제에 실패했습니다.');
    }
  };

  if (!user) return null;

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#121212] text-white relative">
      
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
                <span className="text-[10px] text-primary">{user.title || `Lv.${user.level} 학습자`}</span>
            </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN (Radar & Badges) */}
        <div className="lg:col-span-4 space-y-6">
            
            {/* Radar Chart Card */}
            <div className="bg-[#1E1E1E] rounded-xl p-6 border border-[#333]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-200">핵심 역량 분석</h3>
                </div>
                <CompetencyRadar userId={user?.id || ''} />
            </div>

            {/* Badges Card */}
            <div className="bg-[#1E1E1E] rounded-xl p-6 border border-[#333]">
                <h3 className="font-bold text-gray-200 mb-4 flex items-center gap-2">
                    <Crown className="text-yellow-500" size={18} />
                    Master Badges
                </h3>
                
                <div className="space-y-5">
                    {/* Badge 1: Completed */}
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-[#2A2A2A] flex items-center justify-center">
                            <Rocket className="text-white" size={20} />
                        </div>
                        <div className="flex-1">
                            <div className="text-sm font-bold text-gray-200">Innovation Master</div>
                            <div className="text-xs text-green-400 font-medium">획득 완료!</div>
                        </div>
                    </div>

                    {/* Badge 2: In Progress */}
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-[#2A2A2A] flex items-center justify-center">
                            <Brain className="text-pink-400" size={20} />
                        </div>
                        <div className="flex-1">
                            <div className="text-sm font-bold text-gray-200 mb-1.5">Deep Thinker</div>
                            <div className="h-1.5 w-full bg-[#333] rounded-full overflow-hidden">
                                <div className="h-full bg-primary w-[70%] rounded-full" />
                            </div>
                        </div>
                    </div>

                     {/* Badge 3: In Progress */}
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-[#2A2A2A] flex items-center justify-center">
                            <Crown className="text-yellow-400" size={20} />
                        </div>
                        <div className="flex-1">
                            <div className="text-sm font-bold text-gray-200 mb-1.5">Question King</div>
                            <div className="h-1.5 w-full bg-[#333] rounded-full overflow-hidden">
                                <div className="h-full bg-primary w-[40%] rounded-full" />
                            </div>
                        </div>
                    </div>

                    {/* Badge 4: Locked */}
                    <div className="flex items-center gap-4 opacity-50 grayscale">
                        <div className="w-10 h-10 rounded-lg bg-[#2A2A2A] flex items-center justify-center">
                            <Users className="text-gray-400" size={20} />
                        </div>
                        <div className="flex-1">
                            <div className="text-sm font-bold text-gray-400">Team Player</div>
                            <div className="text-xs text-gray-500">잠김</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* RIGHT COLUMN (Bot Selection) */}
        <div className="lg:col-span-8">
            <div className="flex justify-between items-end mb-4">
                <h2 className="text-lg font-bold text-gray-100">학습 파트너 선택</h2>
                <button className="text-xs text-primary hover:text-primary-hover transition-colors">모두 보기</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myBots.map(bot => {
                    const bgColorClass = colorMap[bot.themeColor || 'blue'] || 'bg-blue-600';
                    const labelClass = bgMap[bot.themeColor || 'blue'] || bgMap['blue'];

                    return (
                        <div key={bot.id} className="bg-[#1E1E1E] border border-[#333] rounded-xl p-6 hover:border-primary/50 transition-all group relative overflow-hidden">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`w-12 h-12 rounded-full ${bgColorClass} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                                    {bot.name.charAt(0)}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono bg-[#121212] border border-[#333] px-2 py-1 rounded text-gray-400">
                                        Lv.{bot.currentLevel}
                                    </span>
                                    <button
                                        onClick={(e) => {
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
                                <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${labelClass}`}>
                                    {bot.templateName}
                                </span>
                                <p className="text-xs text-gray-400 mt-3 line-clamp-2 leading-relaxed">
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

      {/* CREATE BOT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1A1A1A] border border-border rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-border flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">새 파트너 추가</h2>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1">
                    <div className="mb-6">
                        <Input 
                            label="에이전트 이름" 
                            placeholder="나의 전담 코치" 
                            value={newBotName}
                            onChange={(e) => setNewBotName(e.target.value)}
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
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${labelClass}`}>{tmpl.name}</span>
                                    </div>
                                    <p className="text-xs text-gray-400 line-clamp-2">{tmpl.description}</p>
                                </div>
                             )
                        })}
                    </div>
                </div>

                <div className="p-6 border-t border-border flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => setIsModalOpen(false)}>취소</Button>
                    <Button onClick={handleCreateBot} disabled={!newBotName || !selectedTemplateId || isCreating}>
                        {isCreating ? '생성 중...' : '추가하기'}
                    </Button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};