/**
 * KBSection — single KB entry with inline editing, dirty tracking, deploy
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Button } from '@/components/ui/button';
import { Sparkles, Upload, Trash2, Loader2, Undo2, AlertTriangle, MessageSquare } from 'lucide-react';
import { KBEntry } from '@/lib/types';
import InlineEditBar from './InlineEditBar';

interface KBSectionProps {
  entry: KBEntry;
  onSave: (entryId: string, topic: string, content: string) => Promise<void>;
  onPublish: (entryId: string) => Promise<void>;
  onUnpublish: (entryId: string) => Promise<void>;
  onDelete: (entryId: string) => void;
  onAiAssist: (entryId: string, topic: string, content: string) => Promise<string>;
  onAiInlineEdit?: (entryId: string, topic: string, content: string, selectedText: string, instruction: string) => Promise<string>;
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
  onAiInlineEdit,
  isNew,
  gapContext,
}: KBSectionProps) {
  const [topic, setTopic] = useState(entry.topic);
  const [content, setContent] = useState(entry.content);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Inline edit selection state
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [inlineEditState, setInlineEditState] = useState<'idle' | 'loading' | 'done'>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingRef = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  // Track mouse position over textarea for popup placement
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  // Fires on any selection change: mouse drag, double/triple click, Ctrl+A, Shift+arrows
  const handleSelect = useCallback(() => {
    const ta = textareaRef.current;
    const container = containerRef.current;
    if (!ta || !container || isNew || !onAiInlineEdit) return;
    if (closingRef.current) return;

    // Clear previous debounce
    if (selectionTimer.current) clearTimeout(selectionTimer.current);

    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    // No selection → dismiss (unless loading)
    if (start === end) {
      if (inlineEditState !== 'loading') {
        setSelection(null);
        setPopupPos(null);
      }
      return;
    }

    // Debounce 600ms — lets double/triple click settle
    selectionTimer.current = setTimeout(() => {
      // Re-check selection (may have changed during debounce)
      const s = ta.selectionStart;
      const e = ta.selectionEnd;
      if (s === e) return;

      const rect = container.getBoundingClientRect();
      const popupWidth = 340;

      // Position relative to container, clamped to stay within bounds
      let px = lastMouse.current.x - rect.left;
      let py = lastMouse.current.y - rect.top + 14;

      // Clamp horizontal: keep popup fully inside container (or at least start at 0)
      px = Math.max(0, Math.min(px, rect.width - popupWidth));
      // Clamp vertical: don't go above container
      py = Math.max(0, py);

      setSelection({ start: s, end: e });
      setPopupPos({ x: px, y: py });
      setInlineEditState('idle');
    }, 600);
  }, [isNew, onAiInlineEdit, inlineEditState]);

  const handleInlineClose = useCallback(() => {
    closingRef.current = true;
    setTimeout(() => { closingRef.current = false; }, 400);
    if (selectionTimer.current) clearTimeout(selectionTimer.current);
    setSelection(null);
    setPopupPos(null);
    setInlineEditState('idle');
  }, []);

  const handleInlineEdit = async (instruction: string) => {
    if (!selection || !onAiInlineEdit) return;
    const selectedText = content.slice(selection.start, selection.end);
    setInlineEditState('loading');
    try {
      const edited = await onAiInlineEdit(entry.kbEntryId, topic, content, selectedText, instruction);
      setContent(prev =>
        prev.slice(0, selection.start) + edited + prev.slice(selection.end)
      );
      setInlineEditState('done');
    } catch {
      setInlineEditState('idle');
    }
  };

  const isDraft = entry.status === 'draft';
  const isDirty = topic !== entry.topic || content !== entry.content;

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
    <div
      ref={containerRef}
      className={`rounded-lg border relative ${isDraft
        ? 'border-dashed border-blue-500/30 bg-blue-500/[0.02]'
        : 'border-white/[0.06] bg-white/[0.02]'
      }`}
    >
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

      {/* Gap context */}
      {gapContext && isDraft && (gapContext.gapReason || gapContext.questionExamples.length > 0) && (
        <div className="mx-4 mt-3 p-3 bg-yellow-500/[0.05] border border-yellow-500/15 rounded-lg space-y-2">
          {gapContext.gapReason && (
            <div className="flex items-start gap-2">
              <AlertTriangle size={13} className="text-yellow-400 mt-0.5 shrink-0" />
              <p className="text-xs text-yellow-400">{gapContext.gapReason}</p>
            </div>
          )}
          {gapContext.questionExamples.length > 0 && (
            <div className="flex items-start gap-2">
              <MessageSquare size={13} className="text-zinc-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] text-zinc-500 mb-1">Pytania uzytkownikow:</p>
                <ul className="space-y-0.5">
                  {gapContext.questionExamples.slice(0, 5).map((q, i) => (
                    <li key={i} className="text-xs text-zinc-400 italic">&ldquo;{q}&rdquo;</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating inline AI edit popup */}
      {selection && popupPos && !isNew && onAiInlineEdit && (
        <InlineEditBar
          onSubmit={handleInlineEdit}
          onClose={handleInlineClose}
          state={inlineEditState}
          position={popupPos}
          selectedText={content.slice(selection.start, selection.end)}
        />
      )}

      {/* Content textarea with highlight overlay for selected fragment */}
      <div className="px-4 py-3">
        <div className="relative">
          {/* Highlight backdrop — mirrors textarea text, shows purple highlight on selected fragment during loading */}
          {selection && inlineEditState === 'loading' && (
            <div
              aria-hidden
              className="absolute inset-0 whitespace-pre-wrap break-words text-sm leading-relaxed text-transparent pointer-events-none overflow-hidden"
              style={{ wordBreak: 'break-word' }}
            >
              {content.slice(0, selection.start)}
              <mark className="bg-purple-500/20 text-transparent rounded-sm">{content.slice(selection.start, selection.end)}</mark>
              {content.slice(selection.end)}
            </div>
          )}
          <TextareaAutosize
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onSelect={handleSelect}
            onMouseMove={handleMouseMove}
            minRows={5}
            className="w-full bg-transparent text-sm text-zinc-200 outline-none resize-none leading-relaxed placeholder:text-zinc-600 relative z-[1]"
            placeholder="Wpisz tresc sekcji bazy wiedzy..."
          />
        </div>
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
