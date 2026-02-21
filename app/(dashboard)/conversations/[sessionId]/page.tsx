/**
 * Conversation Detail Page - With breadcrumb navigation
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getConversationDetails } from '@/lib/api';
import { ConversationMessage } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/ui/empty-state';
import Link from 'next/link';
import { MessageSquare, Copy, Check, ChevronRight } from 'lucide-react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import toast from 'react-hot-toast';
import { inlineMd } from '@/lib/markdown';

function renderMarkdown(text: string): React.ReactElement {
  const lines = text.split('\n');
  const elements: React.ReactElement[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let key = 0;

  const flushList = () => {
    if (!currentList) return;
    const items = currentList.items.map((item, i) => (
      <li key={i} dangerouslySetInnerHTML={{ __html: inlineMd(item) }} />
    ));
    if (currentList.type === 'ul') {
      elements.push(
        <ul key={key++} className="list-disc pl-5 my-1.5 space-y-1 text-zinc-300 marker:text-zinc-600">
          {items}
        </ul>
      );
    } else {
      elements.push(
        <ol key={key++} className="list-decimal pl-5 my-1.5 space-y-1 text-zinc-300 marker:text-zinc-500">
          {items}
        </ol>
      );
    }
    currentList = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Bullet list
    if (/^[-*]\s+/.test(trimmed)) {
      const content = trimmed.replace(/^[-*]\s+/, '');
      if (currentList?.type !== 'ul') { flushList(); currentList = { type: 'ul', items: [] }; }
      currentList!.items.push(content);
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const content = trimmed.replace(/^\d+\.\s+/, '');
      if (currentList?.type !== 'ol') { flushList(); currentList = { type: 'ol', items: [] }; }
      currentList!.items.push(content);
      continue;
    }

    flushList();

    // Empty line
    if (!trimmed) {
      elements.push(<div key={key++} className="h-2" />);
      continue;
    }

    // Paragraph
    elements.push(
      <p key={key++} dangerouslySetInnerHTML={{ __html: inlineMd(trimmed) }} />
    );
  }

  flushList();
  return <>{elements}</>;
}

export default function ConversationDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const sessionId = params.sessionId as string;
  const conversationNumber = searchParams.get('conversation_number')
    ? parseInt(searchParams.get('conversation_number')!)
    : undefined;
  const highlightText = searchParams.get('highlight');

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user && sessionId) {
      loadConversation();
    }
  }, [user, sessionId, conversationNumber]);

  // Find highlighted message index when messages load
  useEffect(() => {
    if (!highlightText || messages.length === 0) return;
    const target = highlightText.toLowerCase();
    const idx = messages.findIndex(
      (m) => m.role === 'user' && m.text.toLowerCase().includes(target)
    );
    if (idx !== -1) {
      setHighlightedIndex(idx);
    }
  }, [messages, highlightText]);

  // Scroll to highlighted message after ref is attached (next render)
  useEffect(() => {
    if (highlightedIndex === null) return;
    // Double rAF ensures the ref is attached after React re-render
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
    const timer = setTimeout(() => setHighlightedIndex(null), 2500);
    return () => clearTimeout(timer);
  }, [highlightedIndex]);

  const loadConversation = async () => {
    try {
      const clientId = user?.role === 'owner' ? 'stride-services' : user?.clientId || 'stride-services';
      const data = await getConversationDetails(clientId, sessionId, conversationNumber);
      setMessages(data.messages);
      setError(null);
    } catch (error) {
      console.error('Failed to load conversation:', error);
      setError('Nie udało się załadować rozmowy.');
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
    toast.success('Skopiowano do schowka');
    setTimeout(() => setCopied(false), 2000);
  };

  // Format date header
  const formatDateHeader = (date: Date) => {
    if (isToday(date)) return 'Dzisiaj';
    if (isYesterday(date)) return 'Wczoraj';
    return format(date, 'd MMMM yyyy');
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
      {/* Breadcrumb + Header */}
      <div className="flex items-center justify-between">
        <div>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm mb-2">
            <Link href="/conversations" className="text-zinc-400 hover:text-white transition-colors">
              Rozmowy
            </Link>
            <ChevronRight size={14} className="text-zinc-600" />
            <span className="text-zinc-400">{sessionId.slice(0, 12)}...</span>
            {conversationNumber && (
              <>
                <ChevronRight size={14} className="text-zinc-600" />
                <span className="text-zinc-300">#{conversationNumber}</span>
              </>
            )}
          </nav>

          <h1 className="text-2xl font-semibold text-white">
            Rozmowa {conversationNumber ? `#${conversationNumber}` : ''}
          </h1>
          <div className="mt-1">
            <Badge variant="secondary">{messages.length} wiadomości</Badge>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={copyConversation}
          className="text-zinc-400 hover:text-white gap-2"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Skopiowano' : 'Kopiuj'}
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
              title="Brak wiadomości"
              description="Ta rozmowa jest pusta"
            />
          </Card>
        ) : (
          messages.map((message, index) => (
            <div key={index} ref={index === highlightedIndex ? highlightRef : undefined}>
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

              {/* Message */}
              <div className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {/* Label */}
                <div className="flex-shrink-0 pt-1">
                  <span className={`text-[11px] font-medium uppercase tracking-wider ${
                    message.role === 'user' ? 'text-blue-400' : 'text-zinc-500'
                  }`}>
                    {message.role === 'user' ? 'User' : 'AI'}
                  </span>
                </div>

                {/* Bubble */}
                <div className={`flex-1 max-w-[85%] ${message.role === 'user' ? 'ml-auto' : 'mr-auto'}`}>
                  <div className={`px-4 py-3 rounded-xl transition-shadow ${
                    message.role === 'user'
                      ? 'bg-blue-500/10 rounded-tr-sm'
                      : 'bg-white/[0.04] rounded-tl-sm'
                  } ${index === highlightedIndex ? 'animate-highlight-flash' : ''}`}>
                    <div className="text-zinc-300 break-words text-sm leading-relaxed">
                      {renderMarkdown(message.text)}
                    </div>
                  </div>
                  <p className={`text-[11px] text-zinc-600 mt-1.5 ${message.role === 'user' ? 'text-right' : ''}`}>
                    {format(new Date(message.timestamp), 'HH:mm')}
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
