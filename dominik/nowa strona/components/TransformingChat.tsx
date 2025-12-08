'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function TransformingChat() {
  const [isFloating, setIsFloating] = useState(false);
  const [isOpen, setIsOpen] = useState(false); // Start closed when floating
  const [isAnimating, setIsAnimating] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Witaj. W czym mogę pomóc?' }
  ]);
  const [input, setInput] = useState('');

  useEffect(() => {
    const handleScroll = () => {
      const scrollThreshold = 200; // Trigger earlier
      const shouldFloat = window.scrollY > scrollThreshold;
      
      if (shouldFloat !== isFloating) {
        setIsFloating(shouldFloat);
        // If we go back to hero, always open the chat
        if (!shouldFloat) {
            setIsOpen(true);
        } else {
            // If we float, start closed (bubble mode) for better UX, or keep open?
            // User request: "appear as a bubble" implies closed state initially when scrolling down
            setIsOpen(false); 
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isFloating]); // Add dependency to prevent stale closure issues

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: 'user', text: input }]);
    setInput('');
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'bot', text: 'Rozumiem. Przetwarzam Twoje zapytanie...' }]);
    }, 1000);
  };

  const animateOpen = () => {
    if (isAnimating || isOpen) return;
    setIsAnimating(true); // This prevents React from rendering ChatInterface

    const widget = document.getElementById('chat-widget-floating');
    if (!widget) return;

    // Start with small dimensions
    widget.style.setProperty('height', '115px', 'important');
    widget.style.setProperty('width', '35px', 'important');
    widget.style.setProperty('transform', 'translateY(-50%) translateX(40px)', 'important');
    widget.style.setProperty('transition', 'none', 'important');
    widget.style.setProperty('z-index', '2002', 'important');
    widget.style.setProperty('display', 'flex', 'important');
    widget.style.setProperty('overflow', 'hidden', 'important');

    // Solid color during animation (no blur, no gradient complexity)
    widget.style.setProperty('background', 'rgba(18, 18, 20, 1)', 'important');
    widget.style.setProperty('backdrop-filter', 'none', 'important');
    widget.style.setProperty('box-shadow', '0 30px 90px rgba(0,0,0,0.8)', 'important');

    // Force reflow
    void widget.offsetWidth;

    // 1. Slide left (tunnel)
    setTimeout(() => {
      widget.style.setProperty('transition', 'transform 0.5s cubic-bezier(0.77,0,0.18,1)', 'important');
      widget.style.setProperty('transform', 'translateY(-50%) translateX(0)', 'important');
    }, 10);

    // 2. Expand width
    setTimeout(() => {
      widget.style.setProperty('transition', 'width 0.5s cubic-bezier(0.77,0,0.18,1), transform 0.5s cubic-bezier(0.77,0,0.18,1)', 'important');
      widget.style.setProperty('width', '420px', 'important');
    }, 260);

    // 3. Expand height
    setTimeout(() => {
      widget.style.setProperty('transition', 'height 0.5s cubic-bezier(0.77,0,0.18,1), width 0.5s cubic-bezier(0.77,0,0.18,1)', 'important');
      widget.style.setProperty('height', '550px', 'important');
    }, 510);

    // 4. Finish animation
    setTimeout(() => {
      widget.style.setProperty('height', '550px', 'important');
      widget.style.setProperty('width', '420px', 'important');
      widget.style.setProperty('transform', 'translateY(-50%)', 'important');
      widget.style.removeProperty('transition');
      widget.style.removeProperty('overflow');

      // Re-enable gradient, blur and original shadow
      widget.style.setProperty('background', 'linear-gradient(165deg, rgba(18, 18, 20, 0.95) 0%, rgba(10, 10, 12, 0.98) 100%)', 'important');
      widget.style.setProperty('backdrop-filter', 'blur(20px) saturate(180%)', 'important');
      widget.style.removeProperty('box-shadow');

      // Now React will render ChatInterface because isAnimating becomes false
      setIsAnimating(false);
      setIsOpen(true);
    }, 1010);
  };

  const animateClose = () => {
    if (isAnimating || !isOpen) return;
    setIsAnimating(true); // This makes React remove ChatInterface from DOM

    const widget = document.getElementById('chat-widget-floating');
    if (!widget) return;

    // Wait a bit for React to unmount the component
    setTimeout(() => {
      // Switch to solid color for animation
      widget.style.setProperty('background', 'rgba(18, 18, 20, 1)', 'important');
      widget.style.setProperty('backdrop-filter', 'none', 'important');
      widget.style.setProperty('overflow', 'hidden', 'important');
      widget.style.setProperty('box-shadow', '0 30px 90px rgba(0,0,0,0.8)', 'important');

      // 1. Shrink height
      widget.style.setProperty('transition', 'height 0.5s cubic-bezier(0.77,0,0.18,1)', 'important');
      widget.style.setProperty('height', '115px', 'important');
    }, 200);

    // 2. Slide right
    setTimeout(() => {
      widget.style.setProperty('transition', 'transform 0.5s cubic-bezier(0.77,0,0.18,1), height 0.5s cubic-bezier(0.77,0,0.18,1)', 'important');
      widget.style.setProperty('transform', 'translateY(-50%) translateX(40px)', 'important');
    }, 450);

    // 3. Shrink width
    setTimeout(() => {
      widget.style.setProperty('transition', 'width 0.5s cubic-bezier(0.77,0,0.18,1), transform 0.5s cubic-bezier(0.77,0,0.18,1)', 'important');
      widget.style.setProperty('width', '35px', 'important');
    }, 700);

    // 4. Finish animation
    setTimeout(() => {
      setIsAnimating(false);
      setIsOpen(false);
      widget.style.setProperty('display', 'none', 'important');
      widget.style.removeProperty('height');
      widget.style.removeProperty('transform');
      widget.style.removeProperty('transition');
      widget.style.removeProperty('width');
      widget.style.removeProperty('background');
      widget.style.removeProperty('overflow');
      widget.style.removeProperty('box-shadow');
    }, 1200);
  };

  const ChatInterface = ({ className, minimizeAction, isMobile }: { className?: string, minimizeAction?: () => void, isMobile?: boolean }) => (
    <div className={cn(
        "chat-interface flex flex-col h-full bg-black/5 backdrop-blur-2xl backdrop-saturate-150 overflow-hidden border border-white/[0.08] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.9),inset_0_0_0_1px_rgba(255,255,255,0.05),inset_0_1px_0_0_rgba(255,255,255,0.1)]",
        isMobile ? "rounded-2xl" : "rounded-2xl", // Consistent rounding
        className
    )}>
      {/* Header */}
      <div className="widget-header flex items-center gap-3 p-4 border-b border-white/5 bg-white/[0.03] transition-opacity duration-300">
        <div className="relative">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white shadow-inner backdrop-blur-sm">
            <Sparkles size={18} />
          </div>
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-black/50"></div>
        </div>
        <div>
          <div className="font-semibold text-white text-sm">Stride Assistant</div>
          <div className="text-xs text-zinc-400 font-medium">Active Now</div>
        </div>
      </div>

      {/* Messages */}
      <div className="widget-body flex-1 overflow-y-auto p-5 space-y-4 min-h-[300px] transition-opacity duration-300">
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[85%] px-4 py-2.5 text-sm leading-relaxed shadow-sm backdrop-blur-sm",
              msg.role === 'user'
                ? "bg-white/90 text-black rounded-xl rounded-br-sm font-medium"
                : "bg-white/[0.02] text-zinc-200 rounded-xl rounded-bl-sm border border-white/5"
            )}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="widget-footer p-4 border-t border-white/5 bg-black/40 transition-opacity duration-300">
        <div className="flex gap-2 bg-white/5 border border-white/5 rounded-xl p-2 pl-4 transition-all focus-within:bg-white/10 focus-within:border-white/10">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Napisz wiadomość..."
            className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder:text-zinc-500"
          />
          <button
            onClick={handleSend}
            className="w-9 h-9 bg-white hover:bg-gray-200 text-black rounded-lg flex items-center justify-center transition-colors shadow-lg shadow-white/5"
          >
            <Send size={16} className="ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* HERO STATIC POSITION */}
      <div className="w-full h-[650px] relative z-10">
        <AnimatePresence>
            {!isFloating && (
            <motion.div 
                key="hero-chat"
                layoutId="chat-widget"
                className="w-full h-full"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            >
                <ChatInterface className="h-full" />
            </motion.div>
            )}
        </AnimatePresence>
        
        {/* Placeholder to keep layout stable */}
        {isFloating && (
          <div className="w-full h-full border border-dashed border-white/10 rounded-2xl flex items-center justify-center text-zinc-600 text-sm font-medium tracking-wide">
            AI System Active
          </div>
        )}
      </div>

      {/* FLOATING POSITION */}
      {isFloating && (
        <>
          {/* Minimalistic 3-dot button */}
          <button
            id="floating-chat-btn"
            onClick={() => isOpen ? animateClose() : animateOpen()}
            className="group fixed overflow-visible pointer-events-auto"
            style={{
              top: '50%',
              right: '30px',
              transform: 'translateY(-50%)',
              width: '40px',
              height: '115px',
              background: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: '20px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4), 0 0 25px rgba(34, 211, 238, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
              fontSize: 0,
              zIndex: 2003,
              cursor: 'pointer',
              opacity: 1,
              transition: 'opacity 0.3s ease-out, box-shadow 0.3s ease-out',
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

          {/* Chat widget */}
          <div
            id="chat-widget-floating"
            className="fixed pointer-events-auto"
            style={{
              top: '50%',
              right: '80px',
              transform: 'translateY(-50%)',
              background: 'linear-gradient(165deg, rgba(18, 18, 20, 0.95) 0%, rgba(10, 10, 12, 0.98) 100%)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              boxShadow: '0 30px 90px rgba(0,0,0,0.8), 0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(60, 60, 65, 0.3) inset, 0 2px 4px rgba(90, 90, 95, 0.15) inset',
              border: '1px solid rgba(60, 60, 65, 0.6)',
              borderRadius: '16px',
              overflow: 'hidden',
              display: 'none',
              flexDirection: 'column',
              zIndex: 2000,
            }}
          >
            {/* Only render ChatInterface when NOT animating */}
            <AnimatePresence>
              {!isAnimating && isOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="h-full"
                >
                  <ChatInterface className="h-full" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Close button - only when fully open */}
            {!isAnimating && isOpen && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
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
            )}
          </div>
        </>
      )}
    </>
  );
}
