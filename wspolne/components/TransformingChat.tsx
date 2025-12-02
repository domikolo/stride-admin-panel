'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function TransformingChat() {
  const [isFloating, setIsFloating] = useState(false);
  const [isOpen, setIsOpen] = useState(true); // Controls the small bubble vs large window in floating mode
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

  const ChatInterface = ({ className, minimizeAction, isMobile }: { className?: string, minimizeAction?: () => void, isMobile?: boolean }) => (
    <div className={cn(
        "flex flex-col h-full bg-black/5 backdrop-blur-2xl backdrop-saturate-150 overflow-hidden border border-white/[0.08] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.9),inset_0_0_0_1px_rgba(255,255,255,0.05),inset_0_1px_0_0_rgba(255,255,255,0.1)]", 
        isMobile ? "rounded-2xl" : "rounded-2xl", // Consistent rounding
        className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/[0.03]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white shadow-inner backdrop-blur-sm">
              <Sparkles size={20} />
            </div>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-black/50"></div>
          </div>
          <div>
            <div className="font-semibold text-white text-sm">Stride Assistant</div>
            <div className="text-xs text-zinc-400 font-medium">Active Now</div>
          </div>
        </div>
        {minimizeAction && (
          <button onClick={minimizeAction} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-zinc-400 hover:bg-white/10 hover:text-white transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 min-h-[300px]">
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[90%] px-4 py-3 text-[14px] leading-relaxed shadow-sm backdrop-blur-sm",
              msg.role === 'user' 
                ? "bg-white/90 text-black rounded-2xl rounded-br-sm font-medium" 
                : "bg-white/[0.02] text-zinc-200 rounded-2xl rounded-bl-sm border border-white/5"
            )}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/5 bg-black/40">
        <div className="flex gap-2 bg-white/5 border border-white/5 rounded-xl p-1.5 pl-4 transition-all focus-within:bg-white/10 focus-within:border-white/10">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Napisz wiadomość..."
            className="flex-1 bg-transparent text-white text-[14px] focus:outline-none placeholder:text-zinc-500"
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
      <div className="w-full max-w-[400px] mx-auto h-[520px] relative z-10 hidden md:block">
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
      <AnimatePresence mode="wait">
        {isFloating && (
          <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end pointer-events-none">
            <div className="pointer-events-auto">
            {isOpen ? (
              <motion.div
                key="floating-chat-window"
                layoutId="chat-widget" // Connecting this ID creates the morph effect, but morphing from bubble to window
                initial={{ opacity: 0, scale: 0.5, y: 100 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 100, transition: { duration: 0.2 } }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="w-[278px] h-[390px] shadow-2xl shadow-black/80"
              >
                <ChatInterface 
                    className="h-full" 
                    minimizeAction={() => setIsOpen(false)} 
                />
              </motion.div>
            ) : (
              <motion.button
                key="floating-bubble"
                layoutId="chat-bubble" // Separate layout ID for the bubble
                initial={{ scale: 0, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0, y: 20, transition: { duration: 0.2 } }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(true)}
                className="group relative flex items-center gap-3 bg-white text-black px-6 py-4 rounded-full shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] transition-shadow duration-300 cursor-pointer"
              >
                {/* Pulsing dot */}
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                
                <div className="flex flex-col items-start">
                  <span className="text-sm font-bold leading-none">Stride Assistant</span>
                  <span className="text-xs text-zinc-500 font-medium">W czym mogę pomóc?</span>
                </div>

                <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white ml-2 group-hover:rotate-12 transition-transform">
                    <Sparkles size={18} />
                </div>
              </motion.button>
            )}
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
