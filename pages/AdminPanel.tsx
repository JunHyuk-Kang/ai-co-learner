import React, { useEffect, useState } from 'react';
import { BotService, AdminService } from '../services/awsBackend';
import { BotTemplate, User } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Plus, Trash2, Save, Users, Bot, Search, Edit } from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const [view, setView] = useState<'templates' | 'users'>('templates');
  const [templates, setTemplates] = useState<BotTemplate[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BotTemplate | null>(null);

  // Template Form State
  const [newName, setNewName] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newThemeColor, setNewThemeColor] = useState<string>('blue');

  useEffect(() => {
    loadData();
  }, [view]);

  const loadData = async () => {
    if (view === 'templates') {
        BotService.getTemplates().then(setTemplates);
    } else {
        AdminService.getAllUsers().then((users: any[]) => {
          // Convert userId to id for frontend compatibility
          const convertedUsers = users.map(u => ({
            ...u,
            id: u.userId || u.id,
          }));
          setUsers(convertedUsers);
        });
    }
  };

  const handleCreate = async () => {
    if (!newName || !newPrompt) return;
    try {
      const newTmpl = await BotService.createTemplate({
          name: newName,
          description: newDesc,
          systemPrompt: newPrompt,
          themeColor: newThemeColor,
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
    setIsEditing(true);
  };

  const handleUpdate = async () => {
    if (!editingTemplate || !newName || !newPrompt) return;
    try {
      await BotService.updateTemplate(editingTemplate.id, {
        name: newName,
        description: newDesc,
        systemPrompt: newPrompt,
        themeColor: newThemeColor,
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
    if (!confirm('정말 이 템플릿을 삭제하시겠습니까?')) return;
    try {
      await BotService.deleteTemplate(templateId);
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
    try {
      await AdminService.updateUserRole(userId, newRole);
      await loadData();
      alert(`권한이 ${newRole}로 변경되었습니다.`);
    } catch (error) {
      console.error('Failed to update user role:', error);
      alert('사용자 역할 변경에 실패했습니다: ' + (error as Error).message);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold text-white mb-2">관리자 패널</h1>
            <p className="text-gray-400">
                {view === 'templates' ? '봇 템플릿 및 시스템 프롬프트 관리' : '플랫폼 전체 사용자 관리'}
            </p>
        </div>
        <div className="flex bg-surface p-1 rounded-lg border border-border">
             <button 
                onClick={() => setView('templates')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'templates' ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
             >
                <Bot size={16} className="inline mr-2" />
                봇 템플릿
             </button>
             <button 
                onClick={() => setView('users')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'users' ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
             >
                <Users size={16} className="inline mr-2" />
                사용자 관리
             </button>
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
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="이름" value={newName} onChange={e => setNewName(e.target.value)} placeholder="예: 창의력 마스터" />
                            <Input label="설명" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="간단한 설명" />
                        </div>
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
                            </select>
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
                        <div className="flex justify-between items-start">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-surface rounded-lg border border-border text-gray-400">
                                    <Bot size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-white">
                                        {tmpl.name}
                                    </h3>
                                    <p className="text-sm text-gray-400 mb-3">{tmpl.description}</p>
                                    <div className="bg-[#121212] p-3 rounded-md border border-border max-w-3xl">
                                        <p className="text-xs font-mono text-gray-500 line-clamp-2">{tmpl.systemPrompt}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border flex gap-4">
                  <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                      <input 
                        type="text" 
                        placeholder="사용자 검색..." 
                        className="w-full bg-[#121212] border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-primary"
                      />
                  </div>
              </div>
              <table className="w-full text-left text-sm text-gray-400">
                  <thead className="bg-[#151515] text-xs uppercase font-medium text-gray-500">
                      <tr>
                          <th className="px-6 py-4">User Info</th>
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
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${u.role === 'ADMIN' ? 'bg-purple-500/20 text-purple-300' : 'bg-gray-700 text-gray-300'}`}>
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
                                  <select
                                    className="text-xs bg-transparent border border-gray-700 rounded px-2 py-1 mr-3 text-gray-400 hover:text-white hover:border-gray-500"
                                    value={u.role}
                                    onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                                  >
                                    <option value="USER">USER</option>
                                    <option value="ADMIN">ADMIN</option>
                                  </select>
                                  <button
                                    className="text-red-400 hover:text-red-300"
                                    onClick={() => handleBlockUser(u.id, false)}
                                  >
                                    Block
                                  </button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      )}
    </div>
  );
};