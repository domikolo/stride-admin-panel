'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, X } from 'lucide-react';

interface InlineEditBarProps {
  onSubmit: (instruction: string) => Promise<void>;
  onClose: () => void;
  loading: boolean;
}

export default function InlineEditBar({ onSubmit, onClose, loading }: InlineEditBarProps) {
  const [instruction, setInstruction] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = instruction.trim();
    if (!trimmed || loading) return;
    onSubmit(trimmed);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/[0.06] border-b border-purple-500/20">
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
        disabled={loading}
        className="flex-1 bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-500"
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSubmit}
        disabled={loading || !instruction.trim()}
        className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 h-7 px-2 text-xs gap-1"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        Edytuj
      </Button>
      <button
        onClick={onClose}
        className="text-zinc-500 hover:text-zinc-300 p-0.5"
      >
        <X size={14} />
      </button>
    </div>
  );
}
