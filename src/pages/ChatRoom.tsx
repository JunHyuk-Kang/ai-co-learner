import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChatService, UserService } from '../services/awsBackend';
import {
  ChatSession,
  Message,
  SubscriptionTier,
  QuotaExceededError,
  TrialExpiredError,
} from '../types';
import { ChatBubble } from '../components/chat/ChatBubble';
import { StreamingIndicator } from '../components/chat/StreamingIndicator';
import { Button } from '../components/ui/Button';
import { Send, MoreHorizontal, AlertCircle, Square, Book, Zap, Clock } from 'lucide-react';
import { useBots } from '../contexts/BotContext';
import { useChatStream } from '../hooks/useChatStream';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

export const ChatRoom: React.FC = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { bots } = useBots();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [input, setInput] = useState('');
  const [streamError, setStreamError] = useState<string | null>(null);
  const [quotaExceededError, setQuotaExceededError] = useState<QuotaExceededError | null>(null);
  const [trialExpiredError, setTrialExpiredError] = useState<TrialExpiredError | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Find the current bot info
  const currentBot = bots.find(bot => bot.id === agentId);

  // Subscription tier and quota info
  const subscriptionTier = user?.subscriptionTier || SubscriptionTier.UNLIMITED;
  const messageQuota = user?.messageQuota;
  const trialPeriod = user?.trialPeriod;

  const { isStreaming, streamMessage, stopStream } = useChatStream({
    onChunk: chunk => {
      setSession(prev => {
        if (!prev) return null;
        const lastMsg = prev.messages[prev.messages.length - 1];

        // If last message is from user, add new AI message
        if (lastMsg.sender === 'user') {
          return {
            ...prev,
            messages: [
              ...prev.messages,
              {
                id: `ai-${Date.now()}`,
                sender: 'ai',
                text: chunk,
                timestamp: Date.now(),
              },
            ],
          };
        }

        // Append to existing AI message
        return {
          ...prev,
          messages: prev.messages.map((msg, index) => {
            if (index === prev.messages.length - 1) {
              return { ...msg, text: msg.text + chunk };
            }
            return msg;
          }),
        };
      });
    },
    onComplete: () => {
      // Optional: Refresh session from server to ensure sync
      // if (agentId) ChatService.getSession(agentId).then(setSession);
    },
    onError: error => {
      logger.error('Streaming error:', error);

      // Check for quota exceeded error
      if (error.message?.includes('QUOTA_EXCEEDED')) {
        try {
          const errorData = JSON.parse(error.message.replace('QUOTA_EXCEEDED: ', ''));
          setQuotaExceededError(errorData);
          return;
        } catch (e) {
          logger.error('Failed to parse quota exceeded error', e);
        }
      }

      // Check for trial expired error
      if (error.message?.includes('TRIAL_EXPIRED')) {
        try {
          const errorData = JSON.parse(error.message.replace('TRIAL_EXPIRED: ', ''));
          setTrialExpiredError(errorData);
          return;
        } catch (e) {
          logger.error('Failed to parse trial expired error', e);
        }
      }

      setStreamError(error.message || 'Failed to stream message');
      // Show error message in chat
      setSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          messages: [
            ...prev.messages,
            {
              id: `error-${Date.now()}`,
              sender: 'ai',
              text: `⚠️ Error: ${error.message || 'Failed to get response'}. Please try again.`,
              timestamp: Date.now(),
            },
          ],
        };
      });
    },
  });

  useEffect(() => {
    if (agentId) {
      ChatService.getSession(agentId).then(setSession);
    }
  }, [agentId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [session?.messages, isStreaming]);

  const handleSend = async () => {
    if (!input.trim() || !agentId || isStreaming) return;

    const userText = input;
    setInput('');

    // Optimistic update for user message
    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        messages: [
          ...prev.messages,
          { id: `user-${Date.now()}`, sender: 'user', text: userText, timestamp: Date.now() },
        ],
      };
    });

    await streamMessage(agentId, userText);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!session)
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">Loading chat...</div>
    );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-border bg-background/95 backdrop-blur flex items-center justify-between px-6 z-10 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-white">{currentBot?.name || '로딩 중...'}</h2>
            <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-bold">
              Lv.{currentBot?.currentLevel || 1}
            </span>
          </div>
          <p className="text-xs text-green-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Online
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Quota Display */}
          {subscriptionTier !== SubscriptionTier.UNLIMITED && messageQuota && (
            <div className="flex items-center gap-3 px-3 py-1.5 bg-surface rounded-lg border border-border">
              <div className="flex items-center gap-1.5">
                <Zap size={14} className="text-amber-400" />
                <span className="text-xs text-gray-300">
                  {messageQuota.monthlyLimit - messageQuota.currentMonthUsage}/
                  {messageQuota.monthlyLimit}
                </span>
              </div>
              {subscriptionTier === SubscriptionTier.TRIAL && trialPeriod && (
                <>
                  <div className="w-px h-4 bg-border" />
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className="text-blue-400" />
                    <span className="text-xs text-gray-300">
                      {trialPeriod.daysRemaining}일 남음
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/knowledge-base')}
              title="Knowledge Base"
            >
              <Book size={20} className="text-gray-400 hover:text-white transition-colors" />
            </Button>
            <Button variant="ghost" size="sm">
              <MoreHorizontal size={20} />
            </Button>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-[#0A0A0A]">
        <div className="max-w-3xl mx-auto">
          {streamError && (
            <div className="bg-error/10 border border-error/30 p-3 rounded-lg mb-4 flex items-start gap-3">
              <AlertCircle className="text-error shrink-0 mt-0.5" size={16} />
              <div>
                <p className="text-xs text-error font-bold">Stream Error</p>
                <p className="text-xs text-error/80 mt-1">{streamError}</p>
                <button
                  onClick={() => setStreamError(null)}
                  className="text-xs text-error/60 hover:text-error mt-1 underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {session.messages.map(msg => (
            <ChatBubble
              key={msg.id}
              message={msg}
              agentName={currentBot?.templateName || currentBot?.name || 'AI'}
            />
          ))}

          {isStreaming && session.messages[session.messages.length - 1]?.sender === 'user' && (
            <StreamingIndicator agentName={currentBot?.templateName || currentBot?.name || 'AI'} />
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-background border-t border-border shrink-0 z-20">
        <div className="max-w-3xl mx-auto relative">
          {/* Quota Exceeded Warning */}
          {subscriptionTier !== SubscriptionTier.UNLIMITED &&
            messageQuota &&
            messageQuota.currentMonthUsage >= messageQuota.monthlyLimit && (
              <div className="mb-3 p-3 bg-error/10 border border-error/30 rounded-lg flex items-start gap-3">
                <AlertCircle className="text-error shrink-0 mt-0.5" size={16} />
                <div className="flex-1">
                  <p className="text-xs text-error font-bold">메시지 할당량 초과</p>
                  <p className="text-xs text-error/80 mt-1">
                    이번 달 메시지 한도({messageQuota.monthlyLimit}개)에 도달했습니다.
                    {messageQuota.nextResetDate && ` ${messageQuota.nextResetDate}에 리셋됩니다.`}
                  </p>
                </div>
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="px-3 py-1 bg-error text-white rounded text-xs font-bold hover:bg-error/80 transition-colors"
                >
                  문의하기
                </button>
              </div>
            )}

          {/* Trial Expired Warning */}
          {subscriptionTier === SubscriptionTier.TRIAL && trialPeriod && trialPeriod.isExpired && (
            <div className="mb-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="text-blue-400 shrink-0 mt-0.5" size={16} />
              <div className="flex-1">
                <p className="text-xs text-blue-400 font-bold">체험 기간 종료</p>
                <p className="text-xs text-blue-400/80 mt-1">
                  30일 체험 기간이 종료되었습니다. 계속 사용하려면 플랜을 업그레이드하세요.
                </p>
              </div>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="px-3 py-1 bg-blue-500 text-white rounded text-xs font-bold hover:bg-blue-400 transition-colors"
              >
                문의하기
              </button>
            </div>
          )}

          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              subscriptionTier !== SubscriptionTier.UNLIMITED &&
              messageQuota &&
              messageQuota.currentMonthUsage >= messageQuota.monthlyLimit
                ? '메시지 할당량이 초과되었습니다...'
                : subscriptionTier === SubscriptionTier.TRIAL &&
                    trialPeriod &&
                    trialPeriod.isExpired
                  ? '체험 기간이 종료되었습니다...'
                  : '메시지를 입력하세요...'
            }
            disabled={
              isStreaming ||
              (subscriptionTier !== SubscriptionTier.UNLIMITED &&
                messageQuota &&
                messageQuota.currentMonthUsage >= messageQuota.monthlyLimit) ||
              (subscriptionTier === SubscriptionTier.TRIAL && trialPeriod && trialPeriod.isExpired)
            }
            className="w-full bg-surface text-gray-100 rounded-xl pl-4 pr-14 py-3 resize-none min-h-[48px] max-h-[120px] transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 border border-border disabled:opacity-50"
          />
          {isStreaming ? (
            <button
              onClick={stopStream}
              className="absolute right-2 bottom-2 p-2 rounded-lg transition-colors z-10"
              style={{
                backgroundColor: '#EF4444',
                color: '#FFFFFF',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#DC2626')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#EF4444')}
            >
              <Square size={18} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={
                !input.trim() ||
                (subscriptionTier !== SubscriptionTier.UNLIMITED &&
                  messageQuota &&
                  messageQuota.currentMonthUsage >= messageQuota.monthlyLimit) ||
                (subscriptionTier === SubscriptionTier.TRIAL &&
                  trialPeriod &&
                  trialPeriod.isExpired)
              }
              className="absolute right-2 bottom-2 p-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors z-10"
            >
              <Send size={18} />
            </button>
          )}
        </div>
        <div className="text-center mt-2 text-[10px] text-gray-500">
          AI can make mistakes. Check important info.
        </div>
      </div>

      {/* Quota Exceeded Modal */}
      {quotaExceededError && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-error/20">
                <AlertCircle className="text-error" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2">메시지 할당량 초과</h3>
                <p className="text-sm text-gray-300 mb-4">{quotaExceededError.message}</p>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">현재 사용량</span>
                    <span className="text-white font-bold">
                      {quotaExceededError.currentUsage}개
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">월간 한도</span>
                    <span className="text-white font-bold">
                      {quotaExceededError.monthlyLimit}개
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">리셋 날짜</span>
                    <span className="text-white font-bold">{quotaExceededError.resetDate}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">현재 티어</span>
                    <span className="text-amber-400 font-bold">{quotaExceededError.tier}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setQuotaExceededError(null)}
                className="flex-1 px-4 py-2 bg-surface border border-border text-white rounded-lg hover:bg-border/20 transition-colors"
              >
                닫기
              </button>
              <button
                onClick={() => {
                  setQuotaExceededError(null);
                  setShowUpgradeModal(true);
                }}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-bold"
              >
                문의하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trial Expired Modal */}
      {trialExpiredError && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-blue-500/20">
                <Clock className="text-blue-400" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2">체험 기간 종료</h3>
                <p className="text-sm text-gray-300 mb-4">{trialExpiredError.message}</p>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">종료 날짜</span>
                    <span className="text-white font-bold">
                      {new Date(trialExpiredError.expiredDate).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">현재 티어</span>
                    <span className="text-blue-400 font-bold">{trialExpiredError.tier}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  계속 사용하려면 PREMIUM 또는 UNLIMITED 플랜으로 업그레이드하세요.
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setTrialExpiredError(null)}
                className="flex-1 px-4 py-2 bg-surface border border-border text-white rounded-lg hover:bg-border/20 transition-colors"
              >
                닫기
              </button>
              <button
                onClick={() => {
                  setTrialExpiredError(null);
                  setShowUpgradeModal(true);
                }}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-400 transition-colors font-bold"
              >
                문의하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Contact Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 rounded-full bg-primary/20">
                <Zap className="text-primary" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2">플랜 업그레이드 문의</h3>
                <p className="text-sm text-gray-300">
                  더 많은 메시지와 기능을 사용하고 싶으신가요?
                  <br />
                  관리자에게 문의해주세요.
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6 bg-background/50 p-4 rounded-lg">
              <div>
                <p className="text-xs text-gray-400 mb-1">현재 티어</p>
                <p className="text-sm text-white font-bold">{subscriptionTier}</p>
              </div>
              {messageQuota && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">사용량</p>
                  <p className="text-sm text-white font-bold">
                    {messageQuota.currentMonthUsage} /{' '}
                    {messageQuota.monthlyLimit === -1 ? '무제한' : messageQuota.monthlyLimit}
                  </p>
                </div>
              )}
              <div className="pt-3 border-t border-border">
                <p className="text-xs text-gray-400 mb-2">문의 방법</p>
                <p className="text-sm text-white">
                  관리자에게 직접 연락하여 플랜 업그레이드를 요청하세요.
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  관리자가 귀하의 계정을 원하는 티어로 변경해드립니다.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="flex-1 px-4 py-2 bg-surface border border-border text-white rounded-lg hover:bg-border/20 transition-colors"
              >
                닫기
              </button>
              <button
                onClick={() => {
                  setShowUpgradeModal(false);
                  // 나중에 UserProfile 페이지에 문의 폼 추가 가능
                }}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-bold"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
