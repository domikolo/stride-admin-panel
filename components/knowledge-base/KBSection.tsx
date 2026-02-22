/**
 * KBSection — single KB entry with inline editing, dirty tracking, deploy
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Button } from '@/components/ui/button';
import {
  Sparkles, Upload, Trash2, Loader2, Undo2, AlertTriangle,
  MessageSquare, Paperclip, X, FileText, FileSpreadsheet, Clock,
} from 'lucide-react';
import { KBEntry, KBVersion } from '@/lib/types';
import InlineEditBar from './InlineEditBar';
import { extractTextFromFile, AI_CHAR_LIMIT, type ExtractResult } from '@/lib/fileExtractor';

interface KBSectionProps {
  entry: KBEntry;
  onSave: (entryId: string, topic: string, content: string) => Promise<void>;
  onPublish: (entryId: string) => Promise<void>;
  onUnpublish: (entryId: string) => Promise<void>;
  onDelete: (entryId: string) => void;
  onAiAssist: (
    entryId: string,
    topic: string,
    content: string,
    options?: { fileContent?: string; instruction?: string }
  ) => Promise<{ content: string; suggestedTopic?: string }>;
  onAiInlineEdit?: (entryId: string, topic: string, content: string, selectedText: string, instruction: string) => Promise<string>;
  onGetVersions?: (entryId: string) => Promise<KBVersion[]>;
  onRevert?: (entryId: string, versionSk: string) => Promise<void>;
  isNew?: boolean;
  gapContext?: {
    questionExamples: string[];
    gapReason: string;
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatChars(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function FileIcon({ ext }: { ext: string }) {
  if (ext === 'csv') return <FileSpreadsheet size={16} className="text-green-400 shrink-0" />;
  return <FileText size={16} className="text-blue-400 shrink-0" />;
}

function getDefaultPrompt(topic: string, hasContent: boolean, hasFile: boolean): string {
  if (hasFile && hasContent) {
    return `Uwzględniając załączony plik oraz poniższy tekst, sformatuj kompletny wpis bazy wiedzy chatbota.`;
  }
  if (hasFile) {
    return `Wyciągnij kluczowe informacje z załączonego pliku i sformatuj jako wpis bazy wiedzy chatbota.`;
  }
  if (hasContent) {
    return `Rozbuduj i sformatuj poniższy tekst jako wpis bazy wiedzy chatbota. Zachowaj informacje użytkownika, dodaj szczegóły i popraw formatowanie.`;
  }
  return `Wygeneruj treść wpisu bazy wiedzy chatbota na temat: ${topic}. Tekst powinien być czytelny, konkretny i pomocny.`;
}

export default function KBSection({
  entry,
  onSave,
  onPublish,
  onUnpublish,
  onDelete,
  onAiAssist,
  onAiInlineEdit,
  onGetVersions,
  onRevert,
  isNew,
  gapContext,
}: KBSectionProps) {
  const [topic, setTopic] = useState(entry.topic);
  const [content, setContent] = useState(entry.content);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [contentFlash, setContentFlash] = useState(false);

  // Version history
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);

  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<KBVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [reverting, setReverting] = useState<string | null>(null);

  // File attachment
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [extractResult, setExtractResult] = useState<ExtractResult | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState('');
  const fileErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showFileError = (msg: string) => {
    if (fileErrorTimer.current) clearTimeout(fileErrorTimer.current);
    setFileError(msg);
    fileErrorTimer.current = setTimeout(() => setFileError(''), 6000);
  };

  // AI prompt panel
  const [showPrompt, setShowPrompt] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  // Inline edit
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [inlineEditState, setInlineEditState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [inputFocused, setInputFocused] = useState(false);
  const [doneRange, setDoneRange] = useState<{ start: number; end: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingRef = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleSelect = useCallback(() => {
    const ta = textareaRef.current;
    const container = containerRef.current;
    if (!ta || !container || isNew || !onAiInlineEdit) return;
    if (closingRef.current) return;
    if (selectionTimer.current) clearTimeout(selectionTimer.current);

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) {
      if (inlineEditState !== 'loading') { setSelection(null); setPopupPos(null); }
      return;
    }

    selectionTimer.current = setTimeout(() => {
      const s = ta.selectionStart;
      const e = ta.selectionEnd;
      if (s === e) return;
      const rect = container.getBoundingClientRect();
      const popupWidth = 340;
      let px = Math.max(0, Math.min(lastMouse.current.x - rect.left, rect.width - popupWidth));
      let py = Math.max(0, lastMouse.current.y - rect.top + 14);
      setSelection({ start: s, end: e });
      setPopupPos({ x: px, y: py });
      setInlineEditState('idle');
    }, 600);
  }, [isNew, onAiInlineEdit, inlineEditState]);

  const handleInlineClose = useCallback(() => {
    closingRef.current = true;
    setTimeout(() => { closingRef.current = false; }, 400);
    if (selectionTimer.current) clearTimeout(selectionTimer.current);
    setSelection(null); setPopupPos(null);
    setInlineEditState('idle'); setInputFocused(false);
  }, []);

  const handleInlineEdit = async (instruction: string) => {
    if (!selection || !onAiInlineEdit) return;
    const selectedText = content.slice(selection.start, selection.end);
    setInlineEditState('loading');
    setInputFocused(false);
    try {
      const edited = await onAiInlineEdit(entry.kbEntryId, topic, content, selectedText, instruction);
      setDoneRange({ start: selection.start, end: selection.start + edited.length });
      setContent(prev => prev.slice(0, selection.start) + edited + prev.slice(selection.end));
      setInlineEditState('done');
      setTimeout(() => { setSelection(null); setPopupPos(null); setInlineEditState('idle'); setInputFocused(false); }, 1500);
      setTimeout(() => setDoneRange(null), 2500);
    } catch { setInlineEditState('idle'); }
  };

  const isDraft = entry.status === 'draft';
  const isDirty = topic !== entry.topic || content !== entry.content;

  useEffect(() => {
    setTopic(entry.topic);
    setContent(entry.content);
  }, [entry.topic, entry.content]);

  // When prompt panel opens, set context-aware default
  const openPromptPanel = () => {
    setAiPrompt(getDefaultPrompt(topic, content.trim().length > 0, !!attachedFile));
    setShowPrompt(true);
  };

  const closePromptPanel = () => {
    setShowPrompt(false);
    setAiPrompt('');
  };

  const handleGenerate = async () => {
    setAiLoading(true);
    try {
      const result = await onAiAssist(entry.kbEntryId, topic, content, {
        fileContent: extractResult?.text,
        instruction: aiPrompt,
      });
      setContent(result.content);
      if (result.suggestedTopic && topic === 'Nowa sekcja') {
        setTopic(result.suggestedTopic);
      }
      closePromptPanel();
      // Flash green on textarea
      setContentFlash(true);
      setTimeout(() => setContentFlash(false), 1200);
    } finally {
      setAiLoading(false);
    }
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileLoading(true);
    setFileError('');
    try {
      const result = await extractTextFromFile(file);
      setAttachedFile(file);
      setExtractResult(result);
      // If prompt panel is open, refresh default prompt
      if (showPrompt) {
        setAiPrompt(getDefaultPrompt(topic, content.trim().length > 0, true));
      }
    } catch (err) {
      showFileError(err instanceof Error ? err.message : 'Nie udało się odczytać pliku.');
    } finally {
      setFileLoading(false);
      e.target.value = '';
    }
  };

  const handleRemoveFile = () => {
    setAttachedFile(null);
    setExtractResult(null);
    setFileError('');
    if (showPrompt) {
      setAiPrompt(getDefaultPrompt(topic, content.trim().length > 0, false));
    }
  };

  const handleSaveAndPublish = async () => {
    setPublishing(true);
    try {
      if (isDirty) await onSave(entry.kbEntryId, topic, content);
      await onPublish(entry.kbEntryId);
    } finally { setPublishing(false); }
  };

  const handleDeploy = async () => {
    setSaving(true);
    try {
      await onSave(entry.kbEntryId, topic, content);
      await onPublish(entry.kbEntryId);
    } finally { setSaving(false); }
  };

  const handleDiscard = () => {
    setTopic(entry.topic);
    setContent(entry.content);
  };

  const handleToggleVersions = async () => {
    if (showVersions) {
      setShowVersions(false);
      return;
    }
    if (!onGetVersions) return;
    setVersionsLoading(true);
    setShowVersions(true);
    try {
      const v = await onGetVersions(entry.kbEntryId);
      setVersions(v);
    } catch { setVersions([]); }
    finally { setVersionsLoading(false); }
  };

  const handleRevert = async (versionSk: string) => {
    if (!onRevert) return;
    setReverting(versionSk);
    try {
      await onRevert(entry.kbEntryId, versionSk);
      setShowVersions(false);
    } finally { setReverting(null); }
  };

  const formatVersionDate = (ts: string) => {
    try {
      const d = new Date(ts);
      const day = d.getDate();
      const months = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
      const month = months[d.getMonth()];
      const h = d.getHours().toString().padStart(2, '0');
      const m = d.getMinutes().toString().padStart(2, '0');
      return `${day} ${month}, ${h}:${m}`;
    } catch { return ts; }
  };

  const attachedExt = attachedFile?.name.split('.').pop()?.toLowerCase() ?? '';
  const truncated = extractResult && extractResult.totalChars > AI_CHAR_LIMIT;

  return (
    <div
      ref={containerRef}
      className={`rounded-lg border relative ${isDraft
        ? 'border-dashed border-blue-500/30 bg-blue-500/[0.02]'
        : 'border-white/[0.06] bg-white/[0.02]'
      }`}
    >
      {/* Header */}
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
            <Button variant="ghost" size="sm" onClick={handleDiscard}
              className="text-zinc-500 hover:text-zinc-300 h-7 px-2 text-xs gap-1">
              <Undo2 size={12} /> Cofnij
            </Button>
          )}
          {onGetVersions && (
            <Button variant="ghost" size="sm" onClick={handleToggleVersions}
              className={`h-7 px-2 ${showVersions ? 'text-blue-400' : 'text-zinc-600 hover:text-zinc-300'}`}>
              <Clock size={14} />
            </Button>
          )}
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-zinc-500">Usunąć?</span>
              <Button
                variant="ghost" size="sm"
                onClick={() => { setConfirmDelete(false); onDelete(entry.kbEntryId); }}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-6 px-2 text-xs"
              >
                Tak
              </Button>
              <Button
                variant="ghost" size="sm"
                onClick={() => setConfirmDelete(false)}
                className="text-zinc-500 hover:text-zinc-300 h-6 px-2 text-xs"
              >
                Nie
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost" size="sm"
              onClick={() => setConfirmDelete(true)}
              className="text-zinc-600 hover:text-red-400 h-7 px-2"
            >
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Version history dropdown */}
      {showVersions && (
        <div className="mx-4 mt-2 p-2 bg-white/[0.03] border border-white/[0.08] rounded-lg">
          {versionsLoading ? (
            <div className="flex items-center gap-2 py-2 px-1">
              <Loader2 size={12} className="animate-spin text-zinc-400" />
              <span className="text-xs text-zinc-500">Ładowanie historii...</span>
            </div>
          ) : versions.length === 0 ? (
            <p className="text-xs text-zinc-500 py-2 px-1">Brak wcześniejszych wersji</p>
          ) : (
            <div className="space-y-1">
              {versions.map(v => (
                <div key={v.versionSk} className="flex items-center justify-between gap-3 py-1.5 px-2 rounded hover:bg-white/[0.03]">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-zinc-300 truncate">{v.topic}</p>
                    <p className="text-[11px] text-zinc-500">{formatVersionDate(v.versionTimestamp)}</p>
                  </div>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => handleRevert(v.versionSk)}
                    disabled={reverting !== null}
                    className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-6 text-[11px] px-2 shrink-0"
                  >
                    {reverting === v.versionSk ? <Loader2 size={10} className="animate-spin" /> : 'Przywróć'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

      {/* File card */}
      {attachedFile && (
        <div className="mx-4 mt-3">
          <div className="flex items-center gap-3 px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg">
            <FileIcon ext={attachedExt} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-300 truncate">{attachedFile.name}</p>
              <p className="text-[11px] text-zinc-500">
                {formatBytes(attachedFile.size)}
                {extractResult && (
                  <span className="ml-2">
                    · {formatChars(extractResult.totalChars)} znaków
                    {truncated && (
                      <span className="text-yellow-500 ml-1">
                        (AI przetworzy pierwsze {formatChars(AI_CHAR_LIMIT)})
                      </span>
                    )}
                  </span>
                )}
              </p>
            </div>
            <button onClick={handleRemoveFile} className="text-zinc-500 hover:text-zinc-300 transition-colors ml-1">
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* File error */}
      {fileError && (
        <div className="mx-4 mt-3 flex items-start gap-2 p-3 bg-red-500/[0.05] border border-red-500/20 rounded-lg animate-in fade-in slide-in-from-top-1 duration-200">
          <AlertTriangle size={13} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-400">{fileError}</p>
        </div>
      )}

      {/* Inline edit popup */}
      {selection && popupPos && !isNew && onAiInlineEdit && (
        <InlineEditBar
          onSubmit={handleInlineEdit}
          onClose={handleInlineClose}
          state={inlineEditState}
          position={popupPos}
          selectedText={content.slice(selection.start, selection.end)}
          onInputFocus={() => setInputFocused(true)}
          onInputBlur={() => setInputFocused(false)}
        />
      )}

      {/* Content textarea */}
      <div className="px-4 py-3">
        <div className="relative">
          {/* Inline edit highlight backdrop */}
          {(() => {
            const showIdleHighlight = selection && inputFocused && inlineEditState === 'idle';
            const showLoadingHighlight = selection && inlineEditState === 'loading';
            const showDoneHighlight = doneRange && inlineEditState !== 'loading';
            const highlightRange = showDoneHighlight ? doneRange
              : (showLoadingHighlight || showIdleHighlight) ? selection : null;
            const markClass = showDoneHighlight
              ? 'bg-green-500/20 text-transparent rounded-sm'
              : showLoadingHighlight
              ? 'bg-purple-500/25 text-transparent rounded-sm animate-pulse'
              : 'bg-purple-500/15 text-transparent rounded-sm';
            if (!highlightRange) return null;
            return (
              <div
                aria-hidden
                className={`absolute inset-0 whitespace-pre-wrap break-words text-sm leading-relaxed text-transparent pointer-events-none overflow-hidden ${showDoneHighlight ? 'transition-opacity duration-1000' : ''}`}
                style={{ wordBreak: 'break-word' }}
              >
                {content.slice(0, highlightRange.start)}
                <mark className={markClass}>{content.slice(highlightRange.start, highlightRange.end)}</mark>
                {content.slice(highlightRange.end)}
              </div>
            );
          })()}

          {/* Generation flash overlay */}
          {contentFlash && (
            <div
              aria-hidden
              className="absolute inset-0 rounded bg-green-500/10 pointer-events-none transition-opacity duration-1000"
            />
          )}

          <TextareaAutosize
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onSelect={handleSelect}
            onMouseMove={handleMouseMove}
            minRows={5}
            className="w-full bg-transparent text-sm text-zinc-200 outline-none resize-none leading-relaxed placeholder:text-zinc-600 relative z-[1]"
            placeholder="Wpisz treść, wklej cokolwiek, lub użyj AI Assist..."
          />
        </div>
      </div>

      {/* Character counter */}
      <div className="px-4 -mt-1 mb-1 flex justify-end">
        <span className={`text-[11px] ${
          content.length > 5000 ? 'text-red-400' :
          content.length >= 2000 ? 'text-yellow-400' :
          'text-green-400'
        }`}>
          {content.length.toLocaleString('pl-PL')} znaków
        </span>
      </div>

      {/* AI Prompt panel */}
      {showPrompt && (
        <div className="mx-4 mb-3 p-3 bg-purple-500/[0.05] border border-purple-500/20 rounded-lg space-y-2">
          <p className="text-[11px] text-purple-400 font-medium">Instrukcja dla AI</p>
          <TextareaAutosize
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            minRows={2}
            autoFocus
            className="w-full bg-transparent text-sm text-zinc-200 outline-none resize-none leading-relaxed placeholder:text-zinc-500"
            placeholder="Opisz co ma zrobić AI..."
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost" size="sm"
              onClick={closePromptPanel}
              disabled={aiLoading}
              className="text-zinc-500 hover:text-zinc-300 h-7 text-xs"
            >
              Anuluj
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={handleGenerate}
              disabled={aiLoading || !aiPrompt.trim()}
              className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 h-7 text-xs gap-1"
            >
              {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Generuj
            </Button>
          </div>
        </div>
      )}

      {/* Audit metadata */}
      <div className="px-4 pb-2 flex items-center gap-3 text-[11px] text-zinc-600">
        {entry.createdAt && (
          <span>
            Utworzono: {new Date(entry.createdAt).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            {entry.createdBy && <span> przez {entry.createdBy}</span>}
          </span>
        )}
        {entry.updatedAt && entry.updatedAt !== entry.createdAt && (
          <span>
            · Zaktualizowano: {new Date(entry.updatedAt).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </span>
        )}
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.04]">
        <div className="flex items-center gap-2">
          {isDraft && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.csv,.pdf,.docx"
                className="hidden"
                onChange={handleFileAttach}
              />
              <Button
                variant="ghost" size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={fileLoading || aiLoading}
                className="text-zinc-400 hover:text-zinc-200 h-7 text-xs gap-1"
              >
                {fileLoading
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Paperclip size={12} />}
                {attachedFile ? 'Zmień plik' : 'Dołącz plik'}
              </Button>

              <Button
                variant="ghost" size="sm"
                onClick={showPrompt ? closePromptPanel : openPromptPanel}
                disabled={aiLoading || !topic}
                className={`h-7 text-xs gap-1 ${showPrompt
                  ? 'text-purple-300 bg-purple-500/10'
                  : 'text-purple-400 hover:text-purple-300 hover:bg-purple-500/10'
                }`}
              >
                <Sparkles size={12} />
                AI Assist
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isDraft && (
            <Button
              variant="ghost" size="sm"
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
              variant="ghost" size="sm"
              onClick={handleDeploy}
              disabled={saving || !topic || !content}
              className="text-green-400 hover:text-green-300 hover:bg-green-500/10 h-7 text-xs gap-1"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Deploy
            </Button>
          )}
          {!isDraft && !isDirty && (
            confirmUnpublish ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-500">Cofnąć publikację?</span>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => { setConfirmUnpublish(false); onUnpublish(entry.kbEntryId); }}
                  className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 h-6 px-2 text-xs"
                >
                  Tak
                </Button>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => setConfirmUnpublish(false)}
                  className="text-zinc-500 hover:text-zinc-300 h-6 px-2 text-xs"
                >
                  Nie
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost" size="sm"
                onClick={() => setConfirmUnpublish(true)}
                className="text-zinc-500 hover:text-zinc-300 h-7 text-xs"
              >
                Unpublish
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
