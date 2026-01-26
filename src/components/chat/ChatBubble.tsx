import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '../../types';
import { Bot, User, BrainCircuit, ChevronDown, ChevronUp } from 'lucide-react';

interface ChatBubbleProps {
  message: Message;
  agentName: string;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, agentName }) => {
  const [isThinkingOpen, setIsThinkingOpen] = useState(false);
  const isAI = message.sender === 'ai';

  return (
    <div className={`flex w-full mb-6 ${isAI ? 'justify-start' : 'justify-end'}`}>
      <div className={`flex max-w-[80%] ${isAI ? 'flex-row' : 'flex-row-reverse'}`}>
        {/* Avatar */}
        <div
          className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center mt-1 ${isAI ? 'bg-surface border border-primary/30 text-primary mr-3' : 'bg-gray-700 text-gray-300 ml-3'}`}
        >
          {isAI ? <Bot size={16} /> : <User size={16} />}
        </div>

        <div className="flex flex-col">
          {/* Name Label */}
          <span className={`text-xs text-gray-500 mb-1 ${isAI ? 'text-left' : 'text-right'}`}>
            {isAI ? agentName : '나'}
          </span>

          {/* Thinking Process Accordion (Only for AI) */}
          {isAI && message.thinkingProcess && (
            <div className="mb-2">
              <button
                onClick={() => setIsThinkingOpen(!isThinkingOpen)}
                className="flex items-center gap-2 text-xs font-medium text-primary hover:text-primary-hover transition-colors bg-primary/10 px-3 py-1.5 rounded-full"
              >
                <BrainCircuit size={14} />
                생각하는 과정 표시
                {isThinkingOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {isThinkingOpen && (
                <div className="mt-2 p-3 bg-[#1A1A1A] border border-primary/20 rounded-lg text-xs text-gray-400 whitespace-pre-line animate-in fade-in slide-in-from-top-2">
                  <div className="font-bold text-primary mb-1">Agent Logic Trace:</div>
                  {message.thinkingProcess}
                </div>
              )}
            </div>
          )}

          {/* Message Content */}
          <div
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
              isAI
                ? 'bg-surface border border-border text-gray-200 rounded-tl-none'
                : 'bg-primary text-white rounded-tr-none'
            }`}
          >
            {isAI ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                className="markdown-content"
                components={{
                  // Style headings
                  h1: props => <h1 className="text-xl font-bold mb-2 mt-3 first:mt-0" {...props} />,
                  h2: props => <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0" {...props} />,
                  h3: props => (
                    <h3 className="text-base font-bold mb-2 mt-2 first:mt-0" {...props} />
                  ),
                  // Style lists
                  ul: props => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                  ol: props => (
                    <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />
                  ),
                  li: props => <li className="ml-2" {...props} />,
                  // Style paragraphs
                  p: props => <p className="mb-2 last:mb-0" {...props} />,
                  // Style code blocks
                  code: ({ inline, ...props }: any) =>
                    inline ? (
                      <code
                        className="bg-gray-800 px-1.5 py-0.5 rounded text-xs font-mono text-green-400"
                        {...props}
                      />
                    ) : (
                      <code
                        className="block bg-gray-900 p-3 rounded-lg mb-2 text-xs font-mono overflow-x-auto"
                        {...props}
                      />
                    ),
                  // Style blockquotes
                  blockquote: props => (
                    <blockquote
                      className="border-l-4 border-primary pl-3 italic my-2 text-gray-400"
                      {...props}
                    />
                  ),
                  // Style links
                  a: props => (
                    <a className="text-primary hover:text-primary-hover underline" {...props} />
                  ),
                  // Style horizontal rules
                  hr: props => <hr className="my-3 border-border" {...props} />,
                  // Style strong/bold
                  strong: props => <strong className="font-bold text-white" {...props} />,
                }}
              >
                {message.text}
              </ReactMarkdown>
            ) : (
              message.text
            )}
          </div>

          {/* Timestamp */}
          <span className={`text-[10px] text-gray-600 mt-1 ${isAI ? 'text-left' : 'text-right'}`}>
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>
    </div>
  );
};
