import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserBotWithDetails } from '../types';
import { BotService } from '../services/awsBackend';
import { useAuth } from './AuthContext';

interface BotContextType {
  bots: UserBotWithDetails[];
  loadBots: () => Promise<void>;
  isLoading: boolean;
}

const BotContext = createContext<BotContextType | undefined>(undefined);

export const BotProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [bots, setBots] = useState<UserBotWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadBots = async () => {
    if (!user) {
      setBots([]);
      return;
    }

    setIsLoading(true);
    try {
      const userBots = await BotService.getUserBots(user.id);
      setBots(userBots);
    } catch (error) {
      console.error('Failed to load bots:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBots();
  }, [user]);

  return (
    <BotContext.Provider value={{ bots, loadBots, isLoading }}>
      {children}
    </BotContext.Provider>
  );
};

export const useBots = () => {
  const context = useContext(BotContext);
  if (!context) {
    throw new Error('useBots must be used within BotProvider');
  }
  return context;
};
