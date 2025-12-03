import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserService, ChatService, BotService, AdminService } from '../services/awsBackend';

// User Mutations
export const useCreateUserProfile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, username, name }: { userId: string; username: string; name: string }) =>
            UserService.createUserProfile(userId, username, name),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['user', data.id] });
        },
    });
};

export const useUpdateUserProfile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, name }: { userId: string; name: string }) =>
            UserService.updateUserProfile(userId, name),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['user', data.id] });
        },
    });
};

// Chat Mutations
export const useSendMessage = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ botId, message }: { botId: string; message: string }) =>
            ChatService.sendMessage(botId, message),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['chatSession', variables.botId] });
        },
    });
};

// Bot Mutations
export const useCreateUserBot = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, templateId, name }: { userId: string; templateId: string; name: string }) =>
            BotService.createUserBot(userId, templateId, name),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['userBots', variables.userId] });
        },
    });
};

export const useDeleteUserBot = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, botId }: { userId: string; botId: string }) =>
            BotService.deleteUserBot(userId, botId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['userBots', variables.userId] });
        },
    });
};

// Admin Mutations
export const useCreateTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (templateData: any) => BotService.createTemplate(templateData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['botTemplates'] });
        },
    });
};

export const useUpdateUserRole = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, role }: { userId: string; role: string }) =>
            AdminService.updateUserRole(userId, role),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['allUsers'] });
        },
    });
};
