/**
 * Conversation Detail Page - Improved with chat bubbles style
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
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/ui/empty-state';
import { ArrowLeft, User, Bot, MessageSquare, Copy, Check } from 'lucide-react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import toast from 'react-hot-toast';

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const sessionId = params.sessionId as string;

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const copyConversation = () => {
    const text = messages
      .map(m => `[${m.role.toUpperCase()}]: ${m.text}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Conversation copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  // Format date header
  const formatDateHeader = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMMM d, yyyy');
  };

  // Check if we should show date header
  const shouldShowDateHeader = (message: ConversationMessage, index: number) => {
    if (index === 0) return true;
    const prevDate = new Date(messages[index - 1].timestamp);
    const currDate = new Date(message.timestamp);
    return !isSameDay(prevDate, currDate);
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
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
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
            <h1 className="text-3xl font-bold bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-transparent">
              Conversation
            </h1>
            <p className="text-sm text-zinc-400 mt-1 flex items-center gap-2">
              <span className="font-mono">{sessionId.slice(0, 16)}...</span>
              <Badge variant="secondary">{messages.length} messages</Badge>
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={copyConversation}
          className="text-zinc-400 hover:text-white gap-2"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Messages */}
      <div className="space-y-4">
        {messages.length === 0 ? (
          <Card className="glass-card">
            <EmptyState
              icon={MessageSquare}
              title="No messages found"
              description="This conversation appears to be empty"
            />
          </Card>
        ) : (
          messages.map((message, index) => (
            <div key={index}>
              {/* Date Header */}
              {shouldShowDateHeader(message, index) && (
                <div className="flex items-center gap-4 my-6">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-xs text-zinc-500 font-medium">
                    {formatDateHeader(new Date(message.timestamp))}
                  </span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
              )}

              {/* Message Bubble */}
              <div className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${message.role === 'user'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-purple-500/20 text-purple-400'
                    }`}
                >
                  {message.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>

                {/* Bubble */}
                <div
                  className={`flex-1 max-w-[80%] ${message.role === 'user' ? 'ml-auto' : 'mr-auto'
                    }`}
                >
                  <div
                    className={`px-4 py-3 rounded-2xl ${message.role === 'user'
                        ? 'bg-blue-500/10 border border-blue-500/20 rounded-tr-sm'
                        : 'bg-white/5 border border-white/10 rounded-tl-sm'
                      }`}
                  >
                    <p className="text-zinc-200 whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {message.text}
                    </p>
                  </div>
                  <p className={`text-xs text-zinc-500 mt-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                    {format(new Date(message.timestamp), 'h:mm a')}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
