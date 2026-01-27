/**
 * Conversations Page - Improved with collapsible session groups and smart sorting
 */

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getClientConversations } from '@/lib/api';
import { Conversation } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/ui/empty-state';
import { isToday, isThisWeek, isThisMonth, differenceInMinutes } from 'date-fns';
import { Search, MessageSquare, ChevronLeft, ChevronRight, HelpCircle, FlaskConical, Clock, CheckCircle2, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react';

type FilterType = 'all' | 'today' | 'week' | 'month';
type SortKey = 'date' | 'messages' | 'sessionId' | 'status';
type SortDirection = 'asc' | 'desc';

// Tooltip component for column headers
function HeaderTooltip({ children, tooltip }: { children: React.ReactNode; tooltip: string }) {
  return (
    <div className="group relative inline-flex items-center gap-1.5 cursor-help">
      {children}
      <HelpCircle size={14} className="text-zinc-500 group-hover:text-zinc-300 transition-colors" />
      <div className="absolute left-0 top-full mt-2 z-50 hidden group-hover:block w-72">
        <div className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3 py-2 rounded-lg shadow-xl whitespace-normal leading-relaxed">
          {tooltip}
        </div>
      </div>
    </div>
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

export default function ConversationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  const itemsPerPage = 15;

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  const loadConversations = async () => {
    try {
      const clientId = user?.role === 'owner' ? 'stride-services' : user?.clientId || 'stride-services';
      const data = await getClientConversations(clientId);
      setConversations(data.conversations);
      setError(null);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      setError('Failed to load conversations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
    const lastMessageDate = new Date(conv.last_message);
    const minutesSinceLastMessage = differenceInMinutes(new Date(), lastMessageDate);

    if (conv.preview?.toLowerCase().includes('test') || conv.session_id.toLowerCase().includes('test')) {
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
      return { label: 'In Progress', variant: 'outline' as const, icon: Clock, className: 'text-yellow-400 border-yellow-600 bg-yellow-500/10' };
    }
    return { label: 'Completed', variant: 'outline' as const, icon: CheckCircle2, className: 'text-green-400 border-green-600 bg-green-500/10' };
  };

  // Filter, search, group and sort logic
  const groupData = useMemo(() => {
    let filtered = conversations;

    // 1. Apply date filter
    if (filter !== 'all') {
      filtered = filtered.filter(conv => {
        const date = new Date(conv.last_message);
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
        conv.session_id.toLowerCase().includes(query) ||
        conv.preview?.toLowerCase().includes(query)
      );
    }

    // 3. Group by Session ID first
    const sessionMap = new Map<string, Conversation[]>();
    filtered.forEach(conv => {
      const existing = sessionMap.get(conv.session_id) || [];
      existing.push(conv);
      sessionMap.set(conv.session_id, existing);
    });

    // 4. Create Group Objects with metrics for sorting
    const groups = Array.from(sessionMap.entries()).map(([sessionId, convs]) => {
      // Basic metrics for the group
      const latestMessage = new Date(Math.max(...convs.map(c => new Date(c.last_message).getTime())));
      const totalMessages = convs.reduce((sum, c) => sum + c.messages_count, 0);

      // Determine "primary" status of the group (priority: In Progress > Test > Completed)
      const statuses = convs.map(getConversationStatusRaw);
      const groupStatus = statuses.includes('in_progress') ? 'in_progress' :
        statuses.includes('test') ? 'test' : 'completed';

      // Sort conversations INSIDE group (always by conversation number ascending)
      const sortedConvs = [...convs].sort((a, b) => (a.conversation_number || 1) - (b.conversation_number || 1));

      return {
        sessionId,
        conversations: sortedConvs,
        metrics: {
          latestMessage,
          totalMessages,
          groupStatus
        }
      };
    });

    // 5. Sort the GROUPS based on selected criteria
    groups.sort((a, b) => {
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

    return groups;
  }, [conversations, filter, searchQuery, sortKey, sortDirection]);

  // Pagination for GROUPS (not conversations)
  const totalPages = Math.ceil(groupData.length / itemsPerPage);
  const paginatedGroups = groupData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1 max-w-md" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-transparent">
          Rozmowy
        </h1>
        <p className="text-zinc-400 mt-1">
          {groupData.length} sesji użytkowników ({conversations.length} rozmów)
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input
            type="text"
            placeholder="Szukaj po ID sesji lub treści..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2">
          {(['all', 'today', 'week', 'month'] as FilterType[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter(f)}
              className={filter === f ? '' : 'text-zinc-400 hover:text-white'}
            >
              {f === 'all' ? 'Wszystkie' : f === 'today' ? 'Dziś' : f === 'week' ? 'Ten tydzień' : 'Ten miesiąc'}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="glass-card">
        {paginatedGroups.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Brak rozmów"
            description={searchQuery || filter !== 'all'
              ? "Spróbuj zmienić filtry lub frazę wyszukiwania"
              : "Rozmowy pojawią się tutaj gdy użytkownicy zaczną rozmawiać z chatbotem"}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader
                    label="Session/User ID"
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
                  <TableHead>Podgląd</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedGroups.map((group) => {
                  const isSingleSession = group.conversations.length === 1;
                  const isExpanded = isSingleSession ? false : expandedSessions.has(group.sessionId);
                  const statusDisplay = getStatusDisplay(group.metrics.groupStatus);
                  const latestDate = group.metrics.latestMessage;

                  return (
                    // Use a fragment to group the main row and expanded rows
                    <React.Fragment key={group.sessionId}>
                      {/* Parent Group Row */}
                      <TableRow
                        className={`
                          transition-colors border-b border-white/5 relative cursor-pointer hover:bg-white/5
                        `}
                        onClick={() => {
                          if (isSingleSession) {
                            // Navigate directly to the conversation
                            const conv = group.conversations[0];
                            router.push(`/conversations/${conv.session_id}?conversation_number=${conv.conversation_number || 1}`);
                          } else {
                            toggleSession(group.sessionId);
                          }
                        }}
                      >
                        <TableCell className="font-mono text-sm py-4">
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
                          </div>
                        </TableCell>
                        <TableCell className="text-zinc-600 font-mono text-xs text-center">
                          {isSingleSession ? `#${group.conversations[0]?.conversation_number || 1}` : '—'}
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
                        <TableCell className="italic text-zinc-500 text-sm">
                          {!isSingleSession ? "Kliknij, aby rozwinąć..." : (group.conversations[0]?.preview || "Kliknij, aby zobaczyć...")}
                        </TableCell>
                      </TableRow>

                      {/* Expanded Child Rows */}
                      {isExpanded && group.conversations.map((conv, idx) => {
                        const convDate = new Date(conv.last_message);
                        const isLast = idx === group.conversations.length - 1;

                        return (
                          <TableRow
                            key={`${conv.session_id}-${conv.conversation_number}`}
                            className={`bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer ${isLast ? 'border-b-2 border-white/5' : 'border-b-0'}`}
                            onClick={() => router.push(`/conversations/${conv.session_id}?conversation_number=${conv.conversation_number}`)}
                          >
                            <TableCell className="py-2">
                              <div className="flex items-center pl-10">
                                <div className="w-5 h-5 flex items-center justify-center border-l border-b border-zinc-700/50 rounded-bl-md mr-3"></div>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm text-zinc-300 text-center font-bold">
                              #{conv.conversation_number || 1}
                            </TableCell>
                            <TableCell></TableCell> {/* No status for individual sub-convs in this view to keep it clean, or could add */}
                            <TableCell className="text-sm text-zinc-400 pl-4">
                              {conv.messages_count}
                            </TableCell>
                            <TableCell className="text-sm text-zinc-400">
                              <div className="flex flex-col">
                                <span>{convDate.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                <span className="text-xs text-zinc-600">{convDate.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-zinc-400 max-w-xs truncate">
                              {conv.preview}
                            </TableCell>
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
              <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
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
    </div>
  );
}
