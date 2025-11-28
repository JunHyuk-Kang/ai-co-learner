import { fetchAuthSession } from 'aws-amplify/auth';
import { User, ChatSession, Message } from '../types';
import { apiGet, apiPost } from './apiUtils';

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
      console.error('Failed to get user profile:', error);
      return null;
    }
  },

  createUserProfile: async (userId: string, username: string, name: string): Promise<User> => {
    try {
      const data: any = await apiPost('/users', {
        userId,
        username,
        name,
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
      console.error('Failed to create user profile:', error);
      throw error;
    }
  },

  updateUserProfile: async (userId: string, name: string): Promise<User> => {
    try {
      const data: any = await apiPost('/users/update', {
        userId,
        name,
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
      console.error('Failed to update user profile:', error);
      throw error;
    }
  },

  getCompetencies: async (userId: string): Promise<UserCompetencies | null> => {
    try {
      const data = await apiGet<UserCompetencies>(`/users/${userId}/competencies`);
      return data;
    } catch (error) {
      console.error('Failed to get competencies:', error);
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
      console.error('Failed to get session:', error);
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
      console.error('Failed to send message:', error);
      throw error;
    }
  },
};

export const BotService = {
  getTemplates: async () => {
    try {
      const data = await apiGet('/bots/templates');
      return data;
    } catch (error) {
      console.error('Failed to get templates:', error);
      return [];
    }
  },

  getUserBots: async (userId: string) => {
    try {
      const data = await apiGet(`/bots/user/${userId}`);
      return data;
    } catch (error) {
      console.error('Failed to get user bots:', error);
      return [];
    }
  },

  createUserBot: async (userId: string, templateId: string, name: string) => {
    try {
      const data = await apiPost('/bots/create', {
        userId,
        templateId,
        name,
      });
      return data;
    } catch (error) {
      console.error('Failed to create user bot:', error);
      throw error;
    }
  },

  createTemplate: async (templateData: any) => {
    try {
      const data = await apiPost('/admin/templates/create', templateData);
      return data;
    } catch (error) {
      console.error('Failed to create template:', error);
      throw error;
    }
  },

  updateTemplate: async (templateId: string, templateData: any) => {
    try {
      const data = await apiPost('/admin/templates/update', {
        templateId,
        ...templateData,
      });
      return data;
    } catch (error) {
      console.error('Failed to update template:', error);
      throw error;
    }
  },

  deleteTemplate: async (templateId: string) => {
    try {
      const data = await apiPost('/admin/templates/delete', {
        templateId,
      });
      return data;
    } catch (error) {
      console.error('Failed to delete template:', error);
      throw error;
    }
  },
};

export const AdminService = {
  getAllUsers: async () => {
    try {
      const data = await apiGet('/admin/users');
      return data;
    } catch (error) {
      console.error('Failed to get all users:', error);
      return [];
    }
  },

  updateUserRole: async (userId: string, role: string) => {
    try {
      const data = await apiPost('/admin/users/update-role', {
        userId,
        role,
      });
      return data;
    } catch (error) {
      console.error('Failed to update user role:', error);
      throw error;
    }
  },

  blockUser: async (userId: string, blocked: boolean) => {
    try {
      const data = await apiPost('/admin/users/block', {
        userId,
        blocked,
      });
      return data;
    } catch (error) {
      console.error('Failed to block/unblock user:', error);
      throw error;
    }
  },
};
