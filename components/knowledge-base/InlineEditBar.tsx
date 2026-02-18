'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, X, Check } from 'lucide-react';

type VisualState = 'idle' | 'loading' | 'done';

interface InlineEditBarProps {
  onSubmit: (instruction: string) => Promise<void>;
  onClose: () => void;
  state: VisualState;
  position: { x: number; y: number };
  selectedText: string;
}

export default function InlineEditBar({ onSubmit, onClose, state, position, selectedText }: InlineEditBarProps) {
  const [instruction, setInstruction] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Focus input on mount, but without stealing selection from textarea
  useEffect(() => {
    // Small delay so the mouseup event finishes first
    const id = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, []);

  // Auto-close after "done" state
  useEffect(() => {
    if (state === 'done') {
      const id = setTimeout(onClose, 1500);
      return () => clearTimeout(id);
    }
  }, [state, onClose]);

  const handleSubmit = () => {
    const trimmed = instruction.trim();
    if (!trimmed || state !== 'idle') return;
    onSubmit(trimmed);
  };

  const preview = selectedText.length > 60
    ? selectedText.slice(0, 57) + '...'
    : selectedText;

  // Clamp position to stay within viewport
  const popupWidth = 340;
  const popupHeight = 110;
  const pad = 8;
  const left = Math.min(position.x, (typeof window !== 'undefined' ? window.innerWidth : 9999) - popupWidth - pad);
  const top = Math.min(position.y, (typeof window !== 'undefined' ? window.innerHeight : 9999) - popupHeight - pad);

  return (
    <div
      ref={popupRef}
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        left: Math.max(pad, left),
        top: Math.max(pad, top),
        width: popupWidth,
        zIndex: 50,
      }}
      className="rounded-lg border border-purple-500/25 bg-zinc-900/95 backdrop-blur-sm shadow-xl shadow-purple-500/5"
    >
      {/* Header with preview */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06]">
        <span className="text-[11px] text-zinc-500 truncate mr-2" title={selectedText}>
          &ldquo;{preview}&rdquo;
        </span>
        {state === 'idle' && (
          <button
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
            className="text-zinc-500 hover:text-zinc-300 p-0.5 shrink-0"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        {state === 'idle' && (
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-purple-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
                if (e.key === 'Escape') onClose();
              }}
              placeholder="Jak AI ma zmienić ten fragment?"
              className="flex-1 bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-500"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSubmit}
              disabled={!instruction.trim()}
              className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 h-7 px-2 text-xs gap-1 shrink-0"
            >
              <Sparkles size={12} />
              Edytuj
            </Button>
          </div>
        )}

        {state === 'loading' && (
          <div className="flex items-center gap-2 py-0.5">
            <Loader2 size={14} className="text-purple-400 animate-spin shrink-0" />
            <span className="text-sm text-purple-300">Edytuję...</span>
          </div>
        )}

        {state === 'done' && (
          <div className="flex items-center gap-2 py-0.5">
            <Check size={14} className="text-green-400 shrink-0" />
            <span className="text-sm text-green-300">Gotowe!</span>
          </div>
        )}
      </div>
    </div>
  );
}
