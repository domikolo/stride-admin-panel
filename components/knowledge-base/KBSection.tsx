/**
 * KBSection — single KB entry with inline editing, dirty tracking, deploy
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Upload, Trash2, Loader2, Undo2 } from 'lucide-react';
import { KBEntry } from '@/lib/types';

interface KBSectionProps {
  entry: KBEntry;
  onSave: (entryId: string, topic: string, content: string) => Promise<void>;
  onPublish: (entryId: string) => Promise<void>;
  onUnpublish: (entryId: string) => Promise<void>;
  onDelete: (entryId: string) => void;
  onAiAssist: (entryId: string, topic: string, content: string) => Promise<string>;
  isNew?: boolean;
  gapContext?: {
    questionExamples: string[];
    gapReason: string;
  };
}

export default function KBSection({
  entry,
  onSave,
  onPublish,
  onUnpublish,
  onDelete,
  onAiAssist,
  isNew,
  gapContext,
}: KBSectionProps) {
  const [topic, setTopic] = useState(entry.topic);
  const [content, setContent] = useState(entry.content);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isDraft = entry.status === 'draft';
  const isDirty = topic !== entry.topic || content !== entry.content;

  // Auto-resize textarea (preserve scroll position to avoid jump)
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      const scrollY = window.scrollY;
      el.style.height = 'auto';
      el.style.height = `${Math.max(el.scrollHeight, 120)}px`;
      window.scrollTo(0, scrollY);
    }
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [content, resizeTextarea]);

  // Sync with entry updates from parent
  useEffect(() => {
    setTopic(entry.topic);
    setContent(entry.content);
  }, [entry.topic, entry.content]);

  const handleSaveAndPublish = async () => {
    setPublishing(true);
    try {
      if (isDirty) {
        await onSave(entry.kbEntryId, topic, content);
      }
      await onPublish(entry.kbEntryId);
    } finally {
      setPublishing(false);
    }
  };

  const handleDeploy = async () => {
    setSaving(true);
    try {
      await onSave(entry.kbEntryId, topic, content);
      await onPublish(entry.kbEntryId);
    } finally {
      setSaving(false);
    }
  };

  const handleAiAssist = async () => {
    setAiLoading(true);
    try {
      const generated = await onAiAssist(entry.kbEntryId, topic, content);
      setContent(generated);
    } finally {
      setAiLoading(false);
    }
  };

  const handleDiscard = () => {
    setTopic(entry.topic);
    setContent(entry.content);
  };

  return (
    <div className={`rounded-lg border ${isDraft
      ? 'border-dashed border-blue-500/30 bg-blue-500/[0.02]'
      : 'border-white/[0.06] bg-white/[0.02]'
    }`}>
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04]">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isDraft && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium shrink-0">
              DRAFT
            </span>
          )}
          {entry.sourceGapId && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 font-medium shrink-0">
              z luki KB
            </span>
          )}
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="bg-transparent text-sm text-zinc-300 font-medium outline-none flex-1 min-w-0 placeholder:text-zinc-600"
            placeholder="Nazwa sekcji..."
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isDraft && isDirty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDiscard}
              className="text-zinc-500 hover:text-zinc-300 h-7 px-2 text-xs gap-1"
            >
              <Undo2 size={12} />
              Cofnij
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(entry.kbEntryId)}
            className="text-zinc-600 hover:text-red-400 h-7 px-2"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* Content textarea */}
      <div className="px-4 py-3">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full bg-transparent text-sm text-zinc-200 outline-none resize-none leading-relaxed placeholder:text-zinc-600"
          placeholder="Wpisz tresc sekcji bazy wiedzy..."
          style={{ minHeight: '120px' }}
        />
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.04]">
        <div className="flex items-center gap-2">
          {isDraft && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAiAssist}
              disabled={aiLoading || !topic}
              className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 h-7 text-xs gap-1"
            >
              {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              AI Assist
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isDraft && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSaveAndPublish}
              disabled={publishing || !topic || !content}
              className="text-green-400 hover:text-green-300 hover:bg-green-500/10 h-7 text-xs gap-1"
            >
              {publishing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Deploy
            </Button>
          )}
          {!isDraft && isDirty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeploy}
              disabled={saving || !topic || !content}
              className="text-green-400 hover:text-green-300 hover:bg-green-500/10 h-7 text-xs gap-1"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Deploy
            </Button>
          )}
          {!isDraft && !isDirty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUnpublish(entry.kbEntryId)}
              className="text-zinc-500 hover:text-zinc-300 h-7 text-xs"
            >
              Unpublish
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
