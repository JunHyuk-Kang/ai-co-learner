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
}

export interface UserBot {
  id: string;
  userId: string;
  templateId: string;
  name: string; // User can nickname their bot
  currentLevel: number;
  createdAt: string;
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