/**
 * Conversations Page
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getClientConversations } from '@/lib/api';
import { Conversation } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

export default function ConversationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-4xl font-bold text-white">Conversations</h1>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-transparent">
        Conversations
      </h1>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      <Card className="glass-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session ID</TableHead>
              <TableHead>Messages</TableHead>
              <TableHead>Last Message</TableHead>
              <TableHead>Preview</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conversations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-zinc-500">
                  No conversations found
                </TableCell>
              </TableRow>
            ) : (
              conversations.map((conv) => (
                <TableRow
                  key={conv.session_id}
                  className="cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => router.push(`/conversations/${conv.session_id}`)}
                >
                  <TableCell className="font-mono text-sm">{conv.session_id.slice(0, 8)}...</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{conv.messages_count}</Badge>
                  </TableCell>
                  <TableCell className="text-zinc-400 text-sm">
                    {formatDistanceToNow(new Date(conv.last_message), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-zinc-400 text-sm max-w-md truncate">
                    {conv.preview}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
