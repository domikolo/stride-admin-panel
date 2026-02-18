'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, X, Check, GripHorizontal } from 'lucide-react';

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
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Don't auto-focus — textarea keeps focus so selection stays alive
  // User clicks into input when ready to type instruction

  // Auto-close after "done" state
  useEffect(() => {
    if (state === 'done') {
      const id = setTimeout(onClose, 1500);
      return () => clearTimeout(id);
    }
  }, [state, onClose]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };

    const handleMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      setOffset({
        x: ev.clientX - dragStart.current.x,
        y: ev.clientY - dragStart.current.y,
      });
    };
    const handleUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [offset]);

  const handleSubmit = () => {
    const trimmed = instruction.trim();
    if (!trimmed || state !== 'idle') return;
    onSubmit(trimmed);
  };

  const preview = selectedText.length > 60
    ? selectedText.slice(0, 57) + '...'
    : selectedText;

  const popupWidth = 340;

  return (
    <div
      ref={popupRef}
      onMouseDown={(e) => {
        // Prevent textarea from stealing focus when clicking inside popup
        // but allow clicks on our own input
        if ((e.target as HTMLElement).tagName !== 'INPUT') {
          e.preventDefault();
        }
      }}
      style={{
        position: 'absolute',
        left: position.x + offset.x,
        top: position.y + offset.y,
        width: popupWidth,
        zIndex: 50,
      }}
      className="rounded-lg border border-purple-500/25 bg-zinc-900/95 backdrop-blur-sm shadow-xl shadow-purple-500/5"
    >
      {/* Header — draggable */}
      <div
        onMouseDown={handleDragStart}
        className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06] cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex items-center gap-1.5 min-w-0 mr-2">
          <GripHorizontal size={12} className="text-zinc-600 shrink-0" />
          <span className="text-[11px] text-zinc-500 truncate" title={selectedText}>
            &ldquo;{preview}&rdquo;
          </span>
        </div>
        {state === 'idle' && (
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
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
              onMouseDown={(e) => e.preventDefault()}
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
