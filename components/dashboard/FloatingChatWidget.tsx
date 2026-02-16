'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { sendChatMessage, getChatHistory } from '@/lib/api';
import { ChatHistoryMessage } from '@/lib/types';

interface FloatingChatWidgetProps {
  clientId: string;
}

type WidgetState = 'closed' | 'opening' | 'open' | 'closing';

const SUGGESTED_QUESTIONS = [
  'Jakie byly najczestsze pytania wczoraj?',
  'Ile kosztowaly rozmowy w tym tygodniu?',
  'Pokaz luki w bazie wiedzy',
];

const NOTIFICATION_MESSAGES = [
  'W czym mogę Ci pomóc?',
  'Zapytaj mnie o statystyki',
  'Sprawdź dzisiejsze rozmowy',
  'Masz pytanie? Napisz!',
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

/** Inline markdown: **bold**, [[conv:...]] links */
function inlineMd(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(
      /\[\[conv:([^:]+):(\d+):([^\]]+)\]\]/g,
      '<a data-conv-link="true" href="/conversations/$1?conversation_number=$2" class="text-blue-400 hover:text-blue-300 underline underline-offset-2 cursor-pointer">$3</a>'
    );
}

export default function FloatingChatWidget({ clientId }: FloatingChatWidgetProps) {
  const router = useRouter();
  const [widgetState, setWidgetState] = useState<WidgetState>('closed');
  const [messages, setMessages] = useState<ChatHistoryMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [notificationText, setNotificationText] = useState<string | null>(null);
  const notificationCount = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const historyLoaded = useRef(false);

  const isOpen = widgetState === 'open';
  const isClosed = widgetState === 'closed';
  const isAnimating = widgetState === 'opening' || widgetState === 'closing';

  // Load chat history on mount (background, ready before user opens)
  useEffect(() => {
    if (historyLoaded.current || !clientId) return;
    historyLoaded.current = true;

    (async () => {
      try {
        const data = await getChatHistory(clientId, 50);
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
    })();
  }, [clientId]);

  // Auto-scroll
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  // Tada effect on button
  useEffect(() => {
    if (isClosed) {
      const tadaInterval = setInterval(() => {
        const btn = document.getElementById('floating-chat-btn');
        if (btn) {
          btn.classList.add('tada');
          setTimeout(() => btn.classList.remove('tada'), 1000);
        }
      }, 30000);
      return () => clearInterval(tadaInterval);
    }
  }, [isClosed]);

  // Escalating notification bubble: 30s, 60s, 120s, 240s then stop
  useEffect(() => {
    if (!isClosed) return;

    const MAX_NOTIFICATIONS = 4;
    const BASE_DELAY = 30000;

    const scheduleNext = () => {
      if (notificationCount.current >= MAX_NOTIFICATIONS) return;

      const delay = BASE_DELAY * Math.pow(2, notificationCount.current);
      const timeout = setTimeout(() => {
        const msgIndex = notificationCount.current % NOTIFICATION_MESSAGES.length;
        setNotificationText(NOTIFICATION_MESSAGES[msgIndex]);
        notificationCount.current += 1;
        setTimeout(() => setNotificationText(null), 5000);
        scheduleNext();
      }, delay);

      return timeout;
    };

    const timeout = scheduleNext();
    return () => { if (timeout) clearTimeout(timeout); };
  }, [isClosed]);

  const toggleWidget = () => {
    if (isAnimating) return;
    if (isClosed) {
      setWidgetState('opening');
    } else if (isOpen) {
      setWidgetState('closing');
    }
  };

  const handleAnimationEnd = () => {
    if (widgetState === 'opening') setWidgetState('open');
    if (widgetState === 'closing') setWidgetState('closed');
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isTyping || !clientId) return;

    const userMessage = inputValue.trim();
    const now = new Date().toISOString();
    setMessages(prev => [...prev, { content: userMessage, role: 'user', timestamp: now }]);
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await sendChatMessage(clientId, userMessage);
      setMessages(prev => [...prev, { content: response.message, role: 'assistant', timestamp: new Date().toISOString() }]);
    } catch {
      setMessages(prev => [...prev, {
        content: 'Przepraszam, wystapil blad. Sprobuj ponownie.',
        role: 'assistant',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleConvLinkClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a[data-conv-link]') as HTMLAnchorElement;
    if (link) {
      e.preventDefault();
      router.push(link.getAttribute('href')!);
    }
  };

  return (
    <>
      {/* Open Button */}
      <button
        id="floating-chat-btn"
        onClick={toggleWidget}
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
      {notificationText && isClosed && (
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
              setWidgetState('opening');
            }}
          >
            {notificationText}
          </div>
        </div>
      )}

      {/* Chat Widget */}
      <div
        id="chat-widget-floating"
        data-state={widgetState}
        onAnimationEnd={handleAnimationEnd}
        className="fixed pointer-events-auto"
        style={{
          top: '50%',
          right: 'var(--floating-chat-widget-right)',
          background: '#141414',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '16px',
          overflow: 'hidden',
          flexDirection: 'column',
          zIndex: 2000,
        }}
      >

        {/* Header */}
        <div
          className="widget-header px-5 py-3 flex items-center justify-between"
          style={{
            background: '#0a0a0a',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <img src="/icon-logo-biale.png" alt="Stride" className="w-10 h-10 object-contain" />
            <div>
              <span className="text-sm font-semibold text-white">AI Assistant</span>
              <span className="text-xs text-zinc-600 block leading-tight">Zapytaj o dane</span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div
          className="widget-body px-5 xl:px-6 py-4"
          style={{
            flex: 1,
            overflowY: 'auto',
            scrollBehavior: 'smooth',
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
                      onClick={() => setInputValue(q)}
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
                  {daySep && (
                    <div className="flex items-center gap-3 my-2">
                      <div className="h-px flex-1 bg-white/[0.08]" />
                      <span className="text-xs text-zinc-600 font-medium">{daySep}</span>
                      <div className="h-px flex-1 bg-white/[0.08]" />
                    </div>
                  )}

                  <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`chat-bubble rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'chat-bubble-user text-white max-w-[80%]'
                          : 'chat-bubble-assistant text-zinc-200 max-w-[85%]'
                      }`}
                      onClick={msg.role === 'assistant' ? handleConvLinkClick : undefined}
                    >
                      {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                    </div>
                    <p className={`text-xs text-zinc-700 mt-0.5 px-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                      {formatChatTime(msg.timestamp)}
                    </p>
                  </div>
                </React.Fragment>
              );
            })}

            {isTyping && (
              <div className="chat-bubble chat-bubble-assistant self-start rounded-xl px-3 py-2 max-w-[75%] flex gap-1.5">
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
          className="widget-footer p-4 xl:p-5"
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
              className="flex-1 outline-none bg-[#1e1e1e] text-white text-sm rounded-[10px] px-3.5 py-2.5 border border-white/[0.06] focus:border-blue-500/30 focus:shadow-[0_0_0_2px_rgba(59,130,246,0.1)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            />
            <button
              type="submit"
              disabled={isTyping || !inputValue.trim()}
              className="chat-send-btn flex items-center justify-center w-10 h-10 rounded-[10px] border border-white/[0.06] bg-[#1e1e1e] text-zinc-400 hover:bg-blue-500 hover:border-blue-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-[#1e1e1e] disabled:hover:border-white/[0.06] disabled:hover:text-zinc-400 transition-all duration-200"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
              </svg>
            </button>
          </form>
        </div>

        {/* Close button */}
        <button
          onClick={() => { if (isOpen) setWidgetState('closing'); }}
          className="close-btn absolute top-2.5 right-2.5 w-7 h-7 rounded-lg flex items-center justify-center z-10 bg-[#1e1e1e] border border-white/[0.06] hover:border-white/10 transition-all duration-200"
          style={{ cursor: 'pointer' }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="#71717a">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>

      <style jsx global>{`
        @keyframes fadeInSlideFloat {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
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

        /* ========== Widget animation states ========== */

        #chat-widget-floating[data-state="closed"] {
          display: none !important;
        }

        #chat-widget-floating[data-state="opening"] {
          display: flex !important;
          animation: widgetOpen 1s cubic-bezier(0.77, 0, 0.18, 1) forwards;
        }

        #chat-widget-floating[data-state="open"] {
          display: flex !important;
          width: var(--floating-chat-widget-width);
          height: var(--floating-chat-widget-height);
          transform: translateY(-50%);
          box-shadow: 0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06);
        }

        #chat-widget-floating[data-state="closing"] {
          display: flex !important;
          animation: widgetClose 0.8s cubic-bezier(0.77, 0, 0.18, 1) forwards;
        }

        /* Content fade during animations */
        #chat-widget-floating[data-state="opening"] .widget-header,
        #chat-widget-floating[data-state="opening"] .widget-body,
        #chat-widget-floating[data-state="opening"] .widget-footer,
        #chat-widget-floating[data-state="opening"] .close-btn {
          opacity: 0;
          animation: fadeIn 0.3s ease-out 0.7s forwards;
        }

        #chat-widget-floating[data-state="closing"] .widget-header,
        #chat-widget-floating[data-state="closing"] .widget-body,
        #chat-widget-floating[data-state="closing"] .widget-footer,
        #chat-widget-floating[data-state="closing"] .close-btn {
          animation: fadeOut 0.15s ease-out forwards;
        }

        @keyframes widgetOpen {
          0% {
            width: 35px;
            height: 115px;
            transform: translateY(-50%) translateX(40px);
            box-shadow: none;
          }
          30% {
            width: 35px;
            height: 115px;
            transform: translateY(-50%) translateX(0);
            box-shadow: none;
          }
          60% {
            width: var(--floating-chat-widget-width);
            height: 115px;
            transform: translateY(-50%);
            box-shadow: none;
          }
          100% {
            width: var(--floating-chat-widget-width);
            height: var(--floating-chat-widget-height);
            transform: translateY(-50%);
            box-shadow: 0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06);
          }
        }

        @keyframes widgetClose {
          0% {
            width: var(--floating-chat-widget-width);
            height: var(--floating-chat-widget-height);
            transform: translateY(-50%);
            box-shadow: 0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06);
          }
          40% {
            width: var(--floating-chat-widget-width);
            height: 115px;
            transform: translateY(-50%);
            box-shadow: none;
          }
          70% {
            width: 35px;
            height: 115px;
            transform: translateY(-50%);
          }
          100% {
            width: 35px;
            height: 115px;
            transform: translateY(-50%) translateX(40px);
            box-shadow: none;
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }

        /* Chat bubble shared styles */
        .chat-bubble {
          line-height: 1.5;
          background: #1e1e1e;
        }

        .chat-bubble-user {
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .chat-bubble-assistant {
          border: 1px solid rgba(255, 255, 255, 0.04);
        }

        /* Hardware acceleration */
        #chat-widget-floating {
          backface-visibility: hidden;
          perspective: 1000px;
          will-change: width, height, transform;
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
