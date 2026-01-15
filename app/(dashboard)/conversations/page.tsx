/**
 * Conversations Page - Improved with grouping, tooltips, and better UX
 */

'use client';

import { useEffect, useState, useMemo } from 'react';
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
import { Search, MessageSquare, ChevronLeft, ChevronRight, HelpCircle, FlaskConical, Clock, CheckCircle2 } from 'lucide-react';

type FilterType = 'all' | 'today' | 'week' | 'month';

// Tooltip component for column headers
function HeaderTooltip({ children, tooltip }: { children: React.ReactNode; tooltip: string }) {
  return (
    <div className="group relative inline-flex items-center gap-1.5 cursor-help">
      {children}
      <HelpCircle size={14} className="text-zinc-500 group-hover:text-zinc-300 transition-colors" />
      <div className="absolute left-0 top-full mt-2 z-50 hidden group-hover:block">
        <div className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3 py-2 rounded-lg shadow-xl max-w-xs whitespace-normal">
          {tooltip}
        </div>
      </div>
    </div>
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

  // Filter, search, and group logic
  const groupedConversations = useMemo(() => {
    let filtered = conversations;

    // Apply date filter
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

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(conv =>
        conv.session_id.toLowerCase().includes(query) ||
        conv.preview?.toLowerCase().includes(query)
      );
    }

    // Sort: first by session_id, then by conversation_number (ascending)
    const sorted = [...filtered].sort((a, b) => {
      // Primary sort: by last_message date (newest sessions first)
      const sessionCompare = b.session_id.localeCompare(a.session_id);
      if (a.session_id !== b.session_id) {
        // For different sessions, sort by last_message descending
        return new Date(b.last_message).getTime() - new Date(a.last_message).getTime();
      }
      // Secondary sort: by conversation_number (1, 2, 3...)
      return (a.conversation_number || 1) - (b.conversation_number || 1);
    });

    // Group by session_id for visual styling
    const groups: { sessionId: string; conversations: Conversation[] }[] = [];
    let currentGroup: { sessionId: string; conversations: Conversation[] } | null = null;

    sorted.forEach(conv => {
      if (!currentGroup || currentGroup.sessionId !== conv.session_id) {
        currentGroup = { sessionId: conv.session_id, conversations: [] };
        groups.push(currentGroup);
      }
      currentGroup.conversations.push(conv);
    });

    return groups;
  }, [conversations, filter, searchQuery]);

  // Flatten for pagination
  const flatConversations = useMemo(() => {
    return groupedConversations.flatMap(group =>
      group.conversations.map((conv, idx) => ({
        ...conv,
        isFirstInGroup: idx === 0,
        isLastInGroup: idx === group.conversations.length - 1,
        groupSize: group.conversations.length
      }))
    );
  }, [groupedConversations]);

  // Pagination
  const totalPages = Math.ceil(flatConversations.length / itemsPerPage);
  const paginatedConversations = flatConversations.slice(
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
          {flatConversations.length} rozmów{flatConversations.length === 1 ? 'a' : ''}
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
        {paginatedConversations.length === 0 ? (
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
                  <TableHead>
                    <HeaderTooltip tooltip="Unikalny identyfikator sesji użytkownika. Każdy użytkownik ma swoje ID, które pozostaje takie samo między wizytami.">
                      Session/User ID
                    </HeaderTooltip>
                  </TableHead>
                  <TableHead>
                    <HeaderTooltip tooltip="Numer rozmowy w ramach jednej sesji. Jeśli użytkownik wraca po przerwie dłuższej niż 1 godzinę, zaczyna się nowa rozmowa (#2, #3, itd.)">
                      Rozmowa #
                    </HeaderTooltip>
                  </TableHead>
                  <TableHead>
                    <HeaderTooltip tooltip="Status rozmowy: Test (rozmowa testowa), In Progress (aktywna, <1h od ostatniej wiadomości), Completed (zakończona, >1h od ostatniej wiadomości)">
                      Status
                    </HeaderTooltip>
                  </TableHead>
                  <TableHead>Wiadomości</TableHead>
                  <TableHead>Data i godzina</TableHead>
                  <TableHead>Podgląd</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedConversations.map((conv) => {
                  const lastMessageDate = new Date(conv.last_message);
                  const showSessionId = conv.isFirstInGroup;
                  const minutesSinceLastMessage = differenceInMinutes(new Date(), lastMessageDate);

                  // Determine conversation status
                  const isTestConversation = conv.preview?.toLowerCase().includes('test') ||
                    conv.session_id.toLowerCase().includes('test');
                  const isInProgress = minutesSinceLastMessage < 60;

                  const getStatus = () => {
                    if (isTestConversation) {
                      return { label: 'Test', variant: 'outline' as const, icon: FlaskConical, className: 'text-zinc-400 border-zinc-600' };
                    }
                    if (isInProgress) {
                      return { label: 'In Progress', variant: 'outline' as const, icon: Clock, className: 'text-yellow-400 border-yellow-600 bg-yellow-500/10' };
                    }
                    return { label: 'Completed', variant: 'outline' as const, icon: CheckCircle2, className: 'text-green-400 border-green-600 bg-green-500/10' };
                  };
                  const status = getStatus();

                  return (
                    <TableRow
                      key={`${conv.session_id}-${conv.conversation_number}`}
                      className={`cursor-pointer hover:bg-white/5 transition-colors ${!conv.isLastInGroup && conv.groupSize > 1 ? 'border-b-0' : ''
                        } ${!conv.isFirstInGroup && conv.groupSize > 1 ? 'bg-white/[0.02]' : ''
                        }`}
                      onClick={() => router.push(`/conversations/${conv.session_id}?conversation_number=${conv.conversation_number}`)}
                    >
                      <TableCell className="font-mono text-sm">
                        {showSessionId ? (
                          <div className="flex items-center gap-2">
                            <span>{conv.session_id.slice(0, 12)}...</span>
                            {conv.groupSize > 1 && (
                              <Badge variant="outline" className="text-xs px-1.5 py-0">
                                {conv.groupSize} rozmów
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-600 pl-4">└─</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm font-bold text-white">
                        #{conv.conversation_number || 1}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className={`gap-1 ${status.className}`}>
                          <status.icon size={12} />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{conv.messages_count}</Badge>
                      </TableCell>
                      <TableCell className="text-zinc-400 text-sm">
                        <div className="flex flex-col">
                          <span>{lastMessageDate.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                          <span className="text-xs text-zinc-500">{lastMessageDate.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-zinc-400 text-sm max-w-xs truncate">
                        {conv.preview}
                      </TableCell>
                    </TableRow>
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
