import React, { useEffect, useState } from 'react';
import { BotService, AdminService, UsageStatsResponse } from '../services/awsBackend';
import { BotTemplate, User, Role } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Plus, Trash2, Save, Users, Bot, Search, Edit, DollarSign, TrendingUp, Activity } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuth } from '../contexts/AuthContext';

export const AdminPanel: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [view, setView] = useState<'templates' | 'users' | 'usage'>('templates');
  const [templates, setTemplates] = useState<BotTemplate[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStatsResponse | null>(null);
  const [usageDays, setUsageDays] = useState<number>(30);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BotTemplate | null>(null);

  // User editing state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserOrganization, setEditUserOrganization] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');

  // Template Form State
  const [newName, setNewName] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newThemeColor, setNewThemeColor] = useState<string>('blue');
  const [newBaseType, setNewBaseType] = useState<string>('coaching');
  const [newPrimaryCompetencies, setNewPrimaryCompetencies] = useState<string[]>([]);
  const [newSecondaryCompetencies, setNewSecondaryCompetencies] = useState<string[]>([]);
  const [newRecommendedFor, setNewRecommendedFor] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    loadData();
  }, [view]);

  const loadData = async () => {
    if (!currentUser) return;

    if (view === 'templates') {
        BotService.getTemplates().then(setTemplates);
    } else if (view === 'users' && currentUser.role === Role.ADMIN) {
        AdminService.getAllUsers(currentUser.id).then((users: any[]) => {
          // Convert userId to id for frontend compatibility
          const convertedUsers = users.map(u => ({
            ...u,
            id: u.userId || u.id,
          }));
          setUsers(convertedUsers);
        });
    } else if (view === 'usage' && currentUser.role === Role.ADMIN) {
        loadUsageStats();
    }
  };

  const loadUsageStats = async () => {
    if (!currentUser) return;
    try {
      const stats = await AdminService.getUsageStats(currentUser.id, { days: usageDays });
      setUsageStats(stats);
    } catch (error) {
      console.error('Failed to load usage stats:', error);
    }
  };

  const handleCreate = async () => {
    if (!currentUser || !newName || !newPrompt) return;
    try {
      const newTmpl = await BotService.createTemplate(currentUser.id, {
          name: newName,
          description: newDesc,
          systemPrompt: newPrompt,
          themeColor: newThemeColor,
          baseType: newBaseType,
          primaryCompetencies: newPrimaryCompetencies,
          secondaryCompetencies: newSecondaryCompetencies,
          recommendedFor: {
            competencyBelow: newRecommendedFor
          }
      });
      await loadData();
      setIsCreating(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create template:', error);
      alert('템플릿 생성에 실패했습니다.');
    }
  };

  const handleEdit = (template: BotTemplate) => {
    setEditingTemplate(template);
    setNewName(template.name);
    setNewDesc(template.description || '');
    setNewPrompt(template.systemPrompt);
    setNewThemeColor(template.themeColor || 'blue');
    setNewBaseType(template.baseType || 'coaching');
    setNewPrimaryCompetencies(template.primaryCompetencies || []);
    setNewSecondaryCompetencies(template.secondaryCompetencies || []);
    setNewRecommendedFor(template.recommendedFor?.competencyBelow || {});
    setIsEditing(true);
  };

  const handleUpdate = async () => {
    if (!currentUser || !editingTemplate || !newName || !newPrompt) return;
    try {
      await BotService.updateTemplate(currentUser.id, editingTemplate.id, {
        name: newName,
        description: newDesc,
        systemPrompt: newPrompt,
        themeColor: newThemeColor,
        baseType: newBaseType,
        primaryCompetencies: newPrimaryCompetencies,
        secondaryCompetencies: newSecondaryCompetencies,
        recommendedFor: {
          competencyBelow: newRecommendedFor
        }
      });
      await loadData();
      setIsEditing(false);
      setEditingTemplate(null);
      resetForm();
    } catch (error) {
      console.error('Failed to update template:', error);
      alert('템플릿 수정에 실패했습니다.');
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!currentUser || !confirm('정말 이 템플릿을 삭제하시겠습니까?')) return;
    try {
      await BotService.deleteTemplate(currentUser.id, templateId);
      await loadData();
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert('템플릿 삭제에 실패했습니다.');
    }
  };

  const resetForm = () => {
    setNewName('');
    setNewPrompt('');
    setNewDesc('');
    setNewThemeColor('blue');
    setNewBaseType('coaching');
    setNewPrimaryCompetencies([]);
    setNewSecondaryCompetencies([]);
    setNewRecommendedFor({});
  };

  // Competency toggle helpers
  const COMPETENCIES = [
    { key: 'questionQuality', label: '질문력' },
    { key: 'thinkingDepth', label: '사고력' },
    { key: 'creativity', label: '창의력' },
    { key: 'communicationClarity', label: '소통력' },
    { key: 'executionOriented', label: '실행력' },
    { key: 'collaborationSignal', label: '협업력' },
  ];

  const toggleCompetency = (list: string[], setList: (val: string[]) => void, key: string) => {
    if (list.includes(key)) {
      setList(list.filter(c => c !== key));
    } else {
      setList([...list, key]);
    }
  };

  const updateRecommendThreshold = (competency: string, value: string) => {
    const numValue = parseInt(value);
    if (isNaN(numValue) || value === '') {
      const newRec = { ...newRecommendedFor };
      delete newRec[competency];
      setNewRecommendedFor(newRec);
    } else {
      setNewRecommendedFor({ ...newRecommendedFor, [competency]: numValue });
    }
  };

  const cancelEdit = () => {
    setIsCreating(false);
    setIsEditing(false);
    setEditingTemplate(null);
    resetForm();
  };

  const handleBlockUser = async (userId: string, currentlyBlocked: boolean) => {
    try {
      await AdminService.blockUser(userId, !currentlyBlocked);
      await loadData();
    } catch (error) {
      console.error('Failed to block/unblock user:', error);
      alert('사용자 상태 변경에 실패했습니다.');
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    if (!currentUser) return;
    try {
      await AdminService.updateUserRole(currentUser.id, userId, newRole);
      await loadData();
      alert(`권한이 ${newRole}로 변경되었습니다.`);
    } catch (error) {
      console.error('Failed to update user role:', error);
      alert('사용자 역할 변경에 실패했습니다: ' + (error as Error).message);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditUserName(user.name);
    setEditUserOrganization(user.organization || '');
  };

  const handleUpdateUserInfo = async () => {
    if (!editingUser) return;

    try {
      await AdminService.updateUserInfo(editingUser.id, editUserName, editUserOrganization, editUserPassword || undefined);
      await loadData();
      setEditingUser(null);
      setEditUserName('');
      setEditUserOrganization('');
      setEditUserPassword('');
      alert('사용자 정보가 성공적으로 업데이트되었습니다.');
    } catch (error) {
      console.error('Failed to update user info:', error);
      alert('사용자 정보 업데이트에 실패했습니다: ' + (error as Error).message);
    }
  };

  const cancelUserEdit = () => {
    setEditingUser(null);
    setEditUserName('');
    setEditUserOrganization('');
    setEditUserPassword('');
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#121212]">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold text-white mb-2">관리자 패널</h1>
            <p className="text-gray-400">
                {view === 'templates' ? '봇 템플릿 및 시스템 프롬프트 관리' : '플랫폼 전체 사용자 관리'}
            </p>
        </div>
        <div className="flex bg-surface p-1 rounded-lg border border-border w-full md:w-auto">
             <button
                onClick={() => setView('templates')}
                className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-all ${view === 'templates' ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
             >
                <Bot size={16} className="inline mr-1 md:mr-2" />
                봇 템플릿
             </button>
             {currentUser?.role === Role.ADMIN && (
               <>
                 <button
                    onClick={() => setView('users')}
                    className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-all ${view === 'users' ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                 >
                    <Users size={16} className="inline mr-1 md:mr-2" />
                    사용자 관리
                 </button>
                 <button
                    onClick={() => setView('usage')}
                    className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-all ${view === 'usage' ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                 >
                    <DollarSign size={16} className="inline mr-1 md:mr-2" />
                    사용량 & 비용
                 </button>
               </>
             )}
        </div>
      </header>

      {/* --- TEMPLATES VIEW --- */}
      {view === 'templates' && (
        <>
            <div className="mb-6 flex justify-end">
                 <Button onClick={() => setIsCreating(true)}>
                    <Plus size={16} className="mr-2" />
                    템플릿 생성
                 </Button>
            </div>

            {(isCreating || isEditing) && (
                <Card className="mb-8 border-primary/50 bg-primary/5 animate-in fade-in slide-in-from-top-4">
                    <div className="space-y-4">
                        <h3 className="font-bold text-white">{isEditing ? '봇 템플릿 수정' : '새 봇 템플릿 생성'}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="이름" value={newName} onChange={e => setNewName(e.target.value)} placeholder="예: 창의력 마스터" />
                            <Input label="설명" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="간단한 설명" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1.5">Theme Color</label>
                                <select
                                    className="w-full bg-[#121212] border border-border rounded-lg p-2 text-sm text-gray-200 focus:outline-none focus:border-primary"
                                    value={newThemeColor}
                                    onChange={e => setNewThemeColor(e.target.value)}
                                >
                                    <option value="blue">Blue</option>
                                    <option value="purple">Purple</option>
                                    <option value="green">Green</option>
                                    <option value="orange">Orange</option>
                                    <option value="pink">Pink</option>
                                    <option value="red">Red</option>
                                    <option value="teal">Teal</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1.5">Base Type</label>
                                <select
                                    className="w-full bg-[#121212] border border-border rounded-lg p-2 text-sm text-gray-200 focus:outline-none focus:border-primary"
                                    value={newBaseType}
                                    onChange={e => setNewBaseType(e.target.value)}
                                >
                                    <option value="coaching">Coaching</option>
                                    <option value="questioning">Questioning</option>
                                    <option value="reflective">Reflective</option>
                                    <option value="supportive">Supportive</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5">System Prompt (Core Logic)</label>
                            <textarea
                                className="w-full h-32 bg-[#121212] border border-border rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-primary font-mono"
                                value={newPrompt}
                                onChange={e => setNewPrompt(e.target.value)}
                                placeholder="여기에 시스템 프롬프트를 입력하세요. 에이전트의 행동 제약사항을 포함해야 합니다."
                            />
                        </div>

                        {/* 역량 설정 섹션 */}
                        <div className="space-y-4 p-4 bg-[#121212] rounded-lg border border-border">
                            <h4 className="text-sm font-semibold text-white">역량 설정 및 추천 조건</h4>

                            {/* 주요 육성 역량 */}
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-2">주요 육성 역량 (Primary Competencies)</label>
                                <div className="flex flex-wrap gap-2">
                                    {COMPETENCIES.map(comp => (
                                        <button
                                            key={comp.key}
                                            type="button"
                                            onClick={() => toggleCompetency(newPrimaryCompetencies, setNewPrimaryCompetencies, comp.key)}
                                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                                newPrimaryCompetencies.includes(comp.key)
                                                    ? 'bg-blue-600 text-white border-blue-500'
                                                    : 'bg-surface text-gray-400 border-border hover:border-gray-500'
                                            } border`}
                                        >
                                            {comp.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 부차적 육성 역량 */}
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-2">부차적 육성 역량 (Secondary Competencies)</label>
                                <div className="flex flex-wrap gap-2">
                                    {COMPETENCIES.map(comp => (
                                        <button
                                            key={comp.key}
                                            type="button"
                                            onClick={() => toggleCompetency(newSecondaryCompetencies, setNewSecondaryCompetencies, comp.key)}
                                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                                newSecondaryCompetencies.includes(comp.key)
                                                    ? 'bg-purple-600 text-white border-purple-500'
                                                    : 'bg-surface text-gray-400 border-border hover:border-gray-500'
                                            } border`}
                                        >
                                            {comp.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 추천 조건 */}
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-2">
                                    추천 조건 (역량 점수가 이 값보다 낮을 때 추천)
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {COMPETENCIES.map(comp => (
                                        <div key={comp.key} className="flex items-center gap-2">
                                            <label className="text-xs text-gray-400 w-24">{comp.label}</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                placeholder="예: 60"
                                                value={newRecommendedFor[comp.key] || ''}
                                                onChange={(e) => updateRecommendThreshold(comp.key, e.target.value)}
                                                className="flex-1 bg-surface border border-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    💡 예: "질문력"을 60으로 설정하면, 사용자의 질문력이 60점 미만일 때 이 봇을 추천합니다.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={cancelEdit}>취소</Button>
                            <Button onClick={isEditing ? handleUpdate : handleCreate}>
                                <Save size={16} className="mr-2" />
                                {isEditing ? '수정' : '저장'}
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            <div className="grid gap-4">
                {templates.map(tmpl => (
                    <Card key={tmpl.id} className="group hover:border-gray-600 transition-colors">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                            <div className="flex items-start gap-4 flex-1 min-w-0">
                                <div className="p-3 bg-surface rounded-lg border border-border text-gray-400">
                                    <Bot size={24} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-lg text-white truncate">
                                        {tmpl.name}
                                    </h3>
                                    <p className="text-sm text-gray-400 mb-3 line-clamp-2">{tmpl.description}</p>
                                    <div className="bg-[#121212] p-3 rounded-md border border-border overflow-hidden">
                                        <p className="text-xs font-mono text-gray-500 line-clamp-2 break-all">{tmpl.systemPrompt}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                                <Button variant="ghost" size="sm" onClick={() => handleEdit(tmpl)}>
                                    <Edit size={16} className="mr-1" />
                                    수정
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-400 hover:bg-red-900/20 hover:text-red-300"
                                    onClick={() => handleDelete(tmpl.id)}
                                >
                                    <Trash2 size={16} />
                                </Button>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </>
      )}

      {/* --- USERS VIEW --- */}
      {view === 'users' && (
          <>
          {/* User Edit Modal */}
          {editingUser && (
            <Card className="mb-6 border-primary/50 bg-primary/5 animate-in fade-in slide-in-from-top-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white">사용자 정보 수정</h3>
                  <button onClick={cancelUserEdit} className="text-gray-400 hover:text-white">
                    <Save className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="이름"
                    value={editUserName}
                    onChange={(e) => setEditUserName(e.target.value)}
                    placeholder="사용자 이름"
                  />
                  <Input
                    label="소속"
                    value={editUserOrganization}
                    onChange={(e) => setEditUserOrganization(e.target.value)}
                    placeholder="소속 (예: ABC 회사, XYZ 대학교)"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <Input
                    label="새 비밀번호 (선택사항)"
                    type="password"
                    value={editUserPassword}
                    onChange={(e) => setEditUserPassword(e.target.value)}
                    placeholder="비밀번호를 변경하려면 입력하세요 (최소 8자)"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleUpdateUserInfo} className="flex-1">
                    <Save size={16} className="mr-2" />
                    저장
                  </Button>
                  <Button variant="ghost" onClick={cancelUserEdit} className="flex-1">
                    취소
                  </Button>
                </div>
              </div>
            </Card>
          )}

          <div className="bg-surface border border-border rounded-xl overflow-hidden overflow-x-auto">
              <div className="p-4 border-b border-border flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1 md:max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                      <input
                        type="text"
                        placeholder="사용자 검색..."
                        className="w-full bg-[#121212] border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-primary"
                      />
                  </div>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-400 min-w-[800px]">
                  <thead className="bg-[#151515] text-xs uppercase font-medium text-gray-500">
                      <tr>
                          <th className="px-6 py-4">User Info</th>
                          <th className="px-6 py-4">Organization</th>
                          <th className="px-6 py-4">Role</th>
                          <th className="px-6 py-4">Level</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                      {users.map(u => (
                          <tr key={u.id} className="hover:bg-[#252525] transition-colors">
                              <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center font-bold text-white">
                                          {u.name.charAt(0)}
                                      </div>
                                      <div>
                                          <div className="font-medium text-white">{u.name}</div>
                                          <div className="text-xs text-gray-600">@{u.username}</div>
                                      </div>
                                  </div>
                              </td>
                              <td className="px-6 py-4">
                                  <div className="text-sm text-gray-300">
                                      {u.organization || <span className="text-gray-600 italic">-</span>}
                                  </div>
                              </td>
                              <td className="px-6 py-4">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    u.role === 'ADMIN'
                                      ? 'bg-purple-500/20 text-purple-300'
                                      : u.role === 'SUPER_USER'
                                      ? 'bg-blue-500/20 text-blue-300'
                                      : 'bg-gray-700 text-gray-300'
                                  }`}>
                                    {u.role}
                                  </span>
                              </td>
                              <td className="px-6 py-4 text-white font-mono">Lv.{u.level}</td>
                              <td className="px-6 py-4">
                                  <span className="flex items-center gap-1.5 text-green-400 text-xs">
                                      <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                                      Active
                                  </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      className="text-blue-400 hover:text-blue-300 p-1"
                                      onClick={() => handleEditUser(u)}
                                      title="사용자 정보 수정"
                                    >
                                      <Edit size={16} />
                                    </button>
                                    <select
                                      className="text-xs bg-transparent border border-gray-700 rounded px-2 py-1 text-gray-400 hover:text-white hover:border-gray-500"
                                      value={u.role}
                                      onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                                    >
                                      <option value="USER">USER</option>
                                      <option value="SUPER_USER">SUPER_USER</option>
                                      <option value="ADMIN">ADMIN</option>
                                    </select>
                                    <button
                                      className="text-red-400 hover:text-red-300 text-xs px-2 py-1"
                                      onClick={() => handleBlockUser(u.id, false)}
                                    >
                                      Block
                                    </button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
              </div>
          </div>
          </>
      )}

      {/* --- USAGE VIEW --- */}
      {view === 'usage' && (
        <>
          <div className="mb-6 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">기간:</label>
              <select
                value={usageDays}
                onChange={(e) => {
                  setUsageDays(parseInt(e.target.value));
                  setTimeout(() => loadUsageStats(), 100);
                }}
                className="bg-surface border border-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary"
              >
                <option value={7}>최근 7일</option>
                <option value={30}>최근 30일</option>
                <option value={90}>최근 90일</option>
              </select>
            </div>
            <Button onClick={loadUsageStats}>
              <Activity size={16} className="mr-2" />
              새로고침
            </Button>
          </div>

          {usageStats && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-blue-900/20 to-blue-800/10 border-blue-700/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">총 비용</p>
                      <h3 className="text-2xl font-bold text-white">${usageStats.summary.totalCost.toFixed(4)}</h3>
                      <p className="text-xs text-gray-500 mt-1">{usageStats.period.days}일 동안</p>
                    </div>
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <DollarSign className="text-blue-400" size={20} />
                    </div>
                  </div>
                </Card>

                <Card className="bg-gradient-to-br from-green-900/20 to-green-800/10 border-green-700/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">총 메시지</p>
                      <h3 className="text-2xl font-bold text-white">{usageStats.summary.totalMessages.toLocaleString()}</h3>
                      <p className="text-xs text-gray-500 mt-1">메시지당 ${usageStats.summary.avgCostPerMessage.toFixed(6)}</p>
                    </div>
                    <div className="p-2 bg-green-500/20 rounded-lg">
                      <Activity className="text-green-400" size={20} />
                    </div>
                  </div>
                </Card>

                <Card className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 border-purple-700/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">활성 사용자</p>
                      <h3 className="text-2xl font-bold text-white">{usageStats.summary.totalUsers}</h3>
                      <p className="text-xs text-gray-500 mt-1">인당 ${usageStats.summary.avgCostPerUser.toFixed(4)}</p>
                    </div>
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <Users className="text-purple-400" size={20} />
                    </div>
                  </div>
                </Card>
              </div>

              {/* Daily Cost Chart */}
              <Card>
                <h3 className="text-lg font-bold text-white mb-4">일별 비용 추이</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={usageStats.dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" stroke="#888" style={{ fontSize: 12 }} />
                    <YAxis stroke="#888" style={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="totalCost" stroke="#3b82f6" name="비용 ($)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              {/* User Usage Table */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">사용자별 사용량</h3>
                  <p className="text-xs text-gray-500">비용 순으로 정렬</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-400 min-w-[900px]">
                    <thead className="bg-[#151515] text-xs uppercase font-medium text-gray-500">
                      <tr>
                        <th className="px-4 py-3">사용자 정보</th>
                        <th className="px-4 py-3">소속</th>
                        <th className="px-4 py-3 text-right">메시지</th>
                        <th className="px-4 py-3 text-right">토큰</th>
                        <th className="px-4 py-3 text-right">총 비용</th>
                        <th className="px-4 py-3 text-right">메시지당 비용</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {usageStats.userStats.slice(0, 20).map((stat) => (
                        <tr key={stat.userId} className="hover:bg-[#252525] transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-white">{stat.name}</span>
                              <span className="text-xs text-gray-500">{stat.email}</span>
                              <span className="text-xs font-mono text-gray-600">{stat.userId.substring(0, 16)}...</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-400">
                              {stat.organization || <span className="text-gray-600 italic">-</span>}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-white">{stat.totalMessages.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-gray-400">{stat.totalTokens.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-bold text-green-400">${stat.totalCost.toFixed(6)}</td>
                          <td className="px-4 py-3 text-right text-gray-500">${stat.avgCostPerMessage.toFixed(6)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Cost Projection */}
              <Card className="bg-gradient-to-r from-orange-900/20 to-red-900/20 border-orange-700/50">
                <h3 className="text-lg font-bold text-white mb-2">📊 월간 예상 비용</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">현재 기준 (30일 환산)</span>
                    <span className="font-bold text-white">
                      ${((usageStats.summary.totalCost / usageStats.period.days) * 30).toFixed(2)}/월
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">사용자 50명 기준 (현재: {usageStats.summary.totalUsers}명)</span>
                    <span className="font-bold text-orange-400">
                      ${((usageStats.summary.avgCostPerUser * 50 / usageStats.period.days) * 30).toFixed(2)}/월
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">사용자 100명 기준</span>
                    <span className="font-bold text-red-400">
                      ${((usageStats.summary.avgCostPerUser * 100 / usageStats.period.days) * 30).toFixed(2)}/월
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {!usageStats && (
            <div className="text-center py-12">
              <p className="text-gray-400">사용량 데이터를 불러오는 중...</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};