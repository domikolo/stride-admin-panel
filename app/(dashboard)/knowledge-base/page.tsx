/**
 * Knowledge Base Editor — continuous view with inline editing, AI assist, deploy
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  getKBEntries,
  createKBEntry,
  updateKBEntry,
  deleteKBEntry,
  generateKBDraft,
  publishKBEntry,
  unpublishKBEntry,
  importKBFromS3,
  getGaps,
  resolveGap,
} from '@/lib/api';
import { KBEntry, Gap } from '@/lib/types';
import KBSection from '@/components/knowledge-base/KBSection';
import GapsBar from '@/components/knowledge-base/GapsBar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { BookOpen, Plus, Download, Loader2 } from 'lucide-react';

export default function KnowledgeBasePage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const processedGapRef = useRef<string | null>(null);

  const getClientId = () =>
    user?.role === 'owner' ? 'stride-services' : user?.clientId || 'stride-services';

  // Load entries + gaps
  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const cid = getClientId();
      const [kbData, gapsData] = await Promise.all([
        getKBEntries(cid),
        getGaps(cid, 'week').catch(() => ({ gaps: [] as Gap[] })),
      ]);
      setEntries(kbData.entries);
      setGaps((gapsData as { gaps: Gap[] }).gaps || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load KB:', err);
      setError('Nie udalo sie zaladowac bazy wiedzy.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      setEntries(prev => [entry, ...prev]);
    } catch (err) {
      console.error('Failed to create entry:', err);
      setError('Nie udalo sie utworzyc wpisu.');
    }
  };

  // Gap context storage for AI assist
  const gapContextRef = useRef<Map<string, { questionExamples: string[]; gapReason: string }>>(
    new Map()
  );

  const handleSave = async (entryId: string, topic: string, content: string) => {
    const updated = await updateKBEntry(getClientId(), entryId, { topic, content });
    setEntries(prev =>
      prev.map(e => (e.kbEntryId === entryId ? { ...e, ...updated } : e))
    );
  };

  const handlePublish = async (entryId: string) => {
    const updated = await publishKBEntry(getClientId(), entryId);
    setEntries(prev =>
      prev.map(e => (e.kbEntryId === entryId ? { ...e, ...updated } : e))
    );

    // Auto-resolve gap if this entry came from a gap
    const entry = entries.find(e => e.kbEntryId === entryId);
    if (entry?.sourceGapId) {
      const gap = gaps.find(g => g.topicId === entry.sourceGapId);
      resolveGap(getClientId(), entry.sourceGapId, gap?.topicName || entry.topic).catch(() => {});
      setGaps(prev => prev.filter(g => g.topicId !== entry.sourceGapId));
    }
  };

  const handleUnpublish = async (entryId: string) => {
    const updated = await unpublishKBEntry(getClientId(), entryId);
    setEntries(prev =>
      prev.map(e => (e.kbEntryId === entryId ? { ...e, ...updated } : e))
    );
  };

  const handleDelete = async (entryId: string) => {
    try {
      await deleteKBEntry(getClientId(), entryId);
      setEntries(prev => prev.filter(e => e.kbEntryId !== entryId));
      gapContextRef.current.delete(entryId);
    } catch (err) {
      console.error('Failed to delete entry:', err);
      setError('Nie udalo sie usunac wpisu.');
    }
  };

  const handleAiAssist = async (entryId: string, topic: string, content: string) => {
    const ctx = gapContextRef.current.get(entryId);
    const result = await generateKBDraft(getClientId(), {
      topic,
      existing_content: content,
      question_examples: ctx?.questionExamples,
      gap_reason: ctx?.gapReason,
    });
    return result.content;
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await importKBFromS3(getClientId());
      if (result.entries.length > 0) {
        setEntries(prev => [...prev, ...result.entries]);
      }
    } catch (err) {
      console.error('Failed to import:', err);
      setError('Nie udalo sie zaimportowac bazy wiedzy z S3.');
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

  // Split entries
  const drafts = entries.filter(e => e.status === 'draft');
  const published = entries.filter(e => e.status === 'published');

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-3">
            <BookOpen className="text-blue-400" />
            Baza Wiedzy
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            {published.length} opublikowanych, {drafts.length} szkicow
          </p>
        </div>
        <Button
          onClick={() => handleAddDraft()}
          size="sm"
          className="gap-1.5 bg-blue-600 hover:bg-blue-700"
        >
          <Plus size={14} />
          Nowa sekcja
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

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
          {drafts.map(entry => (
            <KBSection
              key={entry.kbEntryId}
              entry={entry}
              onSave={handleSave}
              onPublish={handlePublish}
              onUnpublish={handleUnpublish}
              onDelete={handleDelete}
              onAiAssist={handleAiAssist}
              gapContext={gapContextRef.current.get(entry.kbEntryId)}
            />
          ))}
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
          {published.map(entry => (
            <KBSection
              key={entry.kbEntryId}
              entry={entry}
              onSave={handleSave}
              onPublish={handlePublish}
              onUnpublish={handleUnpublish}
              onDelete={handleDelete}
              onAiAssist={handleAiAssist}
            />
          ))}
        </div>
      )}
    </div>
  );
}
