import React, { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import {
  BotService,
  AdminService,
  UsageStatsResponse,
  DashboardStatsResponse,
  SubscriptionService,
  SubscriptionStats,
  OrganizationInfo,
} from '../services/awsBackend';
import { BotTemplate, User, Role } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { MetricCard } from '../components/admin/MetricCard';
import { CompetencyRadar } from '../components/dashboard/CompetencyRadar';
import {
  Plus,
  Trash2,
  Save,
  Users,
  Bot,
  Search,
  Edit,
  DollarSign,
  TrendingUp,
  Activity,
  LayoutDashboard,
  MessageSquare,
  Target,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  CreditCard,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

export const AdminPanel: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [view, setView] = useState<'dashboard' | 'templates' | 'users' | 'usage' | 'subscriptions'>(
    'dashboard'
  );
  const [templates, setTemplates] = useState<BotTemplate[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStatsResponse | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStatsResponse | null>(null);
  const [subscriptionStats, setSubscriptionStats] = useState<SubscriptionStats | null>(null);
  const [usageDays, setUsageDays] = useState<number>(30);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BotTemplate | null>(null);

  // User editing state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserOrganization, setEditUserOrganization] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');

  // User search, pagination, and sorting state
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<'name' | 'level' | 'role'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'SUPER_USER' | 'USER'>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userCompetencies, setUserCompetencies] = useState<any>(null);
  const [userUsage, setUserUsage] = useState<any>(null);
  const USERS_PER_PAGE = 20;

  // Subscription management state
  const [subSearchQuery, setSubSearchQuery] = useState('');
  const [subTierFilter, setSubTierFilter] = useState<
    'ALL' | 'FREE' | 'TRIAL' | 'PREMIUM' | 'UNLIMITED'
  >('ALL');
  const [subCurrentPage, setSubCurrentPage] = useState(1);
  const [editingSubscription, setEditingSubscription] = useState<User | null>(null);
  const [newTier, setNewTier] = useState<string>('');
  const [isUpdatingSubscription, setIsUpdatingSubscription] = useState(false);

  // Group subscription management state
  const [organizations, setOrganizations] = useState<OrganizationInfo[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState<OrganizationInfo | null>(null);
  const [groupNewTier, setGroupNewTier] = useState<string>('');
  const [isUpdatingGroupTier, setIsUpdatingGroupTier] = useState(false);

  // Template organization filter & form state
  const [templateOrgFilter, setTemplateOrgFilter] = useState<string>('ALL');
  const [newTemplateOrgId, setNewTemplateOrgId] = useState<string>('GLOBAL');

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

    setIsLoading(true);
    try {
      if (view === 'dashboard' && currentUser.role === Role.ADMIN) {
        await loadDashboardStats();
      } else if (view === 'templates') {
        const templates = await BotService.getTemplates();
        setTemplates(templates);
        // 조직 목록 로드 (필터 드롭다운용)
        if (currentUser.role === Role.ADMIN) {
          const orgData = await SubscriptionService.getOrganizations(currentUser.id);
          if (orgData) setOrganizations(orgData.organizations);
        }
      } else if (view === 'users' && currentUser.role === Role.ADMIN) {
        const users = await AdminService.getAllUsers(currentUser.id);
        // Convert userId to id for frontend compatibility
        const convertedUsers = users.map((u: any) => ({
          ...u,
          id: u.userId || u.id,
        }));
        setUsers(convertedUsers);
      } else if (view === 'usage' && currentUser.role === Role.ADMIN) {
        await loadUsageStats();
      } else if (view === 'subscriptions' && currentUser.role === Role.ADMIN) {
        await loadSubscriptionStats();
        // 사용자 목록과 조직 목록 함께 로드
        if (users.length === 0) {
          const usersList = await AdminService.getAllUsers(currentUser.id);
          const convertedUsers = usersList.map((u: any) => ({
            ...u,
            id: u.userId || u.id,
          }));
          setUsers(convertedUsers);
        }
        // 조직 목록 로드
        const orgData = await SubscriptionService.getOrganizations(currentUser.id);
        if (orgData) {
          setOrganizations(orgData.organizations);
        }
      }
    } catch (error) {
      logger.error('Failed to load data:', error);
      toast.error('데이터를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSubscriptionStats = async () => {
    if (!currentUser) return;
    try {
      const stats = await SubscriptionService.getSubscriptionStats(currentUser.id);
      setSubscriptionStats(stats);
    } catch (error) {
      logger.error('Failed to load subscription stats:', error);
      toast.error('구독 통계를 불러오는데 실패했습니다.');
    }
  };

  const handleUpdateTier = async () => {
    if (!currentUser || !editingSubscription || !newTier) return;

    setIsUpdatingSubscription(true);
    try {
      await SubscriptionService.updateUserTier({
        adminUserId: currentUser.id,
        targetUserId: editingSubscription.id,
        newTier: newTier as 'FREE' | 'TRIAL' | 'PREMIUM' | 'UNLIMITED',
      });

      toast.success(`${editingSubscription.name}의 티어를 ${newTier}로 변경했습니다.`);

      // 사용자 목록 업데이트
      setUsers(prev =>
        prev.map(u =>
          u.id === editingSubscription.id ? { ...u, subscriptionTier: newTier as any } : u
        )
      );

      // 통계 새로고침
      await loadSubscriptionStats();
      setEditingSubscription(null);
      setNewTier('');
    } catch (error) {
      logger.error('Failed to update tier:', error);
      toast.error('티어 변경에 실패했습니다.');
    } finally {
      setIsUpdatingSubscription(false);
    }
  };

  const handleResetQuota = async (user: User) => {
    if (!currentUser) return;

    try {
      await SubscriptionService.resetUserQuota({
        adminUserId: currentUser.id,
        targetUserId: user.id,
      });

      toast.success(`${user.name}의 메시지 할당량을 리셋했습니다.`);

      // 사용자 목록 업데이트
      setUsers(prev =>
        prev.map(u =>
          u.id === user.id
            ? { ...u, messageQuota: { ...u.messageQuota, currentMonthUsage: 0 } as any }
            : u
        )
      );

      await loadSubscriptionStats();
    } catch (error) {
      logger.error('Failed to reset quota:', error);
      toast.error('할당량 리셋에 실패했습니다.');
    }
  };

  const handleExtendTrial = async (user: User, days: number) => {
    if (!currentUser) return;

    try {
      await SubscriptionService.extendTrialPeriod({
        adminUserId: currentUser.id,
        targetUserId: user.id,
        additionalDays: days,
      });

      toast.success(`${user.name}의 체험 기간을 ${days}일 연장했습니다.`);
      await loadSubscriptionStats();

      // 사용자 목록 새로고침
      const usersList = await AdminService.getAllUsers(currentUser.id);
      const convertedUsers = usersList.map((u: any) => ({
        ...u,
        id: u.userId || u.id,
      }));
      setUsers(convertedUsers);
    } catch (error) {
      logger.error('Failed to extend trial:', error);
      toast.error('체험 기간 연장에 실패했습니다.');
    }
  };

  const handleUpdateGroupTier = async () => {
    if (!currentUser || !selectedOrganization || !groupNewTier) return;

    setIsUpdatingGroupTier(true);
    try {
      const result = await SubscriptionService.updateGroupTier({
        adminUserId: currentUser.id,
        organization: selectedOrganization.name,
        newTier: groupNewTier as 'FREE' | 'TRIAL' | 'PREMIUM' | 'UNLIMITED',
      });

      toast.success(
        `"${selectedOrganization.name}" 그룹의 ${result.updatedCount}명 사용자를 ${groupNewTier}로 변경했습니다.`
      );

      // 사용자 목록 새로고침
      const usersList = await AdminService.getAllUsers(currentUser.id);
      const convertedUsers = usersList.map((u: any) => ({
        ...u,
        id: u.userId || u.id,
      }));
      setUsers(convertedUsers);

      // 조직 목록과 통계 새로고침
      const orgData = await SubscriptionService.getOrganizations(currentUser.id);
      if (orgData) {
        setOrganizations(orgData.organizations);
      }
      await loadSubscriptionStats();

      setSelectedOrganization(null);
      setGroupNewTier('');
    } catch (error) {
      logger.error('Failed to update group tier:', error);
      toast.error('그룹 티어 변경에 실패했습니다.');
    } finally {
      setIsUpdatingGroupTier(false);
    }
  };

  const loadDashboardStats = async () => {
    if (!currentUser) return;
    try {
      const stats = await AdminService.getDashboardStats(currentUser.id);
      setDashboardStats(stats);
    } catch (error) {
      logger.error('Failed to load dashboard stats:', error);
    }
  };

  const loadUsageStats = async () => {
    if (!currentUser) return;
    try {
      const stats = await AdminService.getUsageStats(currentUser.id, { days: usageDays });
      setUsageStats(stats);
    } catch (error) {
      logger.error('Failed to load usage stats:', error);
    }
  };

  const handleCreate = async () => {
    if (!currentUser || !newName || !newPrompt) {
      toast.error('이름과 시스템 프롬프트를 입력해주세요.');
      return;
    }
    try {
      await BotService.createTemplate(currentUser.id, {
        name: newName,
        description: newDesc,
        systemPrompt: newPrompt,
        themeColor: newThemeColor,
        baseType: newBaseType,
        organizationId: newTemplateOrgId,
        primaryCompetencies: newPrimaryCompetencies,
        secondaryCompetencies: newSecondaryCompetencies,
        recommendedFor: {
          competencyBelow: newRecommendedFor,
        },
      });
      await loadData();
      setIsCreating(false);
      resetForm();
      toast.success('템플릿이 성공적으로 생성되었습니다.');
    } catch (error) {
      logger.error('Failed to create template:', error);
      toast.error('템플릿 생성에 실패했습니다.');
    }
  };

  const handleEdit = (template: BotTemplate) => {
    setEditingTemplate(template);
    setNewName(template.name);
    setNewDesc(template.description || '');
    setNewPrompt(template.systemPrompt);
    setNewThemeColor(template.themeColor || 'blue');
    setNewBaseType(template.baseType || 'coaching');
    setNewTemplateOrgId(template.organizationId || 'GLOBAL');
    setNewPrimaryCompetencies(template.primaryCompetencies || []);
    setNewSecondaryCompetencies(template.secondaryCompetencies || []);
    setNewRecommendedFor(template.recommendedFor?.competencyBelow || {});
    setIsEditing(true);
  };

  const handleUpdate = async () => {
    if (!currentUser || !editingTemplate || !newName || !newPrompt) {
      toast.error('이름과 시스템 프롬프트를 입력해주세요.');
      return;
    }
    try {
      await BotService.updateTemplate(currentUser.id, editingTemplate.id, {
        name: newName,
        description: newDesc,
        systemPrompt: newPrompt,
        themeColor: newThemeColor,
        baseType: newBaseType,
        organizationId: newTemplateOrgId,
        primaryCompetencies: newPrimaryCompetencies,
        secondaryCompetencies: newSecondaryCompetencies,
        recommendedFor: {
          competencyBelow: newRecommendedFor,
        },
      });
      await loadData();
      setIsEditing(false);
      setEditingTemplate(null);
      resetForm();
      toast.success('템플릿이 성공적으로 수정되었습니다.');
    } catch (error) {
      logger.error('Failed to update template:', error);
      toast.error('템플릿 수정에 실패했습니다.');
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!currentUser) return;
    try {
      await BotService.deleteTemplate(currentUser.id, templateId);
      await loadData();
      toast.success('템플릿이 성공적으로 삭제되었습니다.');
    } catch (error) {
      logger.error('Failed to delete template:', error);
      toast.error('템플릿 삭제에 실패했습니다.');
    }
  };

  const resetForm = () => {
    setNewName('');
    setNewPrompt('');
    setNewDesc('');
    setNewThemeColor('blue');
    setNewBaseType('coaching');
    setNewTemplateOrgId('GLOBAL');
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
    const action = currentlyBlocked ? '차단 해제' : '차단';

    try {
      await AdminService.blockUser(userId, !currentlyBlocked);
      await loadData();
      toast.success(`사용자가 성공적으로 ${action}되었습니다.`);
    } catch (error) {
      logger.error('Failed to block/unblock user:', error);
      toast.error(`사용자 ${action}에 실패했습니다.`);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    if (!currentUser) return;
    try {
      await AdminService.updateUserRole(currentUser.id, userId, newRole);
      await loadData();
      toast.success(`권한이 ${newRole}로 변경되었습니다.`);
    } catch (error) {
      logger.error('Failed to update user role:', error);
      toast.error('사용자 역할 변경에 실패했습니다: ' + (error as Error).message);
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
      await AdminService.updateUserInfo(
        editingUser.id,
        editUserName,
        editUserOrganization,
        editUserPassword || undefined
      );
      await loadData();
      setEditingUser(null);
      setEditUserName('');
      setEditUserOrganization('');
      setEditUserPassword('');
      toast.success('사용자 정보가 성공적으로 업데이트되었습니다.');
    } catch (error) {
      logger.error('Failed to update user info:', error);
      toast.error('사용자 정보 업데이트에 실패했습니다: ' + (error as Error).message);
    }
  };

  const cancelUserEdit = () => {
    setEditingUser(null);
    setEditUserName('');
    setEditUserOrganization('');
    setEditUserPassword('');
  };

  // Filter, sort, and paginate users
  const getFilteredAndSortedUsers = () => {
    // Filter by search query
    let filtered = users.filter(
      u =>
        u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Filter by role
    if (roleFilter !== 'ALL') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: string | number = '';
      let bValue: string | number = '';

      if (sortField === 'name') {
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
      } else if (sortField === 'level') {
        aValue = a.level || 0;
        bValue = b.level || 0;
      } else if (sortField === 'role') {
        const roleOrder = { ADMIN: 3, SUPER_USER: 2, USER: 1 };
        aValue = roleOrder[a.role as keyof typeof roleOrder] || 0;
        bValue = roleOrder[b.role as keyof typeof roleOrder] || 0;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  };

  const filteredUsers = getFilteredAndSortedUsers();
  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * USERS_PER_PAGE,
    currentPage * USERS_PER_PAGE
  );

  const handleSort = (field: 'name' | 'level' | 'role') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleUserClick = async (user: User) => {
    setSelectedUser(user);
    setUserCompetencies(null);
    setUserUsage(null);

    try {
      // Load user competencies
      const competenciesData = await AdminService.getUserCompetencies(user.id);
      setUserCompetencies(competenciesData);
    } catch (error) {
      logger.error('Failed to load user competencies:', error);
    }

    try {
      // Load user usage data from usageStats
      if (usageStats && usageStats.userStats) {
        const userStat = usageStats.userStats.find((s: any) => s.userId === user.id);
        if (userStat) {
          setUserUsage(userStat);
        }
      }
    } catch (error) {
      logger.error('Failed to load user usage:', error);
    }
  };

  const closeUserModal = () => {
    setSelectedUser(null);
    setUserCompetencies(null);
    setUserUsage(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#121212]">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1a1a1a',
            color: '#fff',
            border: '1px solid #333',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">관리자 패널</h1>
          <p className="text-gray-400">
            {view === 'templates' ? '봇 템플릿 및 시스템 프롬프트 관리' : '플랫폼 전체 사용자 관리'}
          </p>
        </div>
        <div className="flex bg-surface p-1 rounded-lg border border-border w-full md:w-auto">
          {currentUser?.role === Role.ADMIN && (
            <button
              onClick={() => setView('dashboard')}
              className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-all ${view === 'dashboard' ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
            >
              <LayoutDashboard size={16} className="inline mr-1 md:mr-2" />
              대시보드
            </button>
          )}
          <button
            onClick={() => setView('templates')}
            className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-all ${view === 'templates' ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
          >
            <Bot size={16} className="inline mr-1 md:mr-2" />봇 템플릿
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
              <button
                onClick={() => setView('subscriptions')}
                className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-all ${view === 'subscriptions' ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
              >
                <CreditCard size={16} className="inline mr-1 md:mr-2" />
                구독 관리
              </button>
            </>
          )}
        </div>
      </header>

      {/* --- DASHBOARD VIEW --- */}
      {view === 'dashboard' && (
        <>
          <div className="mb-6 flex justify-end">
            <Button onClick={loadDashboardStats}>
              <Activity size={16} className="mr-2" />
              새로고침
            </Button>
          </div>

          {dashboardStats && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <MetricCard
                  title="오늘 활성 사용자"
                  value={`${dashboardStats.today.activeUsers}명`}
                  icon={Users}
                  color="blue"
                  subtext={`평균 ${isFinite(dashboardStats.today.avgMessagesPerUser) ? dashboardStats.today.avgMessagesPerUser.toFixed(1) : '0'}건/사용자`}
                />

                <MetricCard
                  title="오늘 대화 수"
                  value={`${dashboardStats.today.totalMessages}건`}
                  icon={MessageSquare}
                  color="green"
                  subtext={`${dashboardStats.today.activeUsers}명이 활동 중`}
                />

                <MetricCard
                  title="전체 평균 역량"
                  value={`${isFinite(dashboardStats.overall.avgCompetencyScore) ? dashboardStats.overall.avgCompetencyScore.toFixed(1) : '0'}점`}
                  icon={TrendingUp}
                  color="purple"
                  subtext={`총 ${dashboardStats.overall.totalUsers}명 사용자`}
                />

                <MetricCard
                  title="퀘스트 완료율"
                  value={`${isFinite(dashboardStats.today.questCompletionRate) ? dashboardStats.today.questCompletionRate.toFixed(0) : '0'}%`}
                  icon={Target}
                  color="teal"
                  subtext={`${dashboardStats.today.completedQuests}/${dashboardStats.today.totalQuests}개 완료`}
                />

                <MetricCard
                  title="7일 미접속"
                  value={`${dashboardStats.overall.inactiveUsers7d}명`}
                  icon={AlertTriangle}
                  color="red"
                  alert={dashboardStats.overall.inactiveUsers7d > 10}
                  subtext="이탈 위험 사용자"
                />
              </div>

              {/* Top Bots */}
              {dashboardStats.topBots.length > 0 && (
                <Card>
                  <h3 className="text-lg font-bold text-white mb-4">인기 봇 Top 3</h3>
                  <div className="space-y-3">
                    {dashboardStats.topBots.map((bot, index) => (
                      <div
                        key={bot.botId}
                        className="flex items-center justify-between p-3 bg-[#121212] rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{bot.name}</p>
                            <p className="text-xs text-gray-500">봇 ID: {bot.botId}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-white">{bot.usageCount}</p>
                          <p className="text-xs text-gray-500">사용 횟수</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Hourly Activity Chart */}
              <Card>
                <h3 className="text-lg font-bold text-white mb-4">시간대별 활동 (오늘)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dashboardStats.hourlyActivity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="hour" stroke="#888" style={{ fontSize: 12 }} />
                    <YAxis stroke="#888" style={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="activeUsers"
                      stroke="#3b82f6"
                      name="활성 사용자"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="messages"
                      stroke="#10b981"
                      name="메시지 수"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}

          {!dashboardStats && (
            <div className="text-center py-12">
              <p className="text-gray-400">대시보드 데이터를 불러오는 중...</p>
            </div>
          )}
        </>
      )}

      {/* --- TEMPLATES VIEW --- */}
      {view === 'templates' && (
        <>
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-400">조직 필터:</label>
              <select
                className="bg-[#121212] border border-border rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-primary"
                value={templateOrgFilter}
                onChange={e => setTemplateOrgFilter(e.target.value)}
              >
                <option value="ALL">전체</option>
                <option value="GLOBAL">공통 (GLOBAL)</option>
                {organizations.map(org => (
                  <option key={org.name} value={org.name}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={() => setIsCreating(true)}>
              <Plus size={16} className="mr-2" />
              템플릿 생성
            </Button>
          </div>

          {(isCreating || isEditing) && (
            <Card className="mb-8 border-primary/50 bg-primary/5 animate-in fade-in slide-in-from-top-4">
              <div className="space-y-4">
                <h3 className="font-bold text-white">
                  {isEditing ? '봇 템플릿 수정' : '새 봇 템플릿 생성'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="이름"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="예: 창의력 마스터"
                  />
                  <Input
                    label="설명"
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="간단한 설명"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Theme Color
                    </label>
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
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Base Type
                    </label>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      소속 조직
                    </label>
                    <select
                      className="w-full bg-[#121212] border border-border rounded-lg p-2 text-sm text-gray-200 focus:outline-none focus:border-primary"
                      value={newTemplateOrgId}
                      onChange={e => setNewTemplateOrgId(e.target.value)}
                    >
                      <option value="GLOBAL">공통 (모든 사용자)</option>
                      {organizations.map(org => (
                        <option key={org.name} value={org.name}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    System Prompt (Core Logic)
                  </label>
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
                    <label className="block text-xs font-medium text-gray-400 mb-2">
                      주요 육성 역량 (Primary Competencies)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {COMPETENCIES.map(comp => (
                        <button
                          key={comp.key}
                          type="button"
                          onClick={() =>
                            toggleCompetency(
                              newPrimaryCompetencies,
                              setNewPrimaryCompetencies,
                              comp.key
                            )
                          }
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
                    <label className="block text-xs font-medium text-gray-400 mb-2">
                      부차적 육성 역량 (Secondary Competencies)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {COMPETENCIES.map(comp => (
                        <button
                          key={comp.key}
                          type="button"
                          onClick={() =>
                            toggleCompetency(
                              newSecondaryCompetencies,
                              setNewSecondaryCompetencies,
                              comp.key
                            )
                          }
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
                            onChange={e => updateRecommendThreshold(comp.key, e.target.value)}
                            className="flex-1 bg-surface border border-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-primary"
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      💡 예: "질문력"을 60으로 설정하면, 사용자의 질문력이 60점 미만일 때 이 봇을
                      추천합니다.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={cancelEdit}>
                    취소
                  </Button>
                  <Button onClick={isEditing ? handleUpdate : handleCreate}>
                    <Save size={16} className="mr-2" />
                    {isEditing ? '수정' : '저장'}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          <div className="grid gap-4">
            {templates
              .filter(
                tmpl =>
                  templateOrgFilter === 'ALL' ||
                  (tmpl.organizationId || 'GLOBAL') === templateOrgFilter
              )
              .map(tmpl => (
                <Card key={tmpl.id} className="group hover:border-gray-600 transition-colors">
                  <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="p-3 bg-surface rounded-lg border border-border text-gray-400">
                        <Bot size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg text-white truncate">{tmpl.name}</h3>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${
                              (tmpl.organizationId || 'GLOBAL') === 'GLOBAL'
                                ? 'bg-blue-900/30 text-blue-400'
                                : 'bg-green-900/30 text-green-400'
                            }`}
                          >
                            {(tmpl.organizationId || 'GLOBAL') === 'GLOBAL'
                              ? '공통'
                              : tmpl.organizationId}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                          {tmpl.description}
                        </p>
                        <div className="bg-[#121212] p-3 rounded-md border border-border overflow-hidden">
                          <p className="text-xs font-mono text-gray-500 line-clamp-2 break-all">
                            {tmpl.systemPrompt}
                          </p>
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
                    onChange={e => setEditUserName(e.target.value)}
                    placeholder="사용자 이름"
                  />
                  <Input
                    label="소속"
                    value={editUserOrganization}
                    onChange={e => setEditUserOrganization(e.target.value)}
                    placeholder="소속 (예: ABC 회사, XYZ 대학교)"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <Input
                    label="새 비밀번호 (선택사항)"
                    type="password"
                    value={editUserPassword}
                    onChange={e => setEditUserPassword(e.target.value)}
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
            <div className="p-4 border-b border-border flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col md:flex-row gap-3 flex-1 w-full md:w-auto">
                <div className="relative flex-1 md:max-w-sm">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                    size={16}
                  />
                  <input
                    type="text"
                    placeholder="사용자 검색..."
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1); // Reset to first page on search
                    }}
                    className="w-full bg-[#121212] border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="relative">
                  <Filter
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                    size={16}
                  />
                  <select
                    value={roleFilter}
                    onChange={e => {
                      setRoleFilter(e.target.value as any);
                      setCurrentPage(1);
                    }}
                    className="w-full md:w-40 bg-[#121212] border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-primary appearance-none cursor-pointer"
                  >
                    <option value="ALL">전체 역할</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPER_USER">SUPER_USER</option>
                    <option value="USER">USER</option>
                  </select>
                </div>
              </div>
              <div className="text-sm text-gray-400 whitespace-nowrap">
                {filteredUsers.length}명 / 전체 {users.length}명
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-400 min-w-[800px]">
                <thead className="bg-[#151515] text-xs uppercase font-medium text-gray-500">
                  <tr>
                    <th
                      className="px-6 py-4 cursor-pointer hover:bg-[#1a1a1a] transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        User Info
                        {sortField === 'name' &&
                          (sortDirection === 'asc' ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          ))}
                      </div>
                    </th>
                    <th className="px-6 py-4">Organization</th>
                    <th
                      className="px-6 py-4 cursor-pointer hover:bg-[#1a1a1a] transition-colors"
                      onClick={() => handleSort('role')}
                    >
                      <div className="flex items-center gap-2">
                        Role
                        {sortField === 'role' &&
                          (sortDirection === 'asc' ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          ))}
                      </div>
                    </th>
                    <th
                      className="px-6 py-4 cursor-pointer hover:bg-[#1a1a1a] transition-colors"
                      onClick={() => handleSort('level')}
                    >
                      <div className="flex items-center gap-2">
                        Level
                        {sortField === 'level' &&
                          (sortDirection === 'asc' ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          ))}
                      </div>
                    </th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading
                    ? // Skeleton loading state
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gray-700"></div>
                              <div className="space-y-2">
                                <div className="h-4 w-32 bg-gray-700 rounded"></div>
                                <div className="h-3 w-24 bg-gray-800 rounded"></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="h-4 w-24 bg-gray-700 rounded"></div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="h-6 w-20 bg-gray-700 rounded"></div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="h-4 w-12 bg-gray-700 rounded"></div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="h-4 w-16 bg-gray-700 rounded"></div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-8 w-8 bg-gray-700 rounded"></div>
                              <div className="h-8 w-24 bg-gray-700 rounded"></div>
                              <div className="h-8 w-16 bg-gray-700 rounded"></div>
                            </div>
                          </td>
                        </tr>
                      ))
                    : paginatedUsers.map(u => (
                        <tr
                          key={u.id}
                          className="hover:bg-[#252525] transition-colors cursor-pointer"
                          onClick={() => handleUserClick(u)}
                        >
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
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                u.role === 'ADMIN'
                                  ? 'bg-purple-500/20 text-purple-300'
                                  : u.role === 'SUPER_USER'
                                    ? 'bg-blue-500/20 text-blue-300'
                                    : 'bg-gray-700 text-gray-300'
                              }`}
                            >
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
                                onClick={e => {
                                  e.stopPropagation();
                                  handleEditUser(u);
                                }}
                                title="사용자 정보 수정"
                              >
                                <Edit size={16} />
                              </button>
                              <select
                                className="text-xs bg-transparent border border-gray-700 rounded px-2 py-1 text-gray-400 hover:text-white hover:border-gray-500"
                                value={u.role}
                                onClick={e => e.stopPropagation()}
                                onChange={e => {
                                  e.stopPropagation();
                                  handleUpdateUserRole(u.id, e.target.value);
                                }}
                              >
                                <option value="USER">USER</option>
                                <option value="SUPER_USER">SUPER_USER</option>
                                <option value="ADMIN">ADMIN</option>
                              </select>
                              <button
                                className={`text-xs px-2 py-1 rounded transition-colors ${
                                  (u as any).blocked
                                    ? 'text-green-400 hover:text-green-300 hover:bg-green-900/20'
                                    : 'text-red-400 hover:text-red-300 hover:bg-red-900/20'
                                }`}
                                onClick={e => {
                                  e.stopPropagation();
                                  handleBlockUser(u.id, (u as any).blocked || false);
                                }}
                              >
                                {(u as any).blocked ? 'Unblock' : 'Block'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-border flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  페이지 {currentPage} / {totalPages} (총 {filteredUsers.length}명)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} />
                  </Button>

                  {/* Page numbers */}
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 rounded text-xs transition-colors ${
                            currentPage === pageNum
                              ? 'bg-primary text-white'
                              : 'bg-surface text-gray-400 hover:bg-[#252525]'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* User Detail Modal */}
          {selectedUser && (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={closeUserModal}
            >
              <div
                className="bg-surface border border-border rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center font-bold text-white text-2xl">
                        {selectedUser.name.charAt(0)}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white">{selectedUser.name}</h2>
                        <p className="text-sm text-gray-400">@{selectedUser.username}</p>
                        {selectedUser.email && (
                          <p className="text-xs text-gray-500">{selectedUser.email}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={closeUserModal}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <Save className="w-6 h-6" />
                    </button>
                  </div>

                  {/* User Info */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">레벨</p>
                      <p className="text-lg font-bold text-white">Lv.{selectedUser.level}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">경험치</p>
                      <p className="text-lg font-bold text-white">
                        {selectedUser.experiencePoints || 0} XP
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">역할</p>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          selectedUser.role === 'ADMIN'
                            ? 'bg-purple-500/20 text-purple-300'
                            : selectedUser.role === 'SUPER_USER'
                              ? 'bg-blue-500/20 text-blue-300'
                              : 'bg-gray-700 text-gray-300'
                        }`}
                      >
                        {selectedUser.role}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">소속</p>
                      <p className="text-sm text-white">
                        {selectedUser.organization || <span className="text-gray-600">-</span>}
                      </p>
                    </div>
                  </div>

                  {/* Competency Radar Chart */}
                  {userCompetencies && userCompetencies.competencies && (
                    <div className="mb-6">
                      <h3 className="text-lg font-bold text-white mb-4">역량 분석</h3>
                      <div className="bg-[#121212] p-4 rounded-lg border border-border">
                        <CompetencyRadar competencies={userCompetencies.competencies} />
                      </div>
                    </div>
                  )}

                  {/* Activity Stats */}
                  {userUsage && (
                    <div className="mb-6">
                      <h3 className="text-lg font-bold text-white mb-4">사용량 통계</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-[#121212] rounded-lg border border-border">
                          <p className="text-xs text-gray-500 mb-1">총 메시지</p>
                          <p className="text-2xl font-bold text-white">
                            {userUsage.totalMessages || 0}
                          </p>
                        </div>
                        <div className="p-4 bg-[#121212] rounded-lg border border-border">
                          <p className="text-xs text-gray-500 mb-1">총 비용</p>
                          <p className="text-2xl font-bold text-green-400">
                            ${(userUsage.totalCost || 0).toFixed(4)}
                          </p>
                        </div>
                        <div className="p-4 bg-[#121212] rounded-lg border border-border">
                          <p className="text-xs text-gray-500 mb-1">메시지당 평균</p>
                          <p className="text-2xl font-bold text-white">
                            ${(userUsage.avgCostPerMessage || 0).toFixed(6)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {!userCompetencies && !userUsage && (
                    <div className="text-center py-8">
                      <p className="text-gray-400">사용자 데이터를 불러오는 중...</p>
                    </div>
                  )}

                  {/* Close button */}
                  <div className="flex justify-end mt-6">
                    <Button variant="ghost" onClick={closeUserModal}>
                      닫기
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
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
                onChange={e => {
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
                      <h3 className="text-2xl font-bold text-white">
                        ${usageStats.summary.totalCost.toFixed(4)}
                      </h3>
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
                      <h3 className="text-2xl font-bold text-white">
                        {usageStats.summary.totalMessages.toLocaleString()}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        메시지당 ${usageStats.summary.avgCostPerMessage.toFixed(6)}
                      </p>
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
                      <h3 className="text-2xl font-bold text-white">
                        {usageStats.summary.totalUsers}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        인당 ${usageStats.summary.avgCostPerUser.toFixed(4)}
                      </p>
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
                    <Line
                      type="monotone"
                      dataKey="totalCost"
                      stroke="#3b82f6"
                      name="비용 ($)"
                      strokeWidth={2}
                    />
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
                      {usageStats.userStats.slice(0, 20).map(stat => (
                        <tr key={stat.userId} className="hover:bg-[#252525] transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-white">{stat.name}</span>
                              <span className="text-xs text-gray-500">{stat.email}</span>
                              <span className="text-xs font-mono text-gray-600">
                                {stat.userId.substring(0, 16)}...
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-400">
                              {stat.organization || <span className="text-gray-600 italic">-</span>}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-white">
                            {stat.totalMessages.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-400">
                            {stat.totalTokens.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-green-400">
                            ${stat.totalCost.toFixed(6)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500">
                            ${stat.avgCostPerMessage.toFixed(6)}
                          </td>
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
                      ${((usageStats.summary.totalCost / usageStats.period.days) * 30).toFixed(2)}
                      /월
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">
                      사용자 50명 기준 (현재: {usageStats.summary.totalUsers}명)
                    </span>
                    <span className="font-bold text-orange-400">
                      $
                      {(
                        ((usageStats.summary.avgCostPerUser * 50) / usageStats.period.days) *
                        30
                      ).toFixed(2)}
                      /월
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">사용자 100명 기준</span>
                    <span className="font-bold text-red-400">
                      $
                      {(
                        ((usageStats.summary.avgCostPerUser * 100) / usageStats.period.days) *
                        30
                      ).toFixed(2)}
                      /월
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

      {/* --- SUBSCRIPTIONS VIEW --- */}
      {view === 'subscriptions' && (
        <>
          {subscriptionStats && (
            <div className="space-y-6">
              {/* Tier Distribution */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <MetricCard
                  title="무료 사용자"
                  value={subscriptionStats.tierDistribution.FREE}
                  icon={Users}
                  color="gray"
                />
                <MetricCard
                  title="체험 사용자"
                  value={subscriptionStats.tierDistribution.TRIAL}
                  icon={Users}
                  color="blue"
                />
                <MetricCard
                  title="프리미엄 사용자"
                  value={subscriptionStats.tierDistribution.PREMIUM}
                  icon={Users}
                  color="purple"
                />
                <MetricCard
                  title="무제한 사용자"
                  value={subscriptionStats.tierDistribution.UNLIMITED}
                  icon={Users}
                  color="amber"
                />
              </div>

              {/* Quota Usage Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <h3 className="text-sm font-bold text-gray-400 mb-2">평균 사용률</h3>
                  <p className="text-3xl font-bold text-white">
                    {subscriptionStats.quotaUsage.averageUsage.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {subscriptionStats.quotaUsage.totalUsage} /{' '}
                    {subscriptionStats.quotaUsage.totalLimit}
                  </p>
                </Card>
                <Card>
                  <h3 className="text-sm font-bold text-gray-400 mb-2">한도 임박 사용자</h3>
                  <p className="text-3xl font-bold text-yellow-400">
                    {subscriptionStats.quotaUsage.nearLimitUsers}명
                  </p>
                  <p className="text-xs text-gray-500 mt-1">90% 이상 사용</p>
                </Card>
                <Card>
                  <h3 className="text-sm font-bold text-gray-400 mb-2">한도 초과 사용자</h3>
                  <p className="text-3xl font-bold text-red-400">
                    {subscriptionStats.quotaUsage.exceededUsers}명
                  </p>
                  <p className="text-xs text-gray-500 mt-1">업그레이드 필요</p>
                </Card>
              </div>

              {/* Trial Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <h3 className="text-sm font-bold text-gray-400 mb-2">활성 체험</h3>
                  <p className="text-3xl font-bold text-blue-400">
                    {subscriptionStats.trialStatus.activeTrials}명
                  </p>
                </Card>
                <Card>
                  <h3 className="text-sm font-bold text-gray-400 mb-2">7일 내 만료</h3>
                  <p className="text-3xl font-bold text-yellow-400">
                    {subscriptionStats.trialStatus.expiringIn7Days}명
                  </p>
                  <p className="text-xs text-gray-500 mt-1">알림 필요</p>
                </Card>
                <Card>
                  <h3 className="text-sm font-bold text-gray-400 mb-2">만료된 체험</h3>
                  <p className="text-3xl font-bold text-red-400">
                    {subscriptionStats.trialStatus.expired}명
                  </p>
                  <p className="text-xs text-gray-500 mt-1">업그레이드 유도</p>
                </Card>
              </div>

              {/* Group Management */}
              <Card>
                <h3 className="text-xl font-bold text-white mb-4">그룹별 일괄 관리</h3>
                <p className="text-sm text-gray-400 mb-4">
                  조직/그룹 단위로 사용자들의 구독 티어를 한 번에 변경할 수 있습니다.
                </p>

                {organizations.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 text-gray-400 font-medium">조직</th>
                          <th className="text-center py-3 px-4 text-gray-400 font-medium">
                            총 인원
                          </th>
                          <th className="text-center py-3 px-4 text-gray-400 font-medium">FREE</th>
                          <th className="text-center py-3 px-4 text-gray-400 font-medium">TRIAL</th>
                          <th className="text-center py-3 px-4 text-gray-400 font-medium">
                            PREMIUM
                          </th>
                          <th className="text-center py-3 px-4 text-gray-400 font-medium">
                            UNLIMITED
                          </th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium">작업</th>
                        </tr>
                      </thead>
                      <tbody>
                        {organizations.map(org => (
                          <tr key={org.name} className="border-b border-border hover:bg-surface/50">
                            <td className="py-3 px-4">
                              <span className="font-medium text-white">{org.name}</span>
                            </td>
                            <td className="py-3 px-4 text-center text-white font-bold">
                              {org.userCount}명
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-xs ${
                                  org.tierDistribution.FREE > 0
                                    ? 'bg-gray-500/20 text-gray-400'
                                    : 'text-gray-600'
                                }`}
                              >
                                {org.tierDistribution.FREE}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-xs ${
                                  org.tierDistribution.TRIAL > 0
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'text-gray-600'
                                }`}
                              >
                                {org.tierDistribution.TRIAL}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-xs ${
                                  org.tierDistribution.PREMIUM > 0
                                    ? 'bg-purple-500/20 text-purple-400'
                                    : 'text-gray-600'
                                }`}
                              >
                                {org.tierDistribution.PREMIUM}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-xs ${
                                  org.tierDistribution.UNLIMITED > 0
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'text-gray-600'
                                }`}
                              >
                                {org.tierDistribution.UNLIMITED}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setSelectedOrganization(org);
                                  setGroupNewTier('');
                                }}
                              >
                                일괄 변경
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 py-4 text-center">
                    조직 정보가 설정된 사용자가 없습니다.
                  </p>
                )}
              </Card>

              {/* User Management Table */}
              <Card>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                  <h3 className="text-xl font-bold text-white">사용자 구독 관리</h3>
                  <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                    {/* Search */}
                    <div className="relative flex-1 md:flex-none">
                      <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                        size={16}
                      />
                      <input
                        type="text"
                        placeholder="이름 또는 아이디 검색..."
                        value={subSearchQuery}
                        onChange={e => {
                          setSubSearchQuery(e.target.value);
                          setSubCurrentPage(1);
                        }}
                        className="w-full md:w-64 pl-10 pr-4 py-2 bg-surface border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                    {/* Tier Filter */}
                    <select
                      value={subTierFilter}
                      onChange={e => {
                        setSubTierFilter(e.target.value as any);
                        setSubCurrentPage(1);
                      }}
                      className="px-3 py-2 bg-surface border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="ALL">모든 티어</option>
                      <option value="FREE">FREE</option>
                      <option value="TRIAL">TRIAL</option>
                      <option value="PREMIUM">PREMIUM</option>
                      <option value="UNLIMITED">UNLIMITED</option>
                    </select>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">사용자</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">티어</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">
                          메시지 사용
                        </th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">체험 상태</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // 필터링
                        let filteredUsers = users.filter(user => {
                          const tier = (user as any).subscriptionTier || 'UNLIMITED';
                          const matchesSearch =
                            subSearchQuery === '' ||
                            user.name.toLowerCase().includes(subSearchQuery.toLowerCase()) ||
                            (user.username &&
                              user.username.toLowerCase().includes(subSearchQuery.toLowerCase()));
                          const matchesTier = subTierFilter === 'ALL' || tier === subTierFilter;
                          return matchesSearch && matchesTier;
                        });

                        // 페이지네이션
                        const startIdx = (subCurrentPage - 1) * USERS_PER_PAGE;
                        const paginatedUsers = filteredUsers.slice(
                          startIdx,
                          startIdx + USERS_PER_PAGE
                        );

                        return paginatedUsers.map(user => {
                          const tier = (user as any).subscriptionTier || 'UNLIMITED';
                          const quota = (user as any).messageQuota || {
                            currentMonthUsage: 0,
                            monthlyLimit: -1,
                          };
                          const trial = (user as any).trialPeriod;

                          return (
                            <tr
                              key={user.id}
                              className="border-b border-border hover:bg-surface/50"
                            >
                              <td className="py-3 px-4">
                                <div className="font-medium text-white">{user.name}</div>
                                <div className="text-xs text-gray-500">{user.username}</div>
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`px-2 py-1 rounded text-xs font-bold ${
                                    tier === 'FREE'
                                      ? 'bg-gray-500/20 text-gray-400'
                                      : tier === 'TRIAL'
                                        ? 'bg-blue-500/20 text-blue-400'
                                        : tier === 'PREMIUM'
                                          ? 'bg-purple-500/20 text-purple-400'
                                          : 'bg-amber-500/20 text-amber-400'
                                  }`}
                                >
                                  {tier}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                {quota.monthlyLimit === -1 ? (
                                  <span className="text-gray-400">무제한</span>
                                ) : (
                                  <div>
                                    <span
                                      className={`${
                                        quota.currentMonthUsage >= quota.monthlyLimit
                                          ? 'text-red-400'
                                          : quota.currentMonthUsage / quota.monthlyLimit >= 0.9
                                            ? 'text-yellow-400'
                                            : 'text-white'
                                      }`}
                                    >
                                      {quota.currentMonthUsage} / {quota.monthlyLimit}
                                    </span>
                                    <div className="w-24 h-1.5 bg-gray-700 rounded mt-1">
                                      <div
                                        className={`h-full rounded ${
                                          quota.currentMonthUsage >= quota.monthlyLimit
                                            ? 'bg-red-500'
                                            : quota.currentMonthUsage / quota.monthlyLimit >= 0.9
                                              ? 'bg-yellow-500'
                                              : 'bg-primary'
                                        }`}
                                        style={{
                                          width: `${Math.min((quota.currentMonthUsage / quota.monthlyLimit) * 100, 100)}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                {trial ? (
                                  <span
                                    className={`text-xs ${
                                      trial.daysRemaining <= 0
                                        ? 'text-red-400'
                                        : trial.daysRemaining <= 7
                                          ? 'text-yellow-400'
                                          : 'text-blue-400'
                                    }`}
                                  >
                                    {trial.daysRemaining <= 0
                                      ? '만료됨'
                                      : `${trial.daysRemaining}일 남음`}
                                  </span>
                                ) : (
                                  <span className="text-gray-500 text-xs">-</span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => {
                                      setEditingSubscription(user);
                                      setNewTier(tier);
                                    }}
                                  >
                                    티어변경
                                  </Button>
                                  {tier !== 'UNLIMITED' && quota.monthlyLimit !== -1 && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleResetQuota(user)}
                                      title="할당량 리셋"
                                    >
                                      리셋
                                    </Button>
                                  )}
                                  {tier === 'TRIAL' && trial && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleExtendTrial(user, 7)}
                                      title="7일 연장"
                                    >
                                      +7일
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {(() => {
                  const filteredUsers = users.filter(user => {
                    const tier = (user as any).subscriptionTier || 'UNLIMITED';
                    const matchesSearch =
                      subSearchQuery === '' ||
                      user.name.toLowerCase().includes(subSearchQuery.toLowerCase()) ||
                      (user.username &&
                        user.username.toLowerCase().includes(subSearchQuery.toLowerCase()));
                    const matchesTier = subTierFilter === 'ALL' || tier === subTierFilter;
                    return matchesSearch && matchesTier;
                  });
                  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);

                  if (totalPages <= 1) return null;

                  return (
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
                      <p className="text-sm text-gray-400">
                        총 {filteredUsers.length}명 중 {(subCurrentPage - 1) * USERS_PER_PAGE + 1} -{' '}
                        {Math.min(subCurrentPage * USERS_PER_PAGE, filteredUsers.length)}명
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={subCurrentPage === 1}
                          onClick={() => setSubCurrentPage(p => p - 1)}
                        >
                          <ChevronLeft size={16} />
                        </Button>
                        <span className="px-3 py-1 text-sm text-white">
                          {subCurrentPage} / {totalPages}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={subCurrentPage >= totalPages}
                          onClick={() => setSubCurrentPage(p => p + 1)}
                        >
                          <ChevronRight size={16} />
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </Card>
            </div>
          )}

          {!subscriptionStats && (
            <div className="text-center py-12">
              <p className="text-gray-400">구독 데이터를 불러오는 중...</p>
            </div>
          )}

          {/* Tier Change Modal */}
          {editingSubscription && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
              <div className="bg-surface border border-border rounded-xl max-w-md w-full p-6 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-4">구독 티어 변경</h3>

                <div className="mb-4">
                  <p className="text-sm text-gray-400 mb-1">사용자</p>
                  <p className="text-white font-bold">{editingSubscription.name}</p>
                  <p className="text-xs text-gray-500">{editingSubscription.username}</p>
                </div>

                <div className="mb-6">
                  <label className="text-sm text-gray-400 mb-2 block">새로운 티어 선택</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['FREE', 'TRIAL', 'PREMIUM', 'UNLIMITED'].map(tier => (
                      <button
                        key={tier}
                        onClick={() => setNewTier(tier)}
                        className={`px-4 py-3 rounded-lg border text-sm font-bold transition-all ${
                          newTier === tier
                            ? tier === 'FREE'
                              ? 'bg-gray-500/30 border-gray-500 text-gray-300'
                              : tier === 'TRIAL'
                                ? 'bg-blue-500/30 border-blue-500 text-blue-300'
                                : tier === 'PREMIUM'
                                  ? 'bg-purple-500/30 border-purple-500 text-purple-300'
                                  : 'bg-amber-500/30 border-amber-500 text-amber-300'
                            : 'bg-surface border-border text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        {tier}
                        <div className="text-xs font-normal mt-1 text-gray-500">
                          {tier === 'FREE'
                            ? '50개/월'
                            : tier === 'TRIAL'
                              ? '1,000개/월 (30일)'
                              : tier === 'PREMIUM'
                                ? '1,500개/월'
                                : '무제한'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => {
                      setEditingSubscription(null);
                      setNewTier('');
                    }}
                  >
                    취소
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleUpdateTier}
                    disabled={isUpdatingSubscription || !newTier}
                  >
                    {isUpdatingSubscription ? '변경 중...' : '변경하기'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Group Tier Change Modal */}
          {selectedOrganization && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
              <div className="bg-surface border border-border rounded-xl max-w-md w-full p-6 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-4">그룹 구독 티어 일괄 변경</h3>

                <div className="mb-4 p-4 bg-background/50 rounded-lg">
                  <p className="text-sm text-gray-400 mb-1">대상 그룹</p>
                  <p className="text-white font-bold text-lg">{selectedOrganization.name}</p>
                  <p className="text-sm text-gray-400 mt-2">
                    총 {selectedOrganization.userCount}명
                  </p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {selectedOrganization.tierDistribution.FREE > 0 && (
                      <span className="px-2 py-0.5 text-xs bg-gray-500/20 text-gray-400 rounded">
                        FREE: {selectedOrganization.tierDistribution.FREE}
                      </span>
                    )}
                    {selectedOrganization.tierDistribution.TRIAL > 0 && (
                      <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">
                        TRIAL: {selectedOrganization.tierDistribution.TRIAL}
                      </span>
                    )}
                    {selectedOrganization.tierDistribution.PREMIUM > 0 && (
                      <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">
                        PREMIUM: {selectedOrganization.tierDistribution.PREMIUM}
                      </span>
                    )}
                    {selectedOrganization.tierDistribution.UNLIMITED > 0 && (
                      <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded">
                        UNLIMITED: {selectedOrganization.tierDistribution.UNLIMITED}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mb-6">
                  <label className="text-sm text-gray-400 mb-2 block">변경할 티어 선택</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['FREE', 'TRIAL', 'PREMIUM', 'UNLIMITED'].map(tier => (
                      <button
                        key={tier}
                        onClick={() => setGroupNewTier(tier)}
                        className={`px-4 py-3 rounded-lg border text-sm font-bold transition-all ${
                          groupNewTier === tier
                            ? tier === 'FREE'
                              ? 'bg-gray-500/30 border-gray-500 text-gray-300'
                              : tier === 'TRIAL'
                                ? 'bg-blue-500/30 border-blue-500 text-blue-300'
                                : tier === 'PREMIUM'
                                  ? 'bg-purple-500/30 border-purple-500 text-purple-300'
                                  : 'bg-amber-500/30 border-amber-500 text-amber-300'
                            : 'bg-surface border-border text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        {tier}
                        <div className="text-xs font-normal mt-1 text-gray-500">
                          {tier === 'FREE'
                            ? '50개/월'
                            : tier === 'TRIAL'
                              ? '1,000개/월 (30일)'
                              : tier === 'PREMIUM'
                                ? '1,500개/월'
                                : '무제한'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-xs text-yellow-400">
                    <strong>주의:</strong> 이 작업은 "{selectedOrganization.name}" 그룹의 모든
                    사용자({selectedOrganization.userCount}명)의 구독 티어를 일괄 변경합니다. 이미
                    같은 티어인 사용자는 변경되지 않습니다.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => {
                      setSelectedOrganization(null);
                      setGroupNewTier('');
                    }}
                  >
                    취소
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleUpdateGroupTier}
                    disabled={isUpdatingGroupTier || !groupNewTier}
                  >
                    {isUpdatingGroupTier
                      ? '변경 중...'
                      : `${selectedOrganization.userCount}명 일괄 변경`}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
