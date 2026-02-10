'use client';

import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, getChatHistory } from '@/lib/api';

interface ChatMessage {
  text: string;
  type: 'user' | 'assistant';
}

interface FloatingChatWidgetProps {
  clientId: string;
}

const SUGGESTED_QUESTIONS = [
  'Jakie byly najczestsze pytania wczoraj?',
  'Ile kosztowaly rozmowy w tym tygodniu?',
  'Pokaz luki w bazie wiedzy',
];

/**
 * Simple markdown renderer for AI responses.
 * Handles: **bold**, bullet lists (- / *), numbered lists (1.), paragraphs.
 */
function renderMarkdown(text: string): React.ReactElement {
  const lines = text.split('\n');
  const elements: React.ReactElement[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let key = 0;

  const flushList = () => {
    if (!currentList) return;
    const items = currentList.items.map((item, i) => (
      <li key={i} dangerouslySetInnerHTML={{ __html: inlineMd(item) }} />
    ));
    if (currentList.type === 'ul') {
      elements.push(<ul key={key++} className="list-disc pl-4 my-1 space-y-0.5">{items}</ul>);
    } else {
      elements.push(<ol key={key++} className="list-decimal pl-4 my-1 space-y-0.5">{items}</ol>);
    }
    currentList = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^[-*]\s+/.test(trimmed)) {
      const content = trimmed.replace(/^[-*]\s+/, '');
      if (currentList?.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList!.items.push(content);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const content = trimmed.replace(/^\d+\.\s+/, '');
      if (currentList?.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList!.items.push(content);
      continue;
    }

    flushList();

    if (!trimmed) {
      elements.push(<div key={key++} className="h-1.5" />);
      continue;
    }

    elements.push(
      <p key={key++} dangerouslySetInnerHTML={{ __html: inlineMd(trimmed) }} />
    );
  }

  flushList();
  return <>{elements}</>;
}

function inlineMd(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

export default function FloatingChatWidget({ clientId }: FloatingChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history on first open
  useEffect(() => {
    if (!isOpen || historyLoaded || !clientId) return;

    const loadHistory = async () => {
      try {
        const data = await getChatHistory(clientId, 50);
        if (data.messages && data.messages.length > 0) {
          setMessages(
            data.messages.map((msg) => ({
              text: msg.content,
              type: msg.role,
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      } finally {
        setHistoryLoaded(true);
      }
    };

    loadHistory();
  }, [isOpen, historyLoaded, clientId]);

  // Auto-scroll
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isTyping || !clientId) return;

    const userMessage = inputValue.trim();
    setMessages(prev => [...prev, { text: userMessage, type: 'user' }]);
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await sendChatMessage(clientId, userMessage);
      setMessages(prev => [...prev, { text: response.message, type: 'assistant' }]);
    } catch {
      setMessages(prev => [...prev, {
        text: 'Przepraszam, wystapil blad. Sprobuj ponownie.',
        type: 'assistant'
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSuggestionClick = (question: string) => {
    setInputValue(question);
  };

  return (
    <>
      {/* Toggle Button - round, dark, minimal */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed z-[2003] flex items-center justify-center transition-all duration-300"
        style={{
          bottom: '24px',
          right: 'var(--floating-chat-right)',
          width: 'var(--floating-chat-btn-width)',
          height: 'var(--floating-chat-btn-height)',
          borderRadius: '50%',
          background: isOpen
            ? 'rgba(255, 255, 255, 0.1)'
            : 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
          cursor: 'pointer',
        }}
      >
        {isOpen ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div
          className="fixed z-[2000] flex flex-col"
          style={{
            bottom: 'calc(24px + var(--floating-chat-btn-height) + 12px)',
            right: 'var(--floating-chat-right)',
            width: 'var(--floating-chat-widget-width)',
            height: 'var(--floating-chat-widget-height)',
            background: 'rgba(12, 12, 14, 0.96)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            boxShadow: '0 24px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.04) inset',
            overflow: 'hidden',
            animation: 'chatSlideUp 0.25s ease-out',
          }}
        >
          {/* Header */}
          <div
            className="px-5 py-3.5 flex items-center gap-3"
            style={{
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
              </svg>
            </div>
            <div>
              <span className="text-[13px] font-medium text-zinc-200">AI Assistant</span>
              <span className="text-[11px] text-zinc-500 block leading-tight">Zapytaj o dane</span>
            </div>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-5 py-4"
            style={{ scrollBehavior: 'smooth' }}
          >
            <div className="flex flex-col gap-3">
              {/* Suggested questions when empty */}
              {messages.length === 0 && !isTyping && (
                <div className="flex flex-col items-center justify-center text-center py-8 gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
                    </svg>
                  </div>
                  <p className="text-zinc-500 text-xs">Zapytaj mnie o cokolwiek</p>
                  <div className="flex flex-col gap-2 w-full">
                    {SUGGESTED_QUESTIONS.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestionClick(q)}
                        className="text-[12px] text-zinc-400 hover:text-zinc-200 px-4 py-2.5 rounded-lg transition-colors text-left"
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                    msg.type === 'user'
                      ? 'self-end max-w-[80%]'
                      : 'self-start max-w-[85%]'
                  }`}
                  style={{
                    lineHeight: '1.6',
                    color: msg.type === 'user' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.75)',
                    background: msg.type === 'user'
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid rgba(255, 255, 255, ${msg.type === 'user' ? '0.1' : '0.05'})`,
                  }}
                >
                  {msg.type === 'assistant' ? renderMarkdown(msg.text) : msg.text}
                </div>
              ))}

              {isTyping && (
                <div
                  className="self-start rounded-xl px-4 py-3 flex gap-1.5"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{
                        background: 'rgba(255, 255, 255, 0.3)',
                        animationDelay: `${i * 0.15}s`,
                      }}
                    />
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Footer / Input */}
          <div
            className="px-4 py-3.5"
            style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <form onSubmit={handleSendMessage} className="flex items-center gap-2.5">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Wpisz pytanie..."
                disabled={isTyping}
                autoComplete="off"
                className="flex-1 outline-none disabled:opacity-50 transition-colors duration-200 placeholder:text-zinc-600"
                style={{
                  padding: '10px 14px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  fontSize: '13px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  color: '#fff',
                }}
              />
              <button
                type="submit"
                disabled={isTyping || !inputValue.trim()}
                className="flex items-center justify-center transition-all duration-200 disabled:opacity-30"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: inputValue.trim() ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                  cursor: 'pointer',
                  color: 'rgba(255, 255, 255, 0.7)',
                }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes chatSlideUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Mobile responsive */
        @media (max-width: 600px) {
          #floating-chat-btn {
            bottom: 16px !important;
            right: 12px !important;
          }
        }
      `}</style>
    </>
  );
}
