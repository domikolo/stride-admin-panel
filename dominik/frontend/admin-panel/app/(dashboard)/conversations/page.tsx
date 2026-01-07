/**
 * Conversations Page - Improved with search, filters, status badges
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
import { formatDistanceToNow, isToday, isThisWeek, isThisMonth } from 'date-fns';
import { Search, MessageSquare, Filter, ChevronLeft, ChevronRight, Target, AlertCircle } from 'lucide-react';

type FilterType = 'all' | 'today' | 'week' | 'month';

export default function ConversationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  // Filter and search logic
  const filteredConversations = useMemo(() => {
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

    return filtered;
  }, [conversations, filter, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredConversations.length / itemsPerPage);
  const paginatedConversations = filteredConversations.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery]);

  // Get conversation status (mock - you'd get this from API in real scenario)
  const getConversationStatus = (conv: Conversation) => {
    // This is a simple heuristic - in production you'd have actual data
    if (conv.messages_count > 8) {
      return { label: 'Converted', variant: 'default' as const, icon: Target };
    }
    if (conv.messages_count < 3) {
      return { label: 'Short', variant: 'secondary' as const, icon: AlertCircle };
    }
    return { label: 'Active', variant: 'outline' as const, icon: MessageSquare };
  };

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
          Conversations
        </h1>
        <p className="text-zinc-400 mt-1">
          {filteredConversations.length} conversation{filteredConversations.length !== 1 ? 's' : ''} found
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
            placeholder="Search by session ID or content..."
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
              {f === 'all' ? 'All' : f === 'today' ? 'Today' : f === 'week' ? 'This Week' : 'This Month'}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="glass-card">
        {paginatedConversations.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No conversations found"
            description={searchQuery || filter !== 'all'
              ? "Try adjusting your search or filters"
              : "Conversations will appear here when users interact with the chatbot"}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Messages</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Preview</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedConversations.map((conv) => {
                  const status = getConversationStatus(conv);
                  return (
                    <TableRow
                      key={conv.session_id}
                      className="cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => router.push(`/conversations/${conv.session_id}`)}
                    >
                      <TableCell className="font-mono text-sm">
                        {conv.session_id.slice(0, 12)}...
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className="gap-1">
                          <status.icon size={12} />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{conv.messages_count}</Badge>
                      </TableCell>
                      <TableCell className="text-zinc-400 text-sm">
                        {formatDistanceToNow(new Date(conv.last_message), { addSuffix: true })}
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
                  Page {currentPage} of {totalPages}
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
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="text-zinc-400"
                  >
                    Next
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
