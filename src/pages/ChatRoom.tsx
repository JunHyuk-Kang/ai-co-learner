import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChatService } from '../services/awsBackend';
import { ChatSession, Message } from '../types';
import { ChatBubble } from '../components/chat/ChatBubble';
import { Button } from '../components/ui/Button';
import { Send, MoreHorizontal, AlertCircle, Square, Book } from 'lucide-react';
import { useBots } from '../contexts/BotContext';
import { useChatStream } from '../hooks/useChatStream';

export const ChatRoom: React.FC = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { bots } = useBots();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Find the current bot info
  const currentBot = bots.find(bot => bot.id === agentId);

  const { isStreaming, streamMessage, stopStream } = useChatStream({
    onChunk: (chunk) => {
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
                timestamp: Date.now()
              }
            ]
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
          })
        };
      });
    },
    onComplete: () => {
      // Optional: Refresh session from server to ensure sync
      // if (agentId) ChatService.getSession(agentId).then(setSession);
    },
    onError: (error) => {
      console.error("Streaming error:", error);
    }
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
          { id: `user-${Date.now()}`, sender: 'user', text: userText, timestamp: Date.now() }
        ]
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

  if (!session) return <div className="flex-1 flex items-center justify-center text-gray-500">Loading chat...</div>;

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
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/knowledge-base')} title="Knowledge Base">
            <Book size={20} className="text-gray-400 hover:text-white transition-colors" />
          </Button>
          <Button variant="ghost" size="sm">
            <MoreHorizontal size={20} />
          </Button>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-[#0A0A0A]">
        <div className="max-w-3xl mx-auto">
          <div className="bg-blue-900/20 border border-blue-900/50 p-3 rounded-lg mb-8 flex items-start gap-3">
            <AlertCircle className="text-blue-400 shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-blue-200">
              <span className="font-bold block mb-0.5">학습 목표: 질문 구체화하기</span>
              이 에이전트는 사용자가 5W1H(누가, 언제, 어디서, 무엇을, 어떻게, 왜)를 명확히 할 때까지 답을 주지 않고 되묻습니다.
            </p>
          </div>

          {session.messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              message={msg}
              agentName={currentBot?.templateName || currentBot?.name || 'AI'}
            />
          ))}

          {isStreaming && session.messages[session.messages.length - 1]?.sender === 'user' && (
            <div className="flex items-center gap-2 text-gray-500 text-xs ml-12 animate-pulse">
              Thinking...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-background border-t border-border shrink-0 z-20">
        <div className="max-w-3xl mx-auto relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요..."
            disabled={isStreaming}
            className="w-full bg-surface text-gray-100 rounded-xl pl-4 pr-14 py-3 resize-none min-h-[48px] max-h-[120px] transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 border border-border disabled:opacity-50"
          />
          {isStreaming ? (
            <button
              onClick={stopStream}
              className="absolute right-2 bottom-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors z-10"
            >
              <Square size={18} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
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
    </div>
  );
};