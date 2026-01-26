import { useQuery } from '@tanstack/react-query';
import { UserService, ChatService, BotService, AdminService } from '../services/awsBackend';

// User Queries
export const useUserProfile = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => UserService.getUserProfile(userId!),
    enabled: !!userId,
  });
};

export const useUserCompetencies = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['competencies', userId],
    queryFn: () => UserService.getCompetencies(userId!),
    enabled: !!userId,
  });
};

// Chat Queries
export const useChatSession = (botId: string | undefined) => {
  return useQuery({
    queryKey: ['chatSession', botId],
    queryFn: () => ChatService.getSession(botId!),
    enabled: !!botId,
  });
};

// Bot Queries
export const useBotTemplates = () => {
  return useQuery({
    queryKey: ['botTemplates'],
    queryFn: () => BotService.getTemplates(),
  });
};

export const useUserBots = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['userBots', userId],
    queryFn: () => BotService.getUserBots(userId!),
    enabled: !!userId,
  });
};

// Admin Queries
export const useAllUsers = () => {
  return useQuery({
    queryKey: ['allUsers'],
    queryFn: () => AdminService.getAllUsers(),
  });
};
