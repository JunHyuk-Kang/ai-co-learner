import { fetchAuthSession } from 'aws-amplify/auth';
import { User, ChatSession, Message } from '../types';
import { apiGet, apiPost } from './apiUtils';
import { logger } from '../utils/logger';

export interface Competency {
  name: string;
  score: number;
  updatedAt: number;
  totalMessages: number;
  trend: number;
}

export interface UserCompetencies {
  userId: string;
  competencies: Competency[];
  lastUpdated: number;
}

export const UserService = {
  getUserProfile: async (userId: string): Promise<User | null> => {
    try {
      const data: any = await apiGet(`/users/${userId}`);

      // Convert userId to id for frontend User type
      if (data && data.userId) {
        return {
          ...data,
          id: data.userId,
        } as User;
      }

      return data as User;
    } catch (error) {
      logger.error('Failed to get user profile:', error);
      return null;
    }
  },

  createUserProfile: async (
    userId: string,
    username: string,
    name: string,
    organization?: string
  ): Promise<User> => {
    try {
      const data: any = await apiPost('/users', {
        userId,
        username,
        name,
        organization: organization || '',
        role: 'USER',
        level: 1,
        title: '초보 탐험가',
      });

      // Convert userId to id for frontend User type
      if (data && data.userId) {
        return {
          ...data,
          id: data.userId,
        } as User;
      }

      return data as User;
    } catch (error) {
      logger.error('Failed to create user profile:', error);
      throw error;
    }
  },

  updateUserProfile: async (userId: string, name: string, organization?: string): Promise<User> => {
    try {
      const data: any = await apiPost('/users/update', {
        userId,
        name,
        organization,
      });

      // Convert userId to id for frontend User type
      if (data && data.userId) {
        return {
          ...data,
          id: data.userId,
        } as User;
      }

      return data as User;
    } catch (error) {
      logger.error('Failed to update user profile:', error);
      throw error;
    }
  },

  getCompetencies: async (userId: string): Promise<UserCompetencies | null> => {
    try {
      const data = await apiGet<UserCompetencies>(`/users/${userId}/competencies`);
      return data;
    } catch (error) {
      logger.error('Failed to get competencies:', error);
      return null;
    }
  },
};

export const ChatService = {
  getSession: async (botId: string): Promise<ChatSession | null> => {
    try {
      const data = await apiGet<ChatSession>(`/chat/session/${botId}`);
      return data;
    } catch (error) {
      logger.error('Failed to get session:', error);
      return null;
    }
  },

  sendMessage: async (botId: string, userText: string): Promise<Message> => {
    try {
      const session = await fetchAuthSession();
      const userId = session.userSub;

      const data: any = await apiPost('/chat', {
        userId,
        sessionId: botId,
        message: userText,
      });

      return data.aiMessage as Message;
    } catch (error) {
      logger.error('Failed to send message:', error);
      throw error;
    }
  },

  // Real Bedrock streaming implementation
  streamMessage: async (
    botId: string,
    userText: string,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<void> => {
    try {
      const session = await fetchAuthSession();
      const userId = session.userSub;
      const token = session.tokens?.idToken?.toString();

      if (!userId) {
        throw new Error('User not authenticated');
      }

      if (!token) {
        throw new Error('No authentication token found');
      }

      const API_URL = import.meta.env.VITE_API_GATEWAY_URL;
      logger.debug('Streaming to:', `${API_URL}/chat/stream`);
      logger.debug('Stream parameters:', { userId, botId });

      const response = await fetch(`${API_URL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          sessionId: botId,
          message: userText,
        }),
        signal, // Pass AbortSignal for cancellation
      });

      if (!response.ok) {
        // 429 에러의 경우 상세 메시지 추출
        if (response.status === 429) {
          try {
            const errorData = await response.json();
            throw new Error(
              errorData.error ||
                'AI 서비스 일일 사용량이 초과되었습니다. 잠시 후 다시 시도해주세요.'
            );
          } catch (e) {
            throw new Error('AI 서비스 일일 사용량이 초과되었습니다. 잠시 후 다시 시도해주세요.');
          }
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // Parse newline-delimited JSON stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Keep the last incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const chunk = JSON.parse(line);

              if (chunk.type === 'chunk' && chunk.text) {
                onChunk(chunk.text);
              } else if (chunk.type === 'done') {
                logger.debug('Stream completed:', chunk.messageId);
              }
            } catch (parseError) {
              logger.error('Failed to parse chunk:', parseError);
              logger.debug('Problematic line:', line);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.info('Stream aborted by user');
        return;
      }
      logger.error('Failed to stream message:', error);
      throw error;
    }
  },
};

export const BotService = {
  getTemplates: async () => {
    try {
      const data = await apiGet<any>('/bots/templates');
      return data;
    } catch (error) {
      logger.error('Failed to get templates:', error);
      return [];
    }
  },

  getUserBots: async (userId: string) => {
    try {
      const data = await apiGet<any>(`/bots/user/${userId}`);
      return data;
    } catch (error) {
      logger.error('Failed to get user bots:', error);
      return [];
    }
  },

  createUserBot: async (userId: string, templateId: string, name: string) => {
    try {
      const data = await apiPost<any>('/bots/create', {
        userId,
        templateId,
        name,
      });
      return data;
    } catch (error) {
      logger.error('Failed to create user bot:', error);
      throw error;
    }
  },

  createTemplate: async (userId: string, templateData: any) => {
    try {
      const data = await apiPost<any>('/admin/templates/create', {
        userId,
        ...templateData,
      });
      return data;
    } catch (error) {
      logger.error('Failed to create template:', error);
      throw error;
    }
  },

  updateTemplate: async (userId: string, templateId: string, templateData: any) => {
    try {
      const data = await apiPost<any>('/admin/templates/update', {
        userId,
        templateId,
        ...templateData,
      });
      return data;
    } catch (error) {
      logger.error('Failed to update template:', error);
      throw error;
    }
  },

  deleteTemplate: async (userId: string, templateId: string) => {
    try {
      const data = await apiPost<any>('/admin/templates/delete', {
        userId,
        templateId,
      });
      return data;
    } catch (error) {
      logger.error('Failed to delete template:', error);
      throw error;
    }
  },

  deleteUserBot: async (userId: string, botId: string) => {
    try {
      const data = await apiPost<any>('/bots/delete', {
        userId,
        botId,
      });
      return data;
    } catch (error) {
      logger.error('Failed to delete user bot:', error);
      throw error;
    }
  },

  getRecommendedTemplates: async (userId: string) => {
    try {
      const data = await apiGet<any>(`/bots/recommended/${userId}`);
      return data;
    } catch (error) {
      logger.error('Failed to get recommended templates:', error);
      return [];
    }
  },
};

export interface UsageSummary {
  totalCost: number;
  totalTokens: number;
  totalMessages: number;
  totalUsers: number;
  avgCostPerMessage: number;
  avgCostPerUser: number;
}

export interface UserUsageStats {
  userId: string;
  name: string;
  email: string;
  organization?: string;
  totalCost: number;
  totalTokens: number;
  totalMessages: number;
  inputTokens: number;
  outputTokens: number;
  avgCostPerMessage: number;
}

export interface DailyUsageStats {
  date: string;
  totalCost: number;
  totalTokens: number;
  totalMessages: number;
}

export interface UsageStatsResponse {
  summary: UsageSummary;
  userStats: UserUsageStats[];
  dailyStats: DailyUsageStats[];
  period: {
    startDate: string;
    endDate: string;
    days: number;
  };
}

export interface TopBot {
  botId: string;
  name: string;
  usageCount: number;
}

export interface HourlyActivity {
  hour: string;
  activeUsers: number;
  messages: number;
}

export interface DashboardStatsResponse {
  today: {
    activeUsers: number;
    totalMessages: number;
    avgMessagesPerUser: number;
    questCompletionRate: number;
    completedQuests: number;
    totalQuests: number;
  };
  overall: {
    totalUsers: number;
    avgCompetencyScore: number;
    inactiveUsers7d: number;
  };
  topBots: TopBot[];
  hourlyActivity: HourlyActivity[];
  timestamp: string;
}

export const AdminService = {
  getAllUsers: async (adminUserId: string) => {
    try {
      const data = await apiGet<any>(`/admin/users?userId=${adminUserId}`);
      return data;
    } catch (error) {
      logger.error('Failed to get all users:', error);
      return [];
    }
  },

  updateUserRole: async (adminUserId: string, userId: string, role: string) => {
    try {
      const data = await apiPost<any>('/admin/users/update-role', {
        adminUserId,
        userId,
        role,
      });
      return data;
    } catch (error) {
      logger.error('Failed to update user role:', error);
      throw error;
    }
  },

  blockUser: async (userId: string, blocked: boolean) => {
    try {
      const data = await apiPost<any>('/admin/users/block', {
        userId,
        blocked,
      });
      return data;
    } catch (error) {
      logger.error('Failed to block/unblock user:', error);
      throw error;
    }
  },

  updateUserInfo: async (
    userId: string,
    name: string,
    organization?: string,
    password?: string
  ) => {
    try {
      const data = await apiPost<any>('/admin/users/update-info', {
        userId,
        name,
        organization,
        password,
      });
      return data;
    } catch (error) {
      logger.error('Failed to update user info:', error);
      throw error;
    }
  },

  getUsageStats: async (
    adminUserId: string,
    params?: {
      userId?: string;
      startDate?: string;
      endDate?: string;
      days?: number;
    }
  ): Promise<UsageStatsResponse> => {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('adminUserId', adminUserId);
      if (params?.userId) queryParams.append('userId', params.userId);
      if (params?.startDate) queryParams.append('startDate', params.startDate);
      if (params?.endDate) queryParams.append('endDate', params.endDate);
      if (params?.days) queryParams.append('days', params.days.toString());

      const url = `/admin/usage?${queryParams.toString()}`;
      const data = await apiGet<UsageStatsResponse>(url);
      return data;
    } catch (error) {
      logger.error('Failed to get usage stats:', error);
      throw error;
    }
  },

  getDashboardStats: async (adminUserId: string): Promise<DashboardStatsResponse> => {
    try {
      const url = `/admin/dashboard?adminUserId=${adminUserId}`;
      const data = await apiGet<DashboardStatsResponse>(url);
      return data;
    } catch (error) {
      logger.error('Failed to get dashboard stats:', error);
      throw error;
    }
  },

  getUserCompetencies: async (userId: string) => {
    try {
      const data = await apiGet<any>(`/users/${userId}/competencies`);
      return data;
    } catch (error) {
      logger.error('Failed to get user competencies:', error);
      return null;
    }
  },
};

export interface AssessmentOption {
  text: string;
  score: number;
}

export interface AssessmentQuestion {
  id: string;
  question: string;
  options: AssessmentOption[];
  competency: string;
}

export interface AssessmentResult {
  questionQuality: number;
  thinkingDepth: number;
  creativity: number;
  communicationClarity: number;
  executionOriented: number;
  collaborationSignal: number;
}

export interface AssessmentProgress {
  current: number;
  total: number;
}

export const AssessmentService = {
  startAssessment: async (
    userId: string
  ): Promise<{
    assessmentId: string;
    firstQuestion: AssessmentQuestion;
    totalQuestions: number;
  }> => {
    try {
      const data = await apiPost<{
        assessmentId: string;
        firstQuestion: AssessmentQuestion;
        totalQuestions: number;
      }>('/assessment/start', { userId });
      return data;
    } catch (error) {
      logger.error('Failed to start assessment:', error);
      throw error;
    }
  },

  submitAnswer: async (
    userId: string,
    assessmentId: string,
    questionId: string,
    selectedOptionIndex: number
  ): Promise<{
    isCompleted: boolean;
    nextQuestion: AssessmentQuestion | null;
    progress: AssessmentProgress;
    results: AssessmentResult | null;
  }> => {
    try {
      const data = await apiPost<{
        isCompleted: boolean;
        nextQuestion: AssessmentQuestion | null;
        progress: AssessmentProgress;
        results: AssessmentResult | null;
      }>('/assessment/submit', {
        userId,
        assessmentId,
        questionId,
        selectedOptionIndex,
      });
      return data;
    } catch (error) {
      logger.error('Failed to submit answer:', error);
      throw error;
    }
  },

  getResults: async (
    userId: string
  ): Promise<{
    assessmentId: string;
    status: string;
    results: AssessmentResult;
    completedAt: number;
    createdAt: number;
  } | null> => {
    try {
      const data = await apiGet<{
        assessmentId: string;
        status: string;
        results: AssessmentResult;
        completedAt: number;
        createdAt: number;
      } | null>(`/assessment/results/${userId}`);
      return data;
    } catch (error) {
      logger.error('Failed to get assessment results:', error);
      return null;
    }
  },
};

// Quest 타입 정의
export interface Quest {
  questId: string;
  questType: 'conversation' | 'challenge' | 'reflection';
  title: string;
  description: string;
  targetCompetency: string;
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'active' | 'completed';
  progress: {
    currentMessages: number;
    currentScore: number;
  };
  completionCriteria: {
    messageCount: number;
    minScore: number;
  };
  rewards: {
    xp: number;
    competencyBoost: Record<string, number>;
  };
  completedAt?: string;
  rewardClaimed?: boolean;
}

export interface UserQuests {
  userId: string;
  questDate: string;
  quests: Quest[];
  targetCompetency: string;
  createdAt: string;
  updatedAt?: string;
}

// Quest Service
export const QuestService = {
  getUserQuests: async (userId: string): Promise<UserQuests | null> => {
    try {
      const data = await apiGet<UserQuests>(`/quests/${userId}`);
      return data;
    } catch (error) {
      logger.error('Failed to get user quests:', error);
      return null;
    }
  },
};

// Competency History 타입 정의
export interface CompetencyHistoryData {
  date: string;
  competencies: Record<string, number>;
  messageCount: number;
}

export interface CompetencyHistory {
  history: CompetencyHistoryData[];
  startDate: string;
  endDate: string;
  totalDays: number;
}

// Competency History Service
export const CompetencyHistoryService = {
  getHistory: async (userId: string, days: number = 30): Promise<CompetencyHistory | null> => {
    try {
      const data = await apiGet<CompetencyHistory>(
        `/users/${userId}/competencies/history?days=${days}`
      );
      return data;
    } catch (error) {
      logger.error('Failed to get competency history:', error);
      return null;
    }
  },
};

// Achievement 타입 정의
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'milestone' | 'competency' | 'streak';
  tier: 'bronze' | 'silver' | 'gold';
  criteria: {
    messageCount?: number;
    questsCompleted?: number;
    competency?: string;
    score?: number;
    consecutiveDays?: number;
  };
  unlocked?: boolean;
  unlockedAt?: string;
  progress?: number;
}

export interface UserAchievements {
  unlockedAchievements: Achievement[];
  allAchievements: Achievement[];
  totalUnlocked: number;
  totalAchievements: number;
}

// Achievement Service
export const AchievementService = {
  getUserAchievements: async (userId: string): Promise<UserAchievements | null> => {
    try {
      const data = await apiGet<UserAchievements>(`/achievements/${userId}`);
      return data;
    } catch (error) {
      logger.error('Failed to get user achievements:', error);
      return null;
    }
  },
};

// Learning Analysis 타입 정의
export interface CompetencyItem {
  name: string;
  score: number;
}

export interface CompetencyAnalysis {
  strengths: CompetencyItem[];
  weaknesses: CompetencyItem[];
  balanced: CompetencyItem[];
  avgScore: number;
  highest: CompetencyItem;
  lowest: CompetencyItem;
}

export interface ActivityHour {
  hour: number;
  count: number;
  percentage: number;
}

export interface ActivityDay {
  day: number;
  dayName: string;
  count: number;
  percentage: number;
}

export interface ActivityAnalysis {
  totalMessages: number;
  avgMessageLength: number;
  peakHours: ActivityHour[];
  peakDays: ActivityDay[];
}

export interface CompetencyChange {
  name: string;
  oldScore: number;
  newScore: number;
  change: number;
  changePercent: number;
}

export interface GrowthAnalysis {
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  growthRate: number;
  improvingCompetencies: CompetencyChange[];
  decliningCompetencies: CompetencyChange[];
  daysCovered: number;
}

export interface Insight {
  type: 'strength' | 'weakness' | 'growth' | 'alert' | 'pattern' | 'achievement';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
}

export interface LearningAnalysis {
  userId: string;
  analyzedAt: string;
  competencyAnalysis: CompetencyAnalysis | null;
  activityAnalysis: ActivityAnalysis | null;
  growthAnalysis: GrowthAnalysis | null;
  insights: Insight[];
  dataAvailable: boolean;
}

// Learning Analysis Service
export const LearningAnalysisService = {
  getAnalysis: async (userId: string): Promise<LearningAnalysis | null> => {
    try {
      const data = await apiGet<LearningAnalysis>(`/analysis/${userId}`);
      return data;
    } catch (error) {
      logger.error('Failed to get learning analysis:', error);
      return null;
    }
  },
};

// Subscription Service Interfaces
export interface SubscriptionStats {
  tierDistribution: {
    FREE: number;
    TRIAL: number;
    PREMIUM: number;
    UNLIMITED: number;
  };
  quotaUsage: {
    averageUsage: number;
    nearLimitUsers: number;
    exceededUsers: number;
    totalUsage: number;
    totalLimit: number;
  };
  trialStatus: {
    activeTrials: number;
    expiringIn7Days: number;
    expired: number;
  };
  totalUsers: number;
  timestamp: string;
}

export interface UpdateTierRequest {
  adminUserId: string;
  targetUserId: string;
  newTier: 'FREE' | 'TRIAL' | 'PREMIUM' | 'UNLIMITED';
}

export interface ResetQuotaRequest {
  adminUserId: string;
  targetUserId: string;
}

export interface ExtendTrialRequest {
  adminUserId: string;
  targetUserId: string;
  additionalDays: number;
}

// Organization/Group types
export interface OrganizationInfo {
  name: string;
  userCount: number;
  tierDistribution: {
    FREE: number;
    TRIAL: number;
    PREMIUM: number;
    UNLIMITED: number;
  };
}

export interface OrganizationListResponse {
  organizations: OrganizationInfo[];
  totalOrganizations: number;
  timestamp: string;
}

export interface UpdateGroupTierRequest {
  adminUserId: string;
  organization: string;
  newTier: 'FREE' | 'TRIAL' | 'PREMIUM' | 'UNLIMITED';
}

export interface UpdateGroupTierResponse {
  success: boolean;
  message: string;
  organization: string;
  newTier: string;
  totalUsers: number;
  updatedCount: number;
  skippedCount: number;
}

// Subscription Management Service
export const SubscriptionService = {
  // Admin: 사용자 티어 변경
  updateUserTier: async (request: UpdateTierRequest): Promise<any> => {
    try {
      const data = await apiPost('/admin/subscription/update-tier', request);
      logger.info('User tier updated:', data);
      return data;
    } catch (error) {
      logger.error('Failed to update user tier:', error);
      throw error;
    }
  },

  // Admin: 할당량 리셋
  resetUserQuota: async (request: ResetQuotaRequest): Promise<any> => {
    try {
      const data = await apiPost('/admin/subscription/reset-quota', request);
      logger.info('User quota reset:', data);
      return data;
    } catch (error) {
      logger.error('Failed to reset user quota:', error);
      throw error;
    }
  },

  // Admin: 체험 기간 연장
  extendTrialPeriod: async (request: ExtendTrialRequest): Promise<any> => {
    try {
      const data = await apiPost('/admin/subscription/extend-trial', request);
      logger.info('Trial period extended:', data);
      return data;
    } catch (error) {
      logger.error('Failed to extend trial period:', error);
      throw error;
    }
  },

  // Admin: 구독 통계 조회
  getSubscriptionStats: async (adminUserId: string): Promise<SubscriptionStats | null> => {
    try {
      const data = await apiGet<SubscriptionStats>(
        `/admin/subscription/stats?adminUserId=${adminUserId}`
      );
      return data;
    } catch (error) {
      logger.error('Failed to get subscription stats:', error);
      return null;
    }
  },

  // Admin: 조직 목록 조회
  getOrganizations: async (adminUserId: string): Promise<OrganizationListResponse | null> => {
    try {
      const data = await apiGet<OrganizationListResponse>(
        `/admin/subscription/organizations?adminUserId=${adminUserId}`
      );
      return data;
    } catch (error) {
      logger.error('Failed to get organizations:', error);
      return null;
    }
  },

  // Admin: 그룹별 티어 일괄 변경
  updateGroupTier: async (request: UpdateGroupTierRequest): Promise<UpdateGroupTierResponse> => {
    try {
      const data = await apiPost<UpdateGroupTierResponse>(
        '/admin/subscription/update-group-tier',
        request
      );
      logger.info('Group tier updated:', data);
      return data;
    } catch (error) {
      logger.error('Failed to update group tier:', error);
      throw error;
    }
  },

  // User: 본인 구독 정보 조회
  getUserSubscription: async (userId: string): Promise<any> => {
    try {
      const data = await apiGet(`/users/${userId}/subscription`);
      return data;
    } catch (error) {
      logger.error('Failed to get user subscription:', error);
      return null;
    }
  },
};
