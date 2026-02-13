'use client';

import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, getChatHistory } from '@/lib/api';

interface ChatMessage {
  text: string;
  type: 'user' | 'assistant';
  timestamp: string;
}

interface FloatingChatWidgetProps {
  clientId: string;
}

const SUGGESTED_QUESTIONS = [
  'Jakie byly najczestsze pytania wczoraj?',
  'Ile kosztowaly rozmowy w tym tygodniu?',
  'Pokaz luki w bazie wiedzy',
];

/** Format timestamp to HH:mm */
function formatChatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** Return day separator label or null if same day as previous */
function formatChatDaySeparator(current: string, previous: string | null): string | null {
  try {
    const curr = new Date(current);
    const now = new Date();

    if (previous) {
      const prev = new Date(previous);
      if (
        curr.getFullYear() === prev.getFullYear() &&
        curr.getMonth() === prev.getMonth() &&
        curr.getDate() === prev.getDate()
      ) {
        return null;
      }
    }

    if (
      curr.getFullYear() === now.getFullYear() &&
      curr.getMonth() === now.getMonth() &&
      curr.getDate() === now.getDate()
    ) {
      return 'Dzisiaj';
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (
      curr.getFullYear() === yesterday.getFullYear() &&
      curr.getMonth() === yesterday.getMonth() &&
      curr.getDate() === yesterday.getDate()
    ) {
      return 'Wczoraj';
    }

    const months = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paz', 'lis', 'gru'];
    return `${curr.getDate()} ${months[curr.getMonth()]}`;
  } catch {
    return null;
  }
}

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

    // Bullet list
    if (/^[-*]\s+/.test(trimmed)) {
      const content = trimmed.replace(/^[-*]\s+/, '');
      if (currentList?.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList!.items.push(content);
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const content = trimmed.replace(/^\d+\.\s+/, '');
      if (currentList?.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList!.items.push(content);
      continue;
    }

    // Not a list line - flush any open list
    flushList();

    // Empty line
    if (!trimmed) {
      elements.push(<div key={key++} className="h-1.5" />);
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={key++} dangerouslySetInnerHTML={{ __html: inlineMd(trimmed) }} />
    );
  }

  flushList();

  return <>{elements}</>;
}

/** Inline markdown: **bold** */
function inlineMd(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

const NOTIFICATION_MESSAGES = [
  'W czym mogę Ci pomóc?',
  'Zapytaj mnie o statystyki',
  'Sprawdź dzisiejsze rozmowy',
  'Masz pytanie? Napisz!',
];

export default function FloatingChatWidget({ clientId }: FloatingChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [notificationText, setNotificationText] = useState<string | null>(null);
  const notificationCount = useRef(0);
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
              timestamp: msg.timestamp || new Date().toISOString(),
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

  // Tada effect on button
  useEffect(() => {
    if (!isOpen) {
      const tadaInterval = setInterval(() => {
        const btn = document.getElementById('floating-chat-btn');
        if (btn) {
          btn.classList.add('tada');
          setTimeout(() => btn.classList.remove('tada'), 1000);
        }
      }, 30000);

      return () => clearInterval(tadaInterval);
    }
  }, [isOpen]);

  // Escalating notification bubble: 30s, 60s, 120s, 240s then stop
  useEffect(() => {
    if (isOpen) return;

    const MAX_NOTIFICATIONS = 4;
    const BASE_DELAY = 30000; // 30s

    const scheduleNext = () => {
      if (notificationCount.current >= MAX_NOTIFICATIONS) return;

      const delay = BASE_DELAY * Math.pow(2, notificationCount.current);
      const timeout = setTimeout(() => {
        const msgIndex = notificationCount.current % NOTIFICATION_MESSAGES.length;
        setNotificationText(NOTIFICATION_MESSAGES[msgIndex]);
        notificationCount.current += 1;

        // Auto-hide after 5s
        setTimeout(() => setNotificationText(null), 5000);

        // Schedule next
        scheduleNext();
      }, delay);

      return timeout;
    };

    const timeout = scheduleNext();
    return () => { if (timeout) clearTimeout(timeout); };
  }, [isOpen]);

  const animateOpen = () => {
    if (isAnimating || isOpen) return;
    setIsAnimating(true);

    const widget = document.getElementById('chat-widget-floating');
    if (!widget) return;

    widget.style.setProperty('height', '115px', 'important');
    widget.style.setProperty('width', '35px', 'important');
    widget.style.setProperty('transform', 'translateY(-50%) translateX(40px)', 'important');
    widget.style.setProperty('transition', 'none', 'important');
    widget.style.setProperty('z-index', '2002', 'important');
    widget.style.setProperty('display', 'flex', 'important');
    widget.style.setProperty('box-shadow', 'none', 'important');

    const header = widget.querySelector('.widget-header') as HTMLElement;
    const body = widget.querySelector('.widget-body') as HTMLElement;
    const footer = widget.querySelector('.widget-footer') as HTMLElement;
    if (header) header.style.opacity = '0';
    if (body) body.style.opacity = '0';
    if (footer) footer.style.opacity = '0';

    void widget.offsetWidth;

    setTimeout(() => {
      widget.style.setProperty('transition', 'transform 0.5s cubic-bezier(0.77,0,0.18,1)', 'important');
      widget.style.setProperty('transform', 'translateY(-50%) translateX(0)', 'important');
    }, 10);

    setTimeout(() => {
      widget.style.setProperty('transition', 'width 0.5s cubic-bezier(0.77,0,0.18,1), transform 0.5s cubic-bezier(0.77,0,0.18,1)', 'important');
      widget.style.setProperty('width', 'var(--floating-chat-widget-width)', 'important');
    }, 260);

    setTimeout(() => {
      widget.style.setProperty('transition', 'height 0.5s cubic-bezier(0.77,0,0.18,1), width 0.5s cubic-bezier(0.77,0,0.18,1)', 'important');
      widget.style.setProperty('height', 'var(--floating-chat-widget-height)', 'important');
    }, 510);

    setTimeout(() => {
      widget.style.setProperty('transition', 'height 0.5s cubic-bezier(0.77,0,0.18,1), width 0.5s cubic-bezier(0.77,0,0.18,1), box-shadow 0.6s ease-out', 'important');
      widget.style.setProperty('box-shadow', '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255, 255, 255, 0.06)', 'important');
    }, 510);

    setTimeout(() => {
      setIsAnimating(false);
      setIsOpen(true);

      widget.style.setProperty('height', 'var(--floating-chat-widget-height)', 'important');
      widget.style.setProperty('width', 'var(--floating-chat-widget-width)', 'important');
      widget.style.setProperty('transform', 'translateY(-50%)', 'important');
      widget.style.removeProperty('transition');
      widget.style.setProperty('box-shadow', '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255, 255, 255, 0.06)', 'important');

      if (header) header.style.opacity = '1';
      if (body) body.style.opacity = '1';
      if (footer) footer.style.opacity = '1';

      const closeBtn = widget.querySelector('.close-btn') as HTMLElement;
      if (closeBtn) closeBtn.style.opacity = '1';
    }, 1010);
  };

  const animateClose = () => {
    if (isAnimating || !isOpen) return;
    setIsAnimating(true);

    const widget = document.getElementById('chat-widget-floating');
    if (!widget) return;

    const header = widget.querySelector('.widget-header') as HTMLElement;
    const body = widget.querySelector('.widget-body') as HTMLElement;
    const footer = widget.querySelector('.widget-footer') as HTMLElement;
    const closeBtn = widget.querySelector('.close-btn') as HTMLElement;
    if (header) header.style.opacity = '0';
    if (body) body.style.opacity = '0';
    if (footer) footer.style.opacity = '0';
    if (closeBtn) closeBtn.style.opacity = '0';

    widget.style.setProperty('transition', 'height 0.5s cubic-bezier(0.77,0,0.18,1), box-shadow 0.4s ease-out', 'important');
    widget.style.setProperty('height', '115px', 'important');
    widget.style.setProperty('box-shadow', 'none', 'important');

    setTimeout(() => {
      widget.style.setProperty('transition', 'transform 0.5s cubic-bezier(0.77,0,0.18,1), height 0.5s cubic-bezier(0.77,0,0.18,1)', 'important');
      widget.style.setProperty('transform', 'translateY(-50%) translateX(40px)', 'important');
    }, 250);

    setTimeout(() => {
      widget.style.setProperty('transition', 'width 0.5s cubic-bezier(0.77,0,0.18,1), transform 0.5s cubic-bezier(0.77,0,0.18,1)', 'important');
      widget.style.setProperty('width', '35px', 'important');
    }, 500);

    setTimeout(() => {
      setIsAnimating(false);
      setIsOpen(false);
      widget.style.setProperty('display', 'none', 'important');
      widget.style.removeProperty('height');
      widget.style.removeProperty('transform');
      widget.style.removeProperty('transition');
      widget.style.removeProperty('width');
      widget.style.removeProperty('box-shadow');

      if (header) header.style.removeProperty('opacity');
      if (body) body.style.removeProperty('opacity');
      if (footer) footer.style.removeProperty('opacity');
    }, 1000);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isTyping || !clientId) return;

    const userMessage = inputValue.trim();
    const now = new Date().toISOString();
    setMessages(prev => [...prev, { text: userMessage, type: 'user', timestamp: now }]);
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await sendChatMessage(clientId, userMessage);
      setMessages(prev => [...prev, { text: response.message, type: 'assistant', timestamp: new Date().toISOString() }]);
    } catch {
      setMessages(prev => [...prev, {
        text: 'Przepraszam, wystapil blad. Sprobuj ponownie.',
        type: 'assistant',
        timestamp: new Date().toISOString(),
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
      {/* Open Button */}
      <button
        id="floating-chat-btn"
        onClick={() => isOpen ? animateClose() : animateOpen()}
        className="group fixed overflow-visible pointer-events-auto"
        style={{
          top: '50%',
          right: 'var(--floating-chat-right)',
          transform: 'translateY(-50%) scale(1)',
          width: 'var(--floating-chat-btn-width)',
          height: 'var(--floating-chat-btn-height)',
          background: '#141414',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '20px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
          fontSize: 0,
          zIndex: 2003,
          cursor: 'pointer',
          opacity: 1,
          transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease-out',
        }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{
              width: '23px',
              height: '62px',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '11px',
            }}
          />
          {[...Array(3)].map((_, i) => (
            <span
              key={i}
              className="block rounded-full z-10"
              style={{
                width: '11px',
                height: '11px',
                margin: '3.5px 0',
                background: 'rgba(255, 255, 255, 0.6)',
              }}
            />
          ))}
        </div>
      </button>

      {/* Notification bubble */}
      {notificationText && !isOpen && !isAnimating && (
        <div
          className="fixed pointer-events-none"
          style={{
            top: '50%',
            right: 'calc(var(--floating-chat-right) + var(--floating-chat-btn-width) + 12px)',
            transform: 'translateY(-50%)',
            zIndex: 2004,
            animation: 'fadeInSlideFloat 0.3s ease-out',
          }}
        >
          <div
            className="bg-[#141414] text-zinc-300 text-sm px-4 py-2.5 rounded-xl whitespace-nowrap pointer-events-auto cursor-pointer"
            style={{
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            }}
            onClick={() => {
              setNotificationText(null);
              animateOpen();
            }}
          >
            {notificationText}
          </div>
        </div>
      )}

      {/* Chat Widget */}
      <div
        id="chat-widget-floating"
        className="fixed pointer-events-auto"
        style={{
          top: '50%',
          right: 'var(--floating-chat-widget-right)',
          transform: 'translateY(-50%)',
          background: '#141414',
          boxShadow: 'none',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'none',
          flexDirection: 'column',
          zIndex: 2000,
        }}
      >

        {/* Header */}
        <div
          className="widget-header px-5 py-3 transition-opacity duration-300 flex items-center justify-between"
          style={{
            background: '#0a0a0a',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.15)',
              }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
              </svg>
            </div>
            <div>
              <span className="text-sm font-semibold text-white">AI Assistant</span>
              <span className="text-xs text-zinc-600 block leading-tight">Zapytaj o dane</span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div
          className="widget-body px-5 xl:px-6 py-4 transition-opacity duration-300"
          style={{
            flex: 1,
            overflowY: 'auto',
            scrollBehavior: 'smooth',
            background: 'transparent',
          }}
        >
          <div className="flex flex-col gap-3">
            {/* Suggested questions when empty */}
            {messages.length === 0 && !isTyping && (
              <div className="flex flex-col items-center justify-center text-center py-6 gap-3">
                <p className="text-zinc-600 text-xs">Zapytaj mnie o cokolwiek</p>
                <div className="flex flex-col gap-1.5 w-full">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(q)}
                      className="text-xs bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.12] text-zinc-400 hover:text-zinc-300 px-3 py-2 rounded-lg transition-all duration-200 text-left"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => {
              const daySep = formatChatDaySeparator(
                msg.timestamp,
                idx > 0 ? messages[idx - 1].timestamp : null
              );

              return (
                <React.Fragment key={idx}>
                  {/* Day separator */}
                  {daySep && (
                    <div className="flex items-center gap-3 my-2">
                      <div className="h-px flex-1 bg-white/[0.08]" />
                      <span className="text-xs text-zinc-600 font-medium">{daySep}</span>
                      <div className="h-px flex-1 bg-white/[0.08]" />
                    </div>
                  )}

                  <div className={`flex flex-col ${msg.type === 'user' ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.type === 'user'
                          ? 'text-white max-w-[80%]'
                          : 'text-zinc-200 max-w-[85%]'
                      }`}
                      style={{
                        lineHeight: '1.5',
                        background: msg.type === 'user' ? '#1e1e1e' : '#1e1e1e',
                        border: msg.type === 'user'
                          ? '1px solid rgba(255, 255, 255, 0.08)'
                          : '1px solid rgba(255, 255, 255, 0.04)',
                      }}
                    >
                      {msg.type === 'assistant' ? renderMarkdown(msg.text) : msg.text}
                    </div>
                    <p className={`text-xs text-zinc-700 mt-0.5 px-1 ${msg.type === 'user' ? 'text-right' : ''}`}>
                      {formatChatTime(msg.timestamp)}
                    </p>
                  </div>
                </React.Fragment>
              );
            })}

            {isTyping && (
              <div
                className="self-start rounded-xl px-3 py-2 max-w-[75%] flex gap-1.5"
                style={{
                  background: '#1e1e1e',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                }}
              >
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Footer */}
        <div
          className="widget-footer p-4 xl:p-5 transition-opacity duration-300"
          style={{
            background: '#0a0a0a',
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
              className="flex-1 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              style={{
                padding: '10px 14px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '10px',
                fontSize: '14px',
                background: '#1e1e1e',
                color: '#ffffff',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                e.target.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                e.target.style.boxShadow = 'none';
              }}
            />
            <button
              type="submit"
              disabled={isTyping || !inputValue.trim()}
              className="flex items-center justify-center transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                background: '#1e1e1e',
                color: '#a1a1aa',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!isTyping && inputValue.trim()) {
                  e.currentTarget.style.background = '#3b82f6';
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.color = '#ffffff';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#1e1e1e';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.color = '#a1a1aa';
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
              </svg>
            </button>
          </form>
        </div>

        {/* Close button */}
        <button
          onClick={animateClose}
          className="close-btn absolute top-2.5 right-2.5 w-7 h-7 rounded-lg flex items-center justify-center z-10 transition-all duration-200"
          style={{
            background: '#1e1e1e',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            cursor: 'pointer',
            opacity: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#1e1e1e';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#1e1e1e';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
          }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="#71717a">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>

      <style jsx global>{`
        @keyframes fadeInSlideFloat {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes tada {
          0%, 100% { transform: translateY(-50%) rotate(0deg); }
          10%, 20% { transform: translateY(-50%) rotate(-3deg); }
          30%, 50%, 70%, 90% { transform: translateY(-50%) rotate(3deg); }
          40%, 60%, 80% { transform: translateY(-50%) rotate(-3deg); }
        }

        #floating-chat-btn.tada {
          animation: tada 1s;
        }

        /* Hardware acceleration */
        #chat-widget-floating {
          backface-visibility: hidden;
          perspective: 1000px;
        }

        #chat-widget-floating * {
          backface-visibility: hidden;
        }

        /* Mobile responsive */
        @media (max-width: 600px) {
          #floating-chat-btn {
            right: 8px !important;
            width: 40px !important;
            height: 70px !important;
          }

          #chat-widget-floating {
            right: 8px !important;
            width: calc(100vw - 16px) !important;
            min-width: unset !important;
            max-width: 450px !important;
            height: 70vh !important;
            min-height: 400px !important;
            max-height: 600px !important;
          }
        }
      `}</style>
    </>
  );
}
