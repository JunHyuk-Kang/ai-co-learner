import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { ChatService } from '../services/awsBackend';
import { ChatSession, Message } from '../types';
import { ChatBubble } from '../components/chat/ChatBubble';
import { Button } from '../components/ui/Button';
import { Send, MoreHorizontal, AlertCircle } from 'lucide-react';

export const ChatRoom: React.FC = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
  }, [session?.messages]);

  const handleSend = async () => {
    if (!input.trim() || !agentId || isTyping) return;

    const userText = input;
    setInput('');
    
    // Optimistic update for user message
    setSession(prev => {
        if (!prev) return null;
        return {
            ...prev,
            messages: [
                ...prev.messages,
                { id: 'temp', sender: 'user', text: userText, timestamp: Date.now() }
            ]
        };
    });

    setIsTyping(true);

    try {
      await ChatService.sendMessage(agentId, userText);
      // Re-fetch session to get AI response with correct structure
      const updatedSession = await ChatService.getSession(agentId);
      setSession(updatedSession);
    } catch (error) {
      console.error("Failed to send message", error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!session) return <div className="flex-1 flex items-center justify-center text-gray-500">Loading chat...</div>;

  return (
    <div className="flex-1 flex flex-col h-full max-h-screen">
      {/* Header */}
      <header className="h-16 border-b border-border bg-background/95 backdrop-blur flex items-center justify-between px-6 z-10">
        <div>
            <div className="flex items-center gap-2">
                <h2 className="font-bold text-white">나의 질문 코치</h2>
                <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-bold">Lv.3</span>
            </div>
            <p className="text-xs text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Online
            </p>
        </div>
        <Button variant="ghost" size="sm">
            <MoreHorizontal size={20} />
        </Button>
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
                agentName="질문력 에이전트" 
            />
            ))}
            
            {isTyping && (
                <div className="flex items-center gap-2 text-gray-500 text-xs ml-12 animate-pulse">
                    Thinking...
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-background border-t border-border sticky bottom-0 z-20">
        <div className="max-w-3xl mx-auto relative">
            <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지를 입력하세요..."
                className="w-full bg-surface text-gray-100 rounded-xl pl-4 pr-14 py-3 resize-none min-h-[48px] max-h-[120px] transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 border border-border"
            />
            <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="absolute right-2 bottom-2 p-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors z-10"
            >
                <Send size={18} />
            </button>
        </div>
        <div className="text-center mt-2 text-[10px] text-gray-500">
            AI can make mistakes. Check important info.
        </div>
      </div>
    </div>
  );
};