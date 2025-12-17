/**
 * Conversation Detail Page
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getConversationDetails } from '@/lib/api';
import { ConversationMessage } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Bot } from 'lucide-react';
import { format } from 'date-fns';

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const sessionId = params.sessionId as string;

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && sessionId) {
      loadConversation();
    }
  }, [user, sessionId]);

  const loadConversation = async () => {
    try {
      const clientId = user?.role === 'owner' ? 'stride-services' : user?.clientId || 'stride-services';
      const data = await getConversationDetails(clientId, sessionId);
      setMessages(data.messages);
      setError(null);
    } catch (error) {
      console.error('Failed to load conversation:', error);
      setError('Failed to load conversation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="text-zinc-400 hover:text-white"
        >
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-transparent">
            Conversation
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Session: {sessionId.slice(0, 12)}...</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Messages */}
      <div className="space-y-4">
        {messages.length === 0 ? (
          <Card className="glass-card p-8 text-center text-zinc-500">
            No messages found in this conversation
          </Card>
        ) : (
          messages.map((message, index) => (
            <Card
              key={index}
              className={`glass-card p-6 ${
                message.role === 'user' ? 'border-blue-500/20' : 'border-purple-500/20'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    message.role === 'user'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-purple-500/20 text-purple-400'
                  }`}
                >
                  {message.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                </div>

                {/* Message content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-white capitalize">
                      {message.role}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {format(new Date(message.timestamp), 'PPp')}
                    </span>
                  </div>
                  <p className="text-zinc-300 whitespace-pre-wrap break-words">
                    {message.text}
                  </p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
