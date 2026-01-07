'use client';

import { useState, useEffect, useRef } from 'react';

export default function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showCallout, setShowCallout] = useState(false);
  const [calloutCount, setCalloutCount] = useState(0);
  const [messages, setMessages] = useState<Array<{ text: string; type: 'user' | 'assistant' }>>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Callout animation
  useEffect(() => {
    const showCalloutTimer = setTimeout(() => {
      if (!isOpen && calloutCount < 3) {
        setShowCallout(true);
        setCalloutCount(prev => prev + 1);
        setTimeout(() => setShowCallout(false), 6000);
      }
    }, 20000);

    const intervalTimer = setInterval(() => {
      if (!isOpen && calloutCount < 3) {
        setShowCallout(true);
        setCalloutCount(prev => prev + 1);
        setTimeout(() => setShowCallout(false), 6000);
      }
    }, 60000);

    return () => {
      clearTimeout(showCalloutTimer);
      clearInterval(intervalTimer);
    };
  }, [isOpen, calloutCount]);

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

  const animateOpen = () => {
    if (isAnimating || isOpen) return;
    setIsAnimating(true);
    setShowCallout(false);

    const widget = document.getElementById('chat-widget-floating');
    if (!widget) return;

    // EXACT COPY from original JS - lines 163-210
    widget.style.setProperty('height', '115px', 'important');
    widget.style.setProperty('width', '35px', 'important');
    widget.style.setProperty('transform', 'translateY(-50%) translateX(40px)', 'important');
    widget.style.setProperty('transition', 'none', 'important');
    widget.style.setProperty('z-index', '2002', 'important');
    widget.style.setProperty('display', 'flex', 'important');

    // Hide content initially
    const header = widget.querySelector('.widget-header') as HTMLElement;
    const body = widget.querySelector('.widget-body') as HTMLElement;
    const footer = widget.querySelector('.widget-footer') as HTMLElement;
    if (header) header.style.opacity = '0';
    if (body) body.style.opacity = '0';
    if (footer) footer.style.opacity = '0';

    // Disable blur during animation for performance
    widget.style.setProperty('backdrop-filter', 'none', 'important');

    // Force reflow
    void widget.offsetWidth;

    // 1. Slide left (tunnel)
    setTimeout(() => {
      widget.style.setProperty('transition', 'transform 0.5s cubic-bezier(0.77,0,0.18,1)', 'important');
      widget.style.setProperty('transform', 'translateY(-50%) translateX(0)', 'important');
    }, 10);

    // 2. Expand width (starts after slide begins)
    setTimeout(() => {
      widget.style.setProperty('transition', 'width 0.5s cubic-bezier(0.77,0,0.18,1), transform 0.5s cubic-bezier(0.77,0,0.18,1)', 'important');
      widget.style.setProperty('width', 'var(--floating-chat-widget-width)', 'important');
    }, 260);

    // 3. Expand height (starts after width begins)
    setTimeout(() => {
      widget.style.setProperty('transition', 'height 0.5s cubic-bezier(0.77,0,0.18,1), width 0.5s cubic-bezier(0.77,0,0.18,1)', 'important');
      widget.style.setProperty('height', 'var(--floating-chat-widget-height)', 'important');
    }, 510);

    // 4. Finish animation
    setTimeout(() => {
      setIsAnimating(false);
      setIsOpen(true);

      // Keep final size but clean up animation properties
      widget.style.setProperty('height', 'var(--floating-chat-widget-height)', 'important');
      widget.style.setProperty('width', 'var(--floating-chat-widget-width)', 'important');
      widget.style.setProperty('transform', 'translateY(-50%)', 'important');
      widget.style.removeProperty('transition');

      // Re-enable blur after animation
      widget.style.setProperty('backdrop-filter', 'blur(20px)', 'important');

      // Show content
      if (header) header.style.opacity = '1';
      if (body) body.style.opacity = '1';
      if (footer) footer.style.opacity = '1';

      // Show close button
      const closeBtn = widget.querySelector('.close-btn') as HTMLElement;
      if (closeBtn) closeBtn.style.opacity = '1';
    }, 1010);
  };

  const animateClose = () => {
    if (isAnimating || !isOpen) return;
    setIsAnimating(true);

    const widget = document.getElementById('chat-widget-floating');
    if (!widget) return;

    // Hide content immediately
    const header = widget.querySelector('.widget-header') as HTMLElement;
    const body = widget.querySelector('.widget-body') as HTMLElement;
    const footer = widget.querySelector('.widget-footer') as HTMLElement;
    const closeBtn = widget.querySelector('.close-btn') as HTMLElement;
    if (header) header.style.opacity = '0';
    if (body) body.style.opacity = '0';
    if (footer) footer.style.opacity = '0';
    if (closeBtn) closeBtn.style.opacity = '0';

    // Disable blur during animation for performance
    widget.style.setProperty('backdrop-filter', 'none', 'important');

    // 1. Shrink height
    widget.style.setProperty('transition', 'height 0.5s cubic-bezier(0.77,0,0.18,1)', 'important');
    widget.style.setProperty('height', '115px', 'important');

    // 2. Slide right (starts after height begins)
    setTimeout(() => {
      widget.style.setProperty('transition', 'transform 0.5s cubic-bezier(0.77,0,0.18,1), height 0.5s cubic-bezier(0.77,0,0.18,1)', 'important');
      widget.style.setProperty('transform', 'translateY(-50%) translateX(40px)', 'important');
    }, 250);

    // 3. Shrink width (starts after slide begins)
    setTimeout(() => {
      widget.style.setProperty('transition', 'width 0.5s cubic-bezier(0.77,0,0.18,1), transform 0.5s cubic-bezier(0.77,0,0.18,1)', 'important');
      widget.style.setProperty('width', '35px', 'important');
    }, 500);

    // 4. Finish animation
    setTimeout(() => {
      setIsAnimating(false);
      setIsOpen(false);
      widget.style.setProperty('display', 'none', 'important');
      widget.style.removeProperty('height');
      widget.style.removeProperty('transform');
      widget.style.removeProperty('transition');
      widget.style.removeProperty('width');

      // Restore content visibility
      if (header) header.style.removeProperty('opacity');
      if (body) body.style.removeProperty('opacity');
      if (footer) footer.style.removeProperty('opacity');
    }, 1000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isTyping) return;

    const userMessage = inputValue.trim();
    setMessages(prev => [...prev, { text: userMessage, type: 'user' }]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        text: 'To jest demo odpowiedzi chatbota. W pełnej wersji tutaj będzie działać prawdziwy AI!',
        type: 'assistant'
      }]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <>
      {/* Callout */}
      <div
        className={`fixed pointer-events-none z-[1000] transition-all duration-500 border whitespace-nowrap ${
          showCallout ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-5'
        }`}
        style={{
          top: '50%',
          right: 'calc(26px + 40px + 8px)',
          transform: 'translateY(-50%)',
          padding: '10px 16px',
          background: 'rgba(132, 204, 22, 0.1)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 8px rgba(0,0,0,0.3), 0 0 15px rgba(132, 204, 22, 0.3)',
          borderColor: 'rgba(132, 204, 22, 0.4)',
          borderRadius: '8px',
        }}
      >
        <span className={`text-white text-sm inline-block overflow-hidden ${showCallout ? 'animate-typing' : ''}`}>
          Potrzebujesz pomocy?
        </span>
      </div>

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
          background: 'linear-gradient(135deg, rgba(132, 204, 22, 0.2) 0%, rgba(101, 163, 13, 0.3) 100%)',
          border: '1px solid rgba(132, 204, 22, 0.5)',
          borderRadius: '20px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4), 0 0 25px rgba(132, 204, 22, 0.5), inset 0 1px 1px rgba(132, 204, 22, 0.2)',
          fontSize: 0,
          zIndex: 2003,
          cursor: 'pointer',
          opacity: 1,
          transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease-out',
        }}
      >
        {/* Dots */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{
              width: '23px',
              height: '62px',
              background: 'rgba(255, 255, 255, 0.15)',
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
                background: 'rgba(255, 255, 255, 0.8)',
              }}
            />
          ))}
        </div>
      </button>

      {/* Chat Widget */}
      <div
        id="chat-widget-floating"
        className="fixed pointer-events-auto"
        style={{
          top: '50%',
          right: 'var(--floating-chat-widget-right)',
          transform: 'translateY(-50%)',
          background: 'linear-gradient(165deg, rgba(18, 18, 20, 0.95) 0%, rgba(10, 10, 12, 0.98) 100%)',
          backdropFilter: 'blur(50px) saturate(180%)',
          WebkitBackdropFilter: 'blur(50px) saturate(180%)',
          boxShadow: '0 30px 90px rgba(0,0,0,0.8), 0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(60, 60, 65, 0.3) inset, 0 2px 4px rgba(90, 90, 95, 0.15) inset',
          border: '1px solid rgba(60, 60, 65, 0.6)',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'none',
          flexDirection: 'column',
          zIndex: 2000,
          fontFamily: 'var(--font-inter)',
        }}
      >

        {/* Body */}
        <div
          className="widget-body px-5 xl:px-6 py-6 transition-opacity duration-300 scrollbar-thin scrollbar-thumb-gray-500/20 scrollbar-track-transparent"
          style={{
            flex: 1,
            overflowY: 'auto',
            scrollBehavior: 'smooth',
            background: 'transparent',
          }}
        >
          <div className="flex flex-col gap-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`rounded-2xl px-3.5 py-2.5 text-[13px] xl:text-sm leading-relaxed transition-all duration-200 ${
                  msg.type === 'user'
                    ? 'self-end text-white rounded-br max-w-[70%]'
                    : 'self-start text-gray-100 rounded-bl max-w-[70%]'
                }`}
                style={{
                  lineHeight: '1.5',
                  background: msg.type === 'user'
                    ? 'linear-gradient(135deg, rgba(60, 60, 65, 0.9) 0%, rgba(45, 45, 50, 0.95) 100%)'
                    : 'linear-gradient(135deg, rgba(30, 30, 35, 0.85) 0%, rgba(22, 22, 26, 0.9) 100%)',
                  backdropFilter: 'blur(15px) saturate(150%)',
                  border: msg.type === 'user'
                    ? '1px solid rgba(80, 80, 85, 0.5)'
                    : '1px solid rgba(50, 50, 55, 0.4)',
                  boxShadow: msg.type === 'user'
                    ? '0 2px 8px rgba(0, 0, 0, 0.4), 0 1px 4px rgba(45, 45, 50, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
                    : '0 2px 8px rgba(0, 0, 0, 0.4), 0 1px 4px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
                  animation: 'fadeInSlideFloat 0.3s ease-out forwards',
                  animationDelay: `${idx * 0.05}s`,
                  opacity: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  if (msg.type === 'user') {
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(255, 255, 255, 0.12), 0 4px 12px rgba(255, 255, 255, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.borderColor = 'rgba(120, 120, 125, 0.7)';
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(70, 70, 75, 1) 0%, rgba(55, 55, 60, 1) 100%)';
                  } else {
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(255, 255, 255, 0.06)';
                    e.currentTarget.style.borderColor = 'rgba(60, 60, 65, 0.6)';
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(35, 35, 40, 0.95) 0%, rgba(25, 25, 30, 1) 100%)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = msg.type === 'user'
                    ? 'rgba(80, 80, 85, 0.5)'
                    : 'rgba(50, 50, 55, 0.4)';
                  e.currentTarget.style.background = msg.type === 'user'
                    ? 'linear-gradient(135deg, rgba(60, 60, 65, 0.9) 0%, rgba(45, 45, 50, 0.95) 100%)'
                    : 'linear-gradient(135deg, rgba(30, 30, 35, 0.85) 0%, rgba(22, 22, 26, 0.9) 100%)';
                  e.currentTarget.style.boxShadow = msg.type === 'user'
                    ? '0 2px 8px rgba(0, 0, 0, 0.4), 0 1px 4px rgba(45, 45, 50, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
                    : '0 2px 8px rgba(0, 0, 0, 0.4), 0 1px 4px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.04)';
                }}
              >
                {msg.text}
              </div>
            ))}

            {isTyping && (
              <div
                className="self-start rounded-lg rounded-bl-sm px-3 py-2 max-w-[75%] flex gap-1.5 transition-all duration-300"
                style={{
                  background: 'linear-gradient(135deg, rgba(30, 30, 35, 0.85) 0%, rgba(22, 22, 26, 0.9) 100%)',
                  backdropFilter: 'blur(15px) saturate(150%)',
                  border: '1px solid rgba(50, 50, 55, 0.6)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                }}
              >
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="widget-footer p-4 xl:p-5 transition-opacity duration-300"
          style={{
            background: 'linear-gradient(180deg, rgba(8, 8, 10, 0.95) 0%, rgba(10, 10, 12, 0.98) 100%)',
            backdropFilter: 'blur(40px) saturate(150%)',
            borderTop: '1px solid rgba(60, 60, 65, 0.5)',
            boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(80, 80, 85, 0.1)',
          }}
        >
          <form onSubmit={handleSendMessage} className="flex items-center gap-2.5">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type a message..."
              disabled={isTyping}
              autoComplete="off"
              className="flex-1 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
              style={{
                padding: '10px 14px',
                border: '1px solid rgba(60, 60, 65, 0.7)',
                borderRadius: '10px',
                fontSize: '13px',
                background: 'linear-gradient(135deg, rgba(30, 30, 35, 0.9) 0%, rgba(22, 22, 26, 0.95) 100%)',
                backdropFilter: 'blur(20px) saturate(150%)',
                color: '#ffffff',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(120, 120, 125, 0.9)';
                e.target.style.background = 'linear-gradient(135deg, rgba(40, 40, 45, 1) 0%, rgba(30, 30, 35, 1) 100%)';
                e.target.style.boxShadow = '0 0 0 3px rgba(255, 255, 255, 0.08), 0 8px 32px rgba(255, 255, 255, 0.1), 0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
                e.target.style.transform = 'translateY(-2px)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(60, 60, 65, 0.7)';
                e.target.style.background = 'linear-gradient(135deg, rgba(30, 30, 35, 0.9) 0%, rgba(22, 22, 26, 0.95) 100%)';
                e.target.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)';
                e.target.style.transform = 'translateY(0)';
              }}
            />
            <button
              type="submit"
              disabled={isTyping}
              className="flex items-center justify-center text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                border: '1px solid rgba(70, 70, 75, 0.7)',
                background: 'linear-gradient(135deg, rgba(50, 50, 55, 0.95) 0%, rgba(40, 40, 45, 1) 100%)',
                backdropFilter: 'blur(15px) saturate(150%)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(40, 40, 45, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!isTyping) {
                  e.currentTarget.style.transform = 'translateY(-3px) scale(1.08)';
                  e.currentTarget.style.boxShadow = '0 12px 36px rgba(255, 255, 255, 0.2), 0 6px 18px rgba(255, 255, 255, 0.15), 0 0 40px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(200, 200, 205, 1) 0%, rgba(180, 180, 185, 1) 100%)';
                  e.currentTarget.style.borderColor = 'rgba(220, 220, 225, 1)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(40, 40, 45, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(50, 50, 55, 0.95) 0%, rgba(40, 40, 45, 1) 100%)';
                e.currentTarget.style.borderColor = 'rgba(70, 70, 75, 0.7)';
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
          className="close-btn absolute top-2.5 right-2.5 w-7 h-7 rounded-lg flex items-center justify-center z-10 transition-all duration-300"
          style={{
            background: 'linear-gradient(135deg, rgba(40, 40, 45, 0.8) 0%, rgba(30, 30, 35, 0.9) 100%)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(60, 60, 65, 0.6)',
            cursor: 'pointer',
            opacity: 0,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(200, 200, 205, 0.9) 0%, rgba(180, 180, 185, 1) 100%)';
            e.currentTarget.style.borderColor = 'rgba(220, 220, 225, 0.8)';
            e.currentTarget.style.transform = 'scale(1.15) rotate(90deg)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 255, 255, 0.15), 0 0 30px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(40, 40, 45, 0.8) 0%, rgba(30, 30, 35, 0.9) 100%)';
            e.currentTarget.style.borderColor = 'rgba(60, 60, 65, 0.6)';
            e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)';
          }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="white" opacity="0.8">
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

        @keyframes pulse-glow {
          0% {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 0 25px rgba(132, 204, 22, 0.5), inset 0 1px 1px rgba(132, 204, 22, 0.2);
          }
          50% {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 0 35px rgba(132, 204, 22, 0.8), inset 0 1px 1px rgba(132, 204, 22, 0.3);
          }
          100% {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 0 25px rgba(132, 204, 22, 0.5), inset 0 1px 1px rgba(132, 204, 22, 0.2);
          }
        }

        #floating-chat-btn.tada {
          animation: tada 1s;
        }

        @keyframes typing {
          from { width: 0; }
          to { width: 100%; }
        }

        @keyframes blink {
          0%, 100% { border-color: transparent; }
          50% { border-color: rgba(255, 255, 255, 0.5); }
        }

        .animate-typing {
          display: inline-block;
          overflow: hidden;
          white-space: nowrap;
          border-right: 2px solid rgba(100, 200, 255, 0.5);
          animation: typing 3s steps(30) forwards, blink 1s step-end infinite;
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
