/**
 * Knowledge Base Editor — continuous view with inline editing, AI assist, deploy
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSWR, fetcher } from '@/lib/swr';
import {
  createKBEntry,
  updateKBEntry,
  deleteKBEntry,
  generateKBDraft,
  publishKBEntry,
  unpublishKBEntry,
  importKBFromS3,
  resolveGap,
  inlineEditKB,
  getKBVersions,
  revertKBEntry,
} from '@/lib/api';
import { KBEntry, Gap } from '@/lib/types';
import toast from 'react-hot-toast';
import KBSection from '@/components/knowledge-base/KBSection';
import GapsBar from '@/components/knowledge-base/GapsBar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { BookOpen, Plus, Download, Loader2, Search, X, RefreshCw } from 'lucide-react';

export default function KnowledgeBasePage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const processedGapRef = useRef<string | null>(null);

  const clientId = user ? (user.role === 'owner' ? 'stride-services' : (user.clientId ?? null)) : null;
  const getClientId = () => clientId!;

  const { data: entriesData, isLoading: entriesLoading, mutate: mutateEntries } = useSWR<{ entries: KBEntry[]; count: number }>(
    clientId ? `/clients/${clientId}/knowledge-base` : null, fetcher
  );
  const { data: gapsData } = useSWR<{ gaps: Gap[] }>(
    clientId ? `/clients/${clientId}/trending-topics?timeframe=week&include_gaps=true` : null, fetcher
  );
  const { data: resolvedData } = useSWR<{ resolvedGapIds: string[] }>(
    clientId ? `/clients/${clientId}/gaps/resolved` : null, fetcher
  );

  const entries: KBEntry[] = entriesData?.entries ?? [];
  const loading = entriesLoading;
  const error = null; // errors handled via toast

  // Compute visible gaps (not resolved)
  const resolvedNames = resolvedData?.resolvedGapIds ?? [];
  const allGaps = (gapsData as { gaps?: Gap[] } | undefined)?.gaps ?? [];
  const gaps: Gap[] = allGaps.filter(g => !resolvedNames.includes(g.topicName));

  // Handle fix_gap query param from Insights
  useEffect(() => {
    const fixGapTopic = searchParams.get('topic');
    const fixGapId = searchParams.get('fix_gap');
    if (!fixGapTopic || !fixGapId || loading || processedGapRef.current === fixGapId) return;
    processedGapRef.current = fixGapId;

    const examples = searchParams.get('examples');
    const reason = searchParams.get('reason') || '';

    handleAddDraft(
      fixGapTopic,
      fixGapId,
      examples ? examples.split('|||') : [],
      reason,
    );
  }, [searchParams, loading]);

  // CRUD operations
  const handleAddDraft = async (
    topic: string = 'Nowa sekcja',
    sourceGapId?: string,
    questionExamples?: string[],
    gapReason?: string,
  ) => {
    try {
      const entry = await createKBEntry(getClientId(), {
        topic,
        content: '',
        ...(sourceGapId && { source_gap_id: sourceGapId }),
      });
      // Store gap context for AI assist
      if (questionExamples?.length || gapReason) {
        gapContextRef.current.set(entry.kbEntryId, {
          questionExamples: questionExamples || [],
          gapReason: gapReason || '',
        });
      }
      mutateEntries();
    } catch (err) {
      console.error('Failed to create entry:', err);
      toast.error('Nie udało się utworzyć wpisu.');
    }
  };

  // Gap context storage for AI assist
  const gapContextRef = useRef<Map<string, { questionExamples: string[]; gapReason: string }>>(
    new Map()
  );

  const handleSave = async (entryId: string, topic: string, content: string) => {
    await updateKBEntry(getClientId(), entryId, { topic, content });
    mutateEntries();
  };

  const handlePublish = async (entryId: string) => {
    try {
      await publishKBEntry(getClientId(), entryId);
      toast.success('Wpis opublikowany');

      // Auto-resolve gap if this entry came from a gap
      const entry = entries.find(e => e.kbEntryId === entryId);
      if (entry?.sourceGapId) {
        const gap = gaps.find(g => g.topicId === entry.sourceGapId);
        resolveGap(getClientId(), entry.sourceGapId, gap?.topicName || entry.topic).catch(() => { });
      }
      mutateEntries();
    } catch (err) {
      console.error('Failed to publish entry:', err);
      toast.error('Nie udało się opublikować wpisu');
    }
  };

  const handleUnpublish = async (entryId: string) => {
    try {
      await unpublishKBEntry(getClientId(), entryId);
      toast.success('Publikacja cofnięta');
      mutateEntries();
    } catch (err) {
      console.error('Failed to unpublish entry:', err);
      toast.error('Nie udało się cofnąć publikacji');
    }
  };

  const handleDelete = async (entryId: string) => {
    try {
      await deleteKBEntry(getClientId(), entryId);
      gapContextRef.current.delete(entryId);
      toast.success('Wpis usunięty');
      mutateEntries();
    } catch (err) {
      console.error('Failed to delete entry:', err);
      toast.error('Nie udało się usunąć wpisu');
    }
  };

  const handleAiAssist = async (
    entryId: string,
    topic: string,
    content: string,
    options?: { fileContent?: string; instruction?: string }
  ) => {
    const ctx = gapContextRef.current.get(entryId);
    const result = await generateKBDraft(getClientId(), {
      topic,
      existing_content: content,
      question_examples: ctx?.questionExamples,
      gap_reason: ctx?.gapReason,
      file_content: options?.fileContent,
      instruction: options?.instruction,
    });
    return { content: result.content, suggestedTopic: result.suggestedTopic };
  };

  const handleAiInlineEdit = async (
    entryId: string, topic: string, content: string,
    selectedText: string, instruction: string
  ) => {
    const result = await inlineEditKB(getClientId(), {
      topic,
      full_content: content,
      selected_text: selectedText,
      instruction,
    });
    return result.content;
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      await importKBFromS3(getClientId());
      mutateEntries();
    } catch (err) {
      console.error('Failed to import:', err);
      toast.error('Nie udało się zaimportować bazy wiedzy z S3.');
    } finally {
      setImporting(false);
    }
  };

  const handleFixGap = (gap: Gap) => {
    handleAddDraft(
      gap.topicName,
      gap.topicId,
      gap.questionExamples,
      gap.gapReason,
    );
  };

  const handleGetVersions = async (entryId: string) => {
    const cid = getClientId();
    const data = await getKBVersions(cid, entryId);
    return data.versions;
  };

  const handleRevert = async (entryId: string, versionSk: string) => {
    const cid = getClientId();
    await revertKBEntry(cid, entryId, versionSk);
    mutateEntries();
  };

  // Filter + split entries
  const query = searchQuery.toLowerCase().trim();
  const filtered = query
    ? entries.filter(e =>
      e.topic.toLowerCase().includes(query) ||
      e.content.toLowerCase().includes(query)
    )
    : entries;
  const drafts = filtered.filter(e => e.status === 'draft');
  const published = filtered.filter(e => e.status === 'published');

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // Empty state
  if (entries.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-3">
            <BookOpen className="text-blue-400" />
            Baza Wiedzy
          </h1>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BookOpen size={48} className="text-zinc-600 mb-4" />
          <p className="text-zinc-400 mb-6">Brak wpisow w bazie wiedzy.</p>
          <div className="flex gap-3">
            <Button
              onClick={handleImport}
              disabled={importing}
              variant="outline"
              className="gap-2"
            >
              {importing ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Importuj istniejaca KB z S3
            </Button>
            <Button
              onClick={() => handleAddDraft()}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Plus size={16} />
              Nowa sekcja
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-3">
            <BookOpen className="text-blue-400" />
            Baza Wiedzy
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            {query
              ? `Znaleziono ${filtered.length} z ${entries.length} wpisów`
              : `${entries.filter(e => e.status === 'published').length} opublikowanych, ${entries.filter(e => e.status === 'draft').length} szkicow`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Szukaj w bazie wiedzy..."
              className="h-8 w-56 rounded-md border border-white/[0.08] bg-white/[0.03] pl-8 pr-8 text-sm text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-blue-500/40"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => mutateEntries()}
            className="gap-1.5 text-zinc-400 hover:text-white"
          >
            <RefreshCw size={14} />
            Odśwież
          </Button>
          <Button
            onClick={() => handleAddDraft()}
            size="sm"
            className="gap-1.5 bg-blue-600 hover:bg-blue-700"
          >
            <Plus size={14} />
            Nowa sekcja
          </Button>
        </div>
      </div>

      {/* Gaps bar */}
      <GapsBar gaps={gaps} onFixGap={handleFixGap} />

      {/* Drafts */}
      {drafts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-blue-500/20" />
            <span className="text-xs text-blue-400 font-medium uppercase tracking-wider">
              Szkice ({drafts.length})
            </span>
            <div className="h-px flex-1 bg-blue-500/20" />
          </div>
          {/* Stagger KBSection entries */}
          {(() => {
            const kbStaggerContainer = {
              hidden: {},
              visible: { transition: { staggerChildren: 0.06 } },
            };
            const kbStaggerItem = {
              hidden: { opacity: 0, y: 8 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] as const } },
            };
            return (
              <motion.div
                key={`drafts-${drafts.length}`}
                className="space-y-3"
                variants={kbStaggerContainer}
                initial="hidden"
                animate="visible"
              >
                {drafts.map(entry => (
                  <motion.div key={entry.kbEntryId} variants={kbStaggerItem}>
                    <KBSection
                      entry={entry}
                      onSave={handleSave}
                      onPublish={handlePublish}
                      onUnpublish={handleUnpublish}
                      onDelete={handleDelete}
                      onAiAssist={handleAiAssist}
                      onAiInlineEdit={handleAiInlineEdit}
                      onGetVersions={handleGetVersions}
                      onRevert={handleRevert}
                      gapContext={gapContextRef.current.get(entry.kbEntryId)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            );
          })()}
        </div>
      )}

      {/* Published */}
      {published.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
              Aktualna baza wiedzy ({published.length})
            </span>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>
          {(() => {
            const kbStaggerContainer = {
              hidden: {},
              visible: { transition: { staggerChildren: 0.06 } },
            };
            const kbStaggerItem = {
              hidden: { opacity: 0, y: 8 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] as const } },
            };
            return (
              <motion.div
                key={`published-${published.length}`}
                className="space-y-3"
                variants={kbStaggerContainer}
                initial="hidden"
                animate="visible"
              >
                {published.map(entry => (
                  <motion.div key={entry.kbEntryId} variants={kbStaggerItem}>
                    <KBSection
                      entry={entry}
                      onSave={handleSave}
                      onPublish={handlePublish}
                      onUnpublish={handleUnpublish}
                      onDelete={handleDelete}
                      onAiAssist={handleAiAssist}
                      onAiInlineEdit={handleAiInlineEdit}
                      onGetVersions={handleGetVersions}
                      onRevert={handleRevert}
                    />
                  </motion.div>
                ))}
              </motion.div>
            );
          })()}
        </div>
      )}

    </div>
  );
}
