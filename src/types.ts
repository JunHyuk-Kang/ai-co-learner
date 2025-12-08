export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  level: number;
  title?: string; // e.g. "호기심 많은 탐험가"
}

export interface BotTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  themeColor?: string; // e.g., 'blue', 'purple', 'green'
  baseType?: string; // e.g., 'questioning', 'reflective', 'supportive'
  primaryCompetencies?: string[]; // 주요 육성 역량
  secondaryCompetencies?: string[]; // 부차적 육성 역량
  recommendedFor?: {
    competencyBelow?: { [key: string]: number }; // 특정 역량이 이 점수 이하일 때 추천
  };
}

export interface UserBot {
  id: string;
  userId: string;
  templateId: string;
  name: string; // User can nickname their bot
  currentLevel: number;
  createdAt: string;
}

export interface UserBotWithDetails extends UserBot {
  templateName: string;
  themeColor?: string;
  description?: string;
  primaryCompetencies?: string[];
  secondaryCompetencies?: string[];
}

export interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  thinkingProcess?: string; // Only for AI
  timestamp: number;
}

export interface ChatSession {
  id: string;
  botId: string;
  userId: string;
  messages: Message[];
}

export interface CompetencyData {
  subject: string;
  A: number;
  fullMark: number;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  achieved: boolean;
}