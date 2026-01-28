export enum Role {
  USER = 'USER',
  SUPER_USER = 'SUPER_USER',
  ADMIN = 'ADMIN',
}

// Subscription Tiers
export enum SubscriptionTier {
  FREE = 'FREE',
  TRIAL = 'TRIAL',
  PREMIUM = 'PREMIUM',
  UNLIMITED = 'UNLIMITED',
}

// Message Quota Interface
export interface MessageQuota {
  monthlyLimit: number; // -1 for unlimited
  currentMonthUsage: number;
  lastResetDate: string; // ISO date (YYYY-MM-DD)
  nextResetDate: string; // ISO date (YYYY-MM-DD)
}

// Trial Period Interface (TRIAL tier only)
export interface TrialPeriod {
  startDate: string; // ISO timestamp
  endDate: string; // ISO timestamp
  isExpired: boolean;
  daysRemaining: number;
}

// Subscription Metadata
export interface SubscriptionMetadata {
  upgradedAt?: string; // ISO timestamp
  upgradedFrom?: SubscriptionTier;
  autoRenew: boolean;
  billingCycle?: 'monthly' | 'yearly' | 'lifetime';
}

// Tier Configuration
export interface TierConfig {
  name: SubscriptionTier;
  monthlyMessageLimit: number; // -1 for unlimited
  trialPeriodDays: number; // 0 for no trial
  features: string[];
  displayName: string;
  colorClass: string;
}

export const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
  FREE: {
    name: SubscriptionTier.FREE,
    monthlyMessageLimit: 50,
    trialPeriodDays: 0,
    features: ['50 messages/month', 'Lifetime access', 'Basic bots'],
    displayName: '무료',
    colorClass: 'bg-gray-500',
  },
  TRIAL: {
    name: SubscriptionTier.TRIAL,
    monthlyMessageLimit: 1000,
    trialPeriodDays: 30,
    features: ['1,000 messages/month', '30-day trial', 'All bots'],
    displayName: '체험',
    colorClass: 'bg-blue-500',
  },
  PREMIUM: {
    name: SubscriptionTier.PREMIUM,
    monthlyMessageLimit: 1500,
    trialPeriodDays: 0,
    features: ['1,500 messages/month', 'Lifetime access', 'All bots', 'Priority support'],
    displayName: '프리미엄',
    colorClass: 'bg-purple-500',
  },
  UNLIMITED: {
    name: SubscriptionTier.UNLIMITED,
    monthlyMessageLimit: -1,
    trialPeriodDays: 0,
    features: ['Unlimited messages', 'Lifetime access', 'All features', '24/7 support'],
    displayName: '무제한',
    colorClass: 'bg-amber-500',
  },
};

export interface User {
  id: string;
  username: string;
  name: string;
  organization?: string; // 사용자 소속 (회사, 학교 등)
  role: Role;
  level: number;
  title?: string; // e.g. "호기심 많은 탐험가"
  subscriptionTier: SubscriptionTier;
  messageQuota: MessageQuota;
  trialPeriod?: TrialPeriod; // Only for TRIAL tier
  subscriptionMetadata?: SubscriptionMetadata;
}

export interface BotTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  themeColor?: string; // e.g., 'blue', 'purple', 'green'
  baseType?: string; // e.g., 'questioning', 'reflective', 'supportive'
  organizationId?: string; // 'GLOBAL' 또는 조직명 (e.g., '어정중학교')
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

// Subscription Error Types
export interface QuotaExceededError {
  error: 'QUOTA_EXCEEDED';
  message: string;
  currentUsage: number;
  monthlyLimit: number;
  resetDate: string;
  tier: SubscriptionTier;
}

export interface TrialExpiredError {
  error: 'TRIAL_EXPIRED';
  message: string;
  expiredDate: string;
  tier: SubscriptionTier;
}
