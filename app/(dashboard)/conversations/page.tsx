/**
 * Conversations Page - Improved with collapsible session groups and smart sorting
 */

'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useClientId } from '@/hooks/useClientId';
import { useSWR, fetcher } from '@/lib/swr';
import { Conversation } from '@/lib/types';
import { updateConversationAnnotations } from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/ui/empty-state';
import { isToday, isThisWeek, isThisMonth, differenceInMinutes, formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Search, MessageSquare, ChevronLeft, ChevronRight, Info, FlaskConical, Clock, CheckCircle2, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight as ChevronRightIcon, RefreshCw, PenLine, Flag, X, Download, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import toast from 'react-hot-toast';

type FilterType = 'all' | 'today' | 'week' | 'month';
type SortKey = 'date' | 'messages' | 'sessionId' | 'status';
type SortDirection = 'asc' | 'desc';
type RatingFilter = 'all' | 'positive' | 'negative' | 'unrated';

// Keyword tags display
function KeywordTags({ keywords }: { keywords?: string }) {
  if (!keywords) return null;
  const tags = keywords.split(',').map(k => k.trim()).filter(Boolean);
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag, i) => (
        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
          {tag}
        </span>
      ))}
    </div>
  );
}

// Tooltip component for column headers
function HeaderTooltip({ children, tooltip }: { children: React.ReactNode; tooltip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1.5 cursor-help">
          {children}
          <Info size={14} className="text-zinc-500 hover:text-zinc-400 transition-colors" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[280px]">
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// Sortable Header Component
function SortableHeader({
  label,
  sortKey,
  currentSort,
  direction,
  onSort,
  tooltip
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  tooltip?: string;
}) {
  return (
    <TableHead>
      <div
        className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors group select-none relative"
        onClick={() => onSort(sortKey)}
      >
        {tooltip ? (
          <HeaderTooltip tooltip={tooltip}>
            {label}
          </HeaderTooltip>
        ) : (
          <span>{label}</span>
        )}
        <div className={`transition-opacity ${currentSort === sortKey ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
          {currentSort === sortKey && direction === 'asc' ? <ArrowUp size={14} /> :
            currentSort === sortKey && direction === 'desc' ? <ArrowDown size={14} /> :
              <ArrowUpDown size={14} />}
        </div>
      </div>
    </TableHead>
  );
}

// ─── Annotation Panel ─────────────────────────────────────────────────────────

interface AnnotationPanelProps {
  sessionId: string;
  clientId: string;
  initialTags: string[];
  initialNotes: string;
  initialFlagged: boolean;
  onClose: () => void;
  onSaved: (sessionId: string, tags: string[], notes: string, flagged: boolean) => void;
}

function AnnotationPanel({ sessionId, clientId, initialTags, initialNotes, initialFlagged, onClose, onSaved }: AnnotationPanelProps) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [notes, setNotes] = useState(initialNotes);
  const [flagged, setFlagged] = useState(initialFlagged);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t) && tags.length < 10) {
      setTags(prev => [...prev, t]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateConversationAnnotations(clientId, sessionId, { tags, notes, flagged });
      onSaved(sessionId, tags, notes, flagged);
      toast.success('Adnotacje zapisane');
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Nie udało się zapisać adnotacji');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[360px] bg-card border-l border-border z-50 flex flex-col shadow-2xl overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
        <div>
          <h2 className="font-semibold text-white text-[15px]">Notatki</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Prywatne — widoczne tylko w panelu</p>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors p-1 rounded-md hover:bg-white/[0.06]">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 p-4 space-y-5">
        {/* Session ID */}
        <div className="text-xs text-zinc-500 font-mono truncate">{sessionId}</div>

        {/* Flagged toggle */}
        <div>
          <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-2">Flaga</label>
          <button
            onClick={() => setFlagged(f => !f)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-sm ${
              flagged
                ? 'border-red-500/40 bg-red-500/10 text-red-400'
                : 'border-white/[0.08] bg-white/[0.02] text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Flag size={14} />
            {flagged ? 'Oflagowana' : 'Oznacz flagą'}
          </button>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Notatki</label>
          <textarea
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/20 transition-colors resize-none"
            placeholder="Dodaj notatkę..."
            rows={4}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {/* Tags */}
        <div>
          <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Tagi</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/15 text-blue-400 rounded-full text-xs">
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:text-blue-200 transition-colors">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/20 transition-colors"
              placeholder="Dodaj tag..."
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            />
            <Button size="sm" variant="ghost" onClick={addTag} className="text-zinc-400 hover:text-white px-3">
              Dodaj
            </Button>
          </div>
        </div>

        {/* Save */}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full"
        >
          {saving ? 'Zapisywanie...' : 'Zapisz adnotacje'}
        </Button>
      </div>
    </div>
  );
}

export default function ConversationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Init from URL params (persisted across refresh)
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>(() => (searchParams.get('f') as FilterType) || 'all');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>(() => (searchParams.get('r') as RatingFilter) || 'all');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [selectedAnnotationSession, setSelectedAnnotationSession] = useState<string | null>(null);
  // Local annotation overrides (after saving)
  const [annotationOverrides, setAnnotationOverrides] = useState<Record<string, { tags: string[]; notes: string; flagged: boolean }>>({});

  // Sync filter/rating to URL params
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (filter === 'all') params.delete('f'); else params.set('f', filter);
    if (ratingFilter === 'all') params.delete('r'); else params.set('r', ratingFilter);
    const qs = params.toString();
    router.replace(qs ? `/conversations?${qs}` : '/conversations', { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, ratingFilter]);

  // Escape closes annotation panel
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setSelectedAnnotationSession(null);
  }, []);
  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  const clientId = useClientId();
  const itemsPerPage = 15;

  const { data, isLoading: loading, error: swrError, mutate } = useSWR<{ conversations: Conversation[]; count: number }>(
    clientId ? `/clients/${clientId}/conversations?limit=50` : null, fetcher
  );
  const conversations = data?.conversations ?? [];
  const error = swrError ? 'Nie udało się załadować rozmów. Spróbuj ponownie.' : null;
  const refreshedAt = data ? new Date() : null;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc'); // Default to descending for new sort
    }
  };

  const toggleSession = (sessionId: string) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
    } else {
      newExpanded.add(sessionId);
    }
    setExpandedSessions(newExpanded);
  };

  // Helper to determine status
  const getConversationStatusRaw = (conv: Conversation) => {
    const lastMessageDate = new Date(conv.lastMessage);
    const minutesSinceLastMessage = differenceInMinutes(new Date(), lastMessageDate);

    if (conv.preview?.toLowerCase().includes('test') || conv.sessionId.toLowerCase().includes('test')) {
      return 'test';
    }
    if (minutesSinceLastMessage < 60) {
      return 'in_progress';
    }
    return 'completed';
  };

  // Format Status for Display
  const getStatusDisplay = (statusRaw: string) => {
    if (statusRaw === 'test') {
      return { label: 'Test', variant: 'outline' as const, icon: FlaskConical, className: 'text-zinc-400 border-zinc-600' };
    }
    if (statusRaw === 'in_progress') {
      return { label: 'W trakcie', variant: 'outline' as const, icon: Clock, className: 'text-yellow-400 border-yellow-600 bg-yellow-500/10' };
    }
    return { label: 'Zakończona', variant: 'outline' as const, icon: CheckCircle2, className: 'text-green-400 border-green-600 bg-green-500/10' };
  };

  // Filter, search, group and sort logic
  const groupData = useMemo(() => {
    let filtered = conversations;

    // 1. Apply date filter
    if (filter !== 'all') {
      filtered = filtered.filter(conv => {
        const date = new Date(conv.lastMessage);
        switch (filter) {
          case 'today': return isToday(date);
          case 'week': return isThisWeek(date);
          case 'month': return isThisMonth(date);
          default: return true;
        }
      });
    }

    // 2. Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(conv =>
        conv.sessionId.toLowerCase().includes(query) ||
        conv.keywords?.toLowerCase().includes(query) ||
        conv.preview?.toLowerCase().includes(query)
      );
    }

    // 3. Group by Session ID first
    const sessionMap = new Map<string, Conversation[]>();
    filtered.forEach(conv => {
      const existing = sessionMap.get(conv.sessionId) || [];
      existing.push(conv);
      sessionMap.set(conv.sessionId, existing);
    });

    // 4. Create Group Objects with metrics for sorting
    const groups = Array.from(sessionMap.entries()).map(([sessionId, convs]) => {
      // Basic metrics for the group
      const latestMessage = new Date(Math.max(...convs.map(c => new Date(c.lastMessage).getTime())));
      const totalMessages = convs.reduce((sum, c) => sum + c.messagesCount, 0);

      // Determine "primary" status of the group (priority: In Progress > Test > Completed)
      const statuses = convs.map(getConversationStatusRaw);
      const groupStatus = statuses.includes('in_progress') ? 'in_progress' :
        statuses.includes('test') ? 'test' : 'completed';

      // Rating — take first rated conversation in the session
      const groupRating = convs.find(c => c.rating)?.rating ?? null;

      // Sort conversations INSIDE group (always by conversation number ascending)
      const sortedConvs = [...convs].sort((a, b) => (a.conversationNumber || 1) - (b.conversationNumber || 1));

      // Annotation data (prefer local override)
      const override = annotationOverrides[sessionId];
      const firstConv = convs[0];
      const adminTags = override?.tags ?? firstConv?.adminTags ?? [];
      const adminNotes = override?.notes ?? firstConv?.adminNotes ?? '';
      const adminFlagged = override?.flagged ?? firstConv?.adminFlagged ?? false;

      return {
        sessionId,
        conversations: sortedConvs,
        metrics: {
          latestMessage,
          totalMessages,
          groupStatus,
          rating: groupRating,
        },
        adminTags,
        adminNotes,
        adminFlagged,
      };
    });

    // 5. Apply rating filter
    const ratingFiltered = ratingFilter === 'all' ? groups : groups.filter(g => {
      if (ratingFilter === 'positive') return g.metrics.rating === 'positive';
      if (ratingFilter === 'negative') return g.metrics.rating === 'negative';
      if (ratingFilter === 'unrated') return !g.metrics.rating;
      return true;
    });

    // 6. Sort the GROUPS based on selected criteria
    ratingFiltered.sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'date':
          comparison = a.metrics.latestMessage.getTime() - b.metrics.latestMessage.getTime();
          break;
        case 'messages':
          comparison = a.metrics.totalMessages - b.metrics.totalMessages;
          break;
        case 'sessionId':
          comparison = a.sessionId.localeCompare(b.sessionId);
          break;
        case 'status':
          // Custom order: In Progress > Test > Completed
          const statusOrder: Record<string, number> = { in_progress: 2, test: 1, completed: 0 };
          comparison = (statusOrder[a.metrics.groupStatus] || 0) - (statusOrder[b.metrics.groupStatus] || 0);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return ratingFiltered;
  }, [conversations, filter, searchQuery, sortKey, sortDirection, ratingFilter, annotationOverrides]);

  // CSV Export
  const exportCsv = () => {
    const rows = groupData.map(g => [
      g.sessionId,
      g.metrics.groupStatus,
      g.metrics.totalMessages,
      g.metrics.latestMessage.toISOString(),
      g.metrics.rating || '',
      g.conversations[0]?.preview || '',
      g.conversations[0]?.keywords || '',
    ]);
    const csv = [['ID Sesji', 'Status', 'Wiadomości', 'Data', 'Ocena', 'Podgląd', 'Słowa kluczowe'], ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `rozmowy-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Pagination for GROUPS (not conversations)
  const totalPages = Math.ceil(groupData.length / itemsPerPage);
  const paginatedGroups = groupData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery, ratingFilter]);


  // Find conversation data for annotation panel
  const annotationSession = selectedAnnotationSession
    ? groupData.find(g => g.sessionId === selectedAnnotationSession)
    : null;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1 max-w-md" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error && !conversations.length) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className={`space-y-4 animate-fadeIn transition-all duration-300 ${selectedAnnotationSession ? 'pr-[368px]' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-white">
            Rozmowy
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {groupData.length} sesji użytkowników • {conversations.length} rozmów
            {refreshedAt && (
              <span className="ml-2">
                · Zaktualizowano {formatDistanceToNow(refreshedAt, { addSuffix: true, locale: pl })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={exportCsv}
            disabled={groupData.length === 0}
            className="text-zinc-400 hover:text-white gap-2 mt-1"
          >
            <Download size={14} />
            Eksport CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => mutate()}
            className="text-zinc-400 hover:text-white gap-2 mt-1"
          >
            <RefreshCw size={14} />
            Odśwież
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input
            type="text"
            placeholder="Szukaj po ID sesji lub treści..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/30 transition-all duration-150 text-sm"
          />
        </div>

        {/* Date Filter Buttons */}
        <div className="flex gap-1 bg-muted p-1 rounded-lg border border-border">
          {(['all', 'today', 'week', 'month'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'all' ? 'Wszystkie' : f === 'today' ? 'Dziś' : f === 'week' ? 'Ten tydzień' : 'Ten miesiąc'}
            </button>
          ))}
        </div>

        {/* Rating Filter — compact dropdown */}
        <select
          value={ratingFilter}
          onChange={e => setRatingFilter(e.target.value as RatingFilter)}
          className={`bg-muted border rounded-lg px-3 py-2 text-sm focus:outline-none cursor-pointer transition-colors appearance-none pr-8 ${
            ratingFilter !== 'all'
              ? 'border-blue-500/40 text-white'
              : 'border-border text-zinc-400'
          }`}
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
        >
          <option value="all">Ocena: wszystkie</option>
          <option value="positive">+ Pozytywne</option>
          <option value="negative">– Negatywne</option>
          <option value="unrated">Bez oceny</option>
        </select>
      </div>

      {/* Table */}
      <Card className="glass-card">
        {paginatedGroups.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Brak rozmów"
            description={searchQuery || filter !== 'all' || ratingFilter !== 'all'
              ? "Spróbuj zmienić filtry lub frazę wyszukiwania"
              : "Rozmowy pojawią się tutaj gdy użytkownicy zaczną rozmawiać z chatbotem"}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader
                    label="ID Sesji"
                    sortKey="sessionId"
                    currentSort={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                    tooltip="Identyfikator urządzenia/sesji użytkownika. Jeśli w ramach jednej sesji odbyło się więcej rozmów, są one tutaj grupowane."
                  />
                  <TableHead className="w-24">
                    <HeaderTooltip tooltip="Numer rozmowy w serii. Widoczny tylko po rozwinięciu sesji. Jeśli sesja zawiera tylko jedną rozmowę, funkcja zwijania jest nieaktywna, co oznacza, że w sesji miała miejsce tylko jedna rozmowa.">
                      Rozmowa #
                    </HeaderTooltip>
                  </TableHead>
                  <SortableHeader
                    label="Status"
                    sortKey="status"
                    currentSort={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                    tooltip="Status sesji. In Progress - jeśli trwa. Test - jeśli testowa. Completed - jeśli zakończona."
                  />
                  <SortableHeader
                    label="Wiadomości"
                    sortKey="messages"
                    currentSort={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Data i godzina"
                    sortKey="date"
                    currentSort={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <TableHead className="w-16 text-center">
                    <HeaderTooltip tooltip="Ocena rozmowy wystawiona przez użytkownika w widgecie czatu.">
                      Ocena
                    </HeaderTooltip>
                  </TableHead>
                  <TableHead>Podglad</TableHead>
                  <TableHead className="w-20 text-center">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedGroups.map((group) => {
                  const isSingleSession = group.conversations.length === 1;
                  const isExpanded = isSingleSession ? false : expandedSessions.has(group.sessionId);
                  const statusDisplay = getStatusDisplay(group.metrics.groupStatus);
                  const latestDate = group.metrics.latestMessage;
                  const isAnnotationOpen = selectedAnnotationSession === group.sessionId;

                  return (
                    // Use a fragment to group the main row and expanded rows
                    <React.Fragment key={group.sessionId}>
                      {/* Parent Group Row */}
                      <TableRow
                        data-session-id={group.sessionId}
                        className={`
                          transition-colors duration-150 border-b border-white/[0.06] relative cursor-pointer hover:bg-white/[0.06]
                          ${isAnnotationOpen ? 'bg-white/[0.06]' : ''}
                        `}
                        onClick={() => {
                          if (isSingleSession) {
                            // Navigate directly to the conversation
                            const conv = group.conversations[0];
                            router.push(`/conversations/${conv.sessionId}?conversation_number=${conv.conversationNumber || 1}`);
                          } else {
                            toggleSession(group.sessionId);
                          }
                        }}
                      >
                        <TableCell className="font-mono text-sm py-2.5">
                          <div className="flex items-center gap-3">
                            {!isSingleSession ? (
                              <div className={`p-1 rounded-md transition-colors ${isExpanded ? 'bg-white/10 text-white' : 'text-zinc-500'}`}>
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRightIcon size={14} />}
                              </div>
                            ) : (
                              <div className="w-6" /> /* Spacer for alignment */
                            )}
                            <span className="font-bold text-white tracking-wide">{group.sessionId.slice(0, 16)}...</span>
                            {!isSingleSession && (
                              <Badge variant="outline" className="text-xs px-2 py-0.5 border-blue-500/30 text-blue-400 bg-blue-500/10">
                                {group.conversations.length} rozmów
                              </Badge>
                            )}
                            {group.adminFlagged && (
                              <Flag size={12} className="text-red-400 flex-shrink-0" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-zinc-600 font-mono text-xs text-center">
                          —
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusDisplay.variant} className={`gap-1 ${statusDisplay.className}`}>
                            <statusDisplay.icon size={12} />
                            {statusDisplay.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 font-medium text-zinc-300">
                            <MessageSquare size={14} className="text-zinc-500" />
                            {group.metrics.totalMessages}
                          </div>
                        </TableCell>
                        <TableCell className="text-zinc-300 text-sm font-medium">
                          <div className="flex flex-col">
                            <span>
                              {latestDate.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                            <span className="text-xs text-zinc-500">{latestDate.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {isSingleSession ? (
                            <>
                              {group.metrics.rating === 'positive' && <span title="Pozytywna ocena"><ThumbsUp size={13} className="text-emerald-400 inline-block" /></span>}
                              {group.metrics.rating === 'negative' && <span title="Negatywna ocena"><ThumbsDown size={13} className="text-red-400 inline-block" /></span>}
                              {!group.metrics.rating && <span className="text-zinc-700 text-xs">—</span>}
                            </>
                          ) : (
                            <span className="text-zinc-700 text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-500 max-w-xs">
                          {!isSingleSession ? (
                            <span className="text-zinc-600">Kliknij, aby rozwinąć...</span>
                          ) : (
                            group.conversations[0]?.keywords
                              ? <KeywordTags keywords={group.conversations[0].keywords} />
                              : <span>{group.conversations[0]?.preview || 'Kliknij, aby zobaczyć...'}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedAnnotationSession(
                              selectedAnnotationSession === group.sessionId ? null : group.sessionId
                            )}
                            className={`relative p-1.5 rounded-md transition-colors ${
                              isAnnotationOpen
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06]'
                            }`}
                            title="Notatki i adnotacje"
                          >
                            <PenLine size={14} />
                            {(group.adminNotes || group.adminTags.length > 0) && (
                              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
                            )}
                          </button>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Child Rows */}
                      {isExpanded && group.conversations.map((conv, idx) => {
                        const convDate = new Date(conv.lastMessage);
                        const isLast = idx === group.conversations.length - 1;

                        return (
                          <TableRow
                            key={`${conv.sessionId}-${conv.conversationNumber}`}
                            className={`bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer border-l-2 border-l-blue-500/30 ${isLast ? 'border-b-2 border-b-white/[0.04]' : 'border-b-0'}`}
                            style={{ animation: `slideIn ${100 + idx * 50}ms ease-out` }}
                            onClick={() => router.push(`/conversations/${conv.sessionId}?conversation_number=${conv.conversationNumber}`)}
                          >
                            <TableCell className="py-2">
                              <div className="flex items-center pl-10">
                                <div className="w-5 h-5 flex items-center justify-center border-l border-b border-zinc-700/50 rounded-bl-md mr-3"></div>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm text-zinc-300 text-center font-bold">
                              #{conv.conversationNumber || 1}
                            </TableCell>
                            <TableCell></TableCell> {/* No status for individual sub-convs in this view to keep it clean, or could add */}
                            <TableCell className="text-sm text-zinc-400 pl-4">
                              {conv.messagesCount}
                            </TableCell>
                            <TableCell className="text-sm text-zinc-400">
                              <div className="flex flex-col">
                                <span>{convDate.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                <span className="text-xs text-zinc-600">{convDate.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {conv.rating === 'positive' && <span title="Pozytywna ocena"><ThumbsUp size={13} className="text-emerald-400 inline-block" /></span>}
                              {conv.rating === 'negative' && <span title="Negatywna ocena"><ThumbsDown size={13} className="text-red-400 inline-block" /></span>}
                              {!conv.rating && <span className="text-zinc-700 text-xs">—</span>}
                            </TableCell>
                            <TableCell className="text-sm text-zinc-400 max-w-xs">
                              {conv.keywords
                                ? <KeywordTags keywords={conv.keywords} />
                                : <span className="truncate block">{conv.preview}</span>
                              }
                            </TableCell>
                            <TableCell />
                          </TableRow>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-2.5 border-t border-white/5">
                <span className="text-sm text-zinc-400">
                  Strona {currentPage} z {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="text-zinc-400"
                  >
                    <ChevronLeft size={16} />
                    Poprzednia
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="text-zinc-400"
                  >
                    Następna
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Annotation Panel */}
      {selectedAnnotationSession && annotationSession && clientId && (
        <AnnotationPanel
          sessionId={selectedAnnotationSession}
          clientId={clientId}
          initialTags={annotationSession.adminTags}
          initialNotes={annotationSession.adminNotes}
          initialFlagged={annotationSession.adminFlagged}
          onClose={() => setSelectedAnnotationSession(null)}
          onSaved={(sid, tags, notes, flagged) => {
            setAnnotationOverrides(prev => ({ ...prev, [sid]: { tags, notes, flagged } }));
          }}
        />
      )}
    </div>
  );
}
