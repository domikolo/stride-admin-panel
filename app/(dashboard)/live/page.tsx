/**
 * Live Conversations Page
 * Left panel: active sessions list (sorted by gap count, color-coded).
 * Right panel: selected conversation with takeover controls + live gap stats.
 */

'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getLiveSessions } from '@/lib/api';
import { getIdToken } from '@/lib/auth';
import { wsClient, WSEvent } from '@/lib/websocket';
import { LiveSession, LiveMessage } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/ui/empty-state';
import {
  Radio,
  MessageSquare,
  Send,
  PhoneCall,
  PhoneOff,
  User,
  Bot,
  UserCheck,
  Circle,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';


// ─── Client-side gap detection (mirrors backend faq/gaps.py) ────

const DONT_KNOW_PHRASES = [
  'nie wiem', 'nie jestem pewien', 'nie jestem pewna',
  'nie mam informacji', 'nie posiadam informacji',
  'nie mogę odpowiedzieć', 'nie moge odpowiedziec',
  'nie znam odpowiedzi', 'brak informacji',
  'niestety nie wiem', 'niestety nie mam',
  'nie jestem w stanie', 'nie potrafię odpowiedzieć',
  'nie mam szczegółowych informacji', 'nie mam szczegolowych informacji',
  'nie mam dokładnych informacji', 'nie mam dokladnych informacji',
  'nie dysponuję informacjami', 'nie dysponuje informacjami',
  'nie znalazłem informacji', 'nie znalazlem informacji',
  'wykracza poza moją wiedzę', 'wykracza poza moja wiedze',
  'poza zakresem mojej wiedzy',
  "i don't know", "i'm not sure", "i don't have information",
];

const HUMAN_ESCALATION_PHRASES = [
  'skontaktuj się', 'zadzwoń', 'napisz na', 'wyślij email',
  'skontaktuj się z nami', 'zadzwoń do nas', 'napisz do nas',
  'proponuję kontakt', 'polecam kontakt', 'najlepiej zadzwonić',
  'nasz konsultant', 'nasz zespół', 'nasi specjaliści',
  'umów rozmowę', 'umów spotkanie',
  'contact us', 'call us', 'email us',
];

interface GapInfo {
  count: number;
  indicators: Array<{ question: string; reason: string }>;
}

function detectGapsInMessages(msgs: LiveMessage[]): GapInfo {
  const indicators: GapInfo['indicators'] = [];

  for (let i = 0; i < msgs.length; i++) {
    const msg = msgs[i];
    // Only check bot messages (not agent messages)
    if (msg.role !== 'assistant' || msg.sentBy?.startsWith('agent:')) continue;

    const lower = msg.text.toLowerCase();

    // Find the user question before this bot response
    let question = '';
    for (let j = i - 1; j >= 0; j--) {
      if (msgs[j].role === 'user') {
        question = msgs[j].text;
        break;
      }
    }

    // Check "don't know" phrases
    const dontKnow = DONT_KNOW_PHRASES.find(p => lower.includes(p));
    if (dontKnow) {
      indicators.push({ question, reason: `Bot nie wie: "${dontKnow}"` });
      continue;
    }

    // Check escalation phrases
    const escalation = HUMAN_ESCALATION_PHRASES.find(p => lower.includes(p));
    if (escalation) {
      indicators.push({ question, reason: `Eskalacja: "${escalation}"` });
      continue;
    }

    // Short response (only for non-empty)
    if (msg.text.trim().length > 0 && msg.text.trim().length < 50) {
      indicators.push({ question, reason: `Krótka odpowiedź (${msg.text.length} zn.)` });
    }
  }

  return { count: indicators.length, indicators };
}

/**
 * Get urgency color based on gap count
 * 0 gaps = default, 1 = amber, 2+ = red
 */
function getGapColor(count: number) {
  if (count === 0) return { border: '', bg: '', text: 'text-zinc-500', badge: 'bg-zinc-500/10 text-zinc-400' };
  if (count === 1) return { border: 'border-l-amber-500/60', bg: 'bg-amber-500/[0.03]', text: 'text-amber-400', badge: 'bg-amber-500/15 text-amber-400' };
  return { border: 'border-l-red-500/60', bg: 'bg-red-500/[0.04]', text: 'text-red-400', badge: 'bg-red-500/15 text-red-400' };
}


export default function LivePage() {
  const { user } = useAuth();
  const clientId = user?.role === 'owner' ? 'stride-services' : user?.clientId || 'stride-services';

  // State
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [takenOverBy, setTakenOverBy] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  // Per-session message cache for gap detection
  const [sessionMessages, setSessionMessages] = useState<Record<string, LiveMessage[]>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get selected session object
  const selectedSession = sessions.find((s) => s.sessionId === selectedSessionId);
  const isTakenOver = !!takenOverBy;
  const isTakenOverByMe = takenOverBy === user?.email;

  // Live gap detection for current conversation
  const currentGaps = useMemo(() => detectGapsInMessages(messages), [messages]);

  // Sorted sessions: by gap count desc, then by lastActivity desc
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const gapsA = sessionMessages[a.sessionId] ? detectGapsInMessages(sessionMessages[a.sessionId]).count : 0;
      const gapsB = sessionMessages[b.sessionId] ? detectGapsInMessages(sessionMessages[b.sessionId]).count : 0;
      if (gapsB !== gapsA) return gapsB - gapsA;
      return (b.lastActivity || 0) - (a.lastActivity || 0);
    });
  }, [sessions, sessionMessages]);

  // ─── Load sessions via REST ──────────────────────────────────

  const loadSessions = useCallback(async () => {
    try {
      const data = await getLiveSessions(clientId);
      setSessions(data.sessions);
    } catch (err) {
      console.error('Failed to load live sessions:', err);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  // ─── WebSocket setup ─────────────────────────────────────────

  useEffect(() => {
    if (!user) return;

    let cleanups: Array<() => void> = [];

    const initWs = async () => {
      const token = await getIdToken();
      if (!token) return;

      wsClient.connect(token);

      cleanups.push(
        wsClient.on('session_update', () => {
          setConnected(wsClient.isConnected);
        })
      );

      cleanups.push(
        wsClient.on('session_messages', (event: WSEvent) => {
          if (event.messages) {
            const msgs = event.messages as LiveMessage[];
            setMessages(msgs);
            setTakenOverBy(event.takenOverBy || '');
            // Cache messages for gap detection in session list
            if (event.sessionId) {
              setSessionMessages(prev => ({ ...prev, [event.sessionId as string]: msgs }));
            }
          }
        })
      );

      cleanups.push(
        wsClient.on('new_message', (event: WSEvent) => {
          if (event.message) {
            const newMsg = event.message as LiveMessage;
            setMessages((prev) => [...prev, newMsg]);
            // Update cached messages for the session
            if (event.sessionId) {
              setSessionMessages(prev => {
                const existing = prev[event.sessionId as string] || [];
                return { ...prev, [event.sessionId as string]: [...existing, newMsg] };
              });
            }
          }
          loadSessions();
        })
      );

      cleanups.push(
        wsClient.on('takeover_started', (event: WSEvent) => {
          setTakenOverBy(event.takenOverBy || '');
          setSessions((prev) =>
            prev.map((s) =>
              s.sessionId === event.sessionId
                ? { ...s, takenOverBy: event.takenOverBy || '' }
                : s
            )
          );
        })
      );

      cleanups.push(
        wsClient.on('takeover_ended', (event: WSEvent) => {
          setTakenOverBy('');
          setSessions((prev) =>
            prev.map((s) =>
              s.sessionId === event.sessionId ? { ...s, takenOverBy: undefined } : s
            )
          );
        })
      );
    };

    initWs();
    loadSessions();

    const interval = setInterval(loadSessions, 30000);

    return () => {
      cleanups.forEach((c) => c());
      clearInterval(interval);
      wsClient.disconnect();
    };
  }, [user, clientId, loadSessions]);

  // ─── Auto-scroll ─────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Session selection ────────────────────────────────────────

  const selectSession = (sessionId: string) => {
    if (selectedSessionId) {
      wsClient.unsubscribe();
    }
    setSelectedSessionId(sessionId);
    setMessages([]);
    setTakenOverBy('');
    const session = sessions.find((s) => s.sessionId === sessionId);
    wsClient.subscribe(sessionId, session?.conversationNumber);
  };

  // ─── Takeover actions ────────────────────────────────────────

  const handleTakeover = () => {
    if (selectedSessionId) {
      wsClient.takeover(selectedSessionId);
    }
  };

  const handleRelease = () => {
    if (selectedSessionId) {
      wsClient.release(selectedSessionId);
    }
  };

  // ─── Send message ────────────────────────────────────────────

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || !selectedSessionId || !selectedSession) return;
    wsClient.sendMessage(selectedSessionId, text, selectedSession.conversationNumber);
    setInputText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── Time formatting ─────────────────────────────────────────

  const formatTime = (ts: number) => {
    try {
      return formatDistanceToNow(new Date(ts * 1000), { addSuffix: true, locale: pl });
    } catch {
      return '';
    }
  };

  const formatMessageTime = (ts: number) => {
    try {
      const d = new Date(ts * 1000);
      return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // ─── Stats summary ──────────────────────────────────────────

  const totalGaps = useMemo(() => {
    return Object.values(sessionMessages).reduce((sum, msgs) => sum + detectGapsInMessages(msgs).count, 0);
  }, [sessionMessages]);

  // ─── Render ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Radio size={24} className="text-green-400" />
          <h1 className="text-2xl font-semibold text-white">Live</h1>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <div className="col-span-2">
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radio size={24} className="text-green-400" />
          <h1 className="text-2xl font-semibold text-white">Live</h1>
          <Badge
            variant="secondary"
            className={connected ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700/50 text-zinc-500'}
          >
            <Circle size={8} className={`mr-1 ${connected ? 'fill-green-400' : 'fill-zinc-500'}`} />
            {connected ? 'Połączono' : 'Rozłączono'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {totalGaps > 0 && (
            <Badge className="bg-red-500/15 text-red-400 gap-1">
              <AlertTriangle size={12} />
              {totalGaps} {totalGaps === 1 ? 'luka' : totalGaps >= 2 && totalGaps <= 4 ? 'luki' : 'luk'}
            </Badge>
          )}
          <Badge variant="secondary">{sessions.length} aktywnych</Badge>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ height: 'calc(100vh - 160px)' }}>
        {/* Sessions list */}
        <Card className="glass-card overflow-y-auto">
          {sessions.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="Brak aktywnych sesji"
              description="Sesje pojawią się gdy klienci zaczną pisać"
            />
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {sortedSessions.map((session) => {
                const sessionGaps = sessionMessages[session.sessionId]
                  ? detectGapsInMessages(sessionMessages[session.sessionId])
                  : { count: 0, indicators: [] };
                const colors = getGapColor(sessionGaps.count);

                return (
                  <button
                    key={`${session.sessionId}-${session.conversationNumber}`}
                    onClick={() => selectSession(session.sessionId)}
                    className={`w-full text-left p-4 hover:bg-white/[0.04] transition-colors border-l-2 ${selectedSessionId === session.sessionId
                        ? 'bg-blue-500/[0.08] border-l-blue-500'
                        : sessionGaps.count > 0
                          ? `${colors.bg} ${colors.border}`
                          : 'border-l-transparent'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-white font-medium truncate max-w-[60%]">
                        {session.sessionId.slice(0, 12)}...
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {formatTime(session.lastActivity)}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400 truncate">{session.firstMessagePreview || 'Nowa rozmowa'}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        #{session.conversationNumber} · {session.messageCount} wiad.
                      </Badge>
                      {session.takenOverBy && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-blue-500/20 text-blue-400">
                          <UserCheck size={10} className="mr-1" />
                          Przejęta
                        </Badge>
                      )}
                      {sessionGaps.count > 0 && (
                        <Badge className={`text-[10px] px-1.5 py-0 gap-0.5 ${colors.badge}`}>
                          <AlertTriangle size={10} />
                          {sessionGaps.count}
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Conversation panel */}
        <Card className="glass-card lg:col-span-2 flex flex-col overflow-hidden">
          {!selectedSessionId ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={MessageSquare}
                title="Wybierz sesję"
                description="Kliknij sesję z listy aby zobaczyć rozmowę na żywo"
              />
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div className="p-4 border-b border-white/[0.04] flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      {selectedSessionId.slice(0, 16)}...
                    </h2>
                    {isTakenOver && (
                      <p className="text-xs text-blue-400 mt-0.5">
                        Przejęta przez: {takenOverBy}
                      </p>
                    )}
                  </div>
                  {/* Live gap counter */}
                  {currentGaps.count > 0 && (
                    <Badge className={`gap-1 ${getGapColor(currentGaps.count).badge}`}>
                      <ShieldAlert size={12} />
                      {currentGaps.count} {currentGaps.count === 1 ? 'luka' : currentGaps.count >= 2 && currentGaps.count <= 4 ? 'luki' : 'luk'}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!isTakenOver ? (
                    <Button size="sm" onClick={handleTakeover} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                      <PhoneCall size={14} />
                      Przejmij rozmowę
                    </Button>
                  ) : isTakenOverByMe ? (
                    <Button size="sm" variant="ghost" onClick={handleRelease} className="gap-1.5 text-zinc-400 hover:text-white">
                      <PhoneOff size={14} />
                      Oddaj botowi
                    </Button>
                  ) : (
                    <Badge className="bg-blue-500/20 text-blue-400">
                      Przejęta przez innego agenta
                    </Badge>
                  )}
                </div>
              </div>

              {/* Gap details bar (if any) */}
              {currentGaps.count > 0 && (
                <div className="px-4 py-2 border-b border-white/[0.04] bg-red-500/[0.03]">
                  <div className="flex items-center gap-2 flex-wrap">
                    {currentGaps.indicators.slice(0, 3).map((gap, i) => (
                      <span key={i} className="text-[11px] text-red-400/80 bg-red-500/10 px-2 py-0.5 rounded">
                        {gap.question ? `"${gap.question.slice(0, 30)}${gap.question.length > 30 ? '...' : ''}"` : 'Odpowiedź bota'} → {gap.reason}
                      </span>
                    ))}
                    {currentGaps.count > 3 && (
                      <span className="text-[11px] text-zinc-500">+{currentGaps.count - 3} więcej</span>
                    )}
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-center text-zinc-500 text-sm py-8">Brak wiadomości</p>
                )}
                {messages.map((msg, i) => {
                  const isUser = msg.role === 'user';
                  const isAgent = msg.sentBy?.startsWith('agent:');
                  const agentName = isAgent ? msg.sentBy!.replace('agent:', '') : '';

                  // Check if this bot message is a gap
                  const isGapMessage = !isUser && !isAgent && msg.text && (() => {
                    const lower = msg.text.toLowerCase();
                    return DONT_KNOW_PHRASES.some(p => lower.includes(p))
                      || HUMAN_ESCALATION_PHRASES.some(p => lower.includes(p))
                      || (msg.text.trim().length > 0 && msg.text.trim().length < 50);
                  })();

                  return (
                    <div key={`${msg.timestamp}-${i}`} className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
                      {/* Icon */}
                      <div className="flex-shrink-0 pt-1">
                        {isUser ? (
                          <User size={16} className="text-blue-400" />
                        ) : isAgent ? (
                          <UserCheck size={16} className="text-blue-400" />
                        ) : (
                          <Bot size={16} className={isGapMessage ? 'text-red-400' : 'text-zinc-500'} />
                        )}
                      </div>

                      {/* Bubble */}
                      <div className={`max-w-[75%] ${isUser ? 'ml-auto' : 'mr-auto'}`}>
                        {isAgent && (
                          <span className="text-[10px] text-blue-400 font-medium mb-0.5 block">
                            {agentName}
                          </span>
                        )}
                        <div
                          className={`px-3 py-2 rounded-xl text-sm ${isUser
                              ? 'bg-blue-500/10 rounded-tr-sm text-zinc-300'
                              : isAgent
                                ? 'bg-blue-600/20 rounded-tl-sm text-zinc-200 border border-blue-500/20'
                                : isGapMessage
                                  ? 'bg-red-500/[0.06] rounded-tl-sm text-zinc-300 border border-red-500/15'
                                  : 'bg-white/[0.04] rounded-tl-sm text-zinc-300'
                            }`}
                        >
                          {msg.text}
                        </div>
                        <div className={`flex items-center gap-1.5 mt-1 ${isUser ? 'justify-end' : ''}`}>
                          <span className="text-[10px] text-zinc-600">{formatMessageTime(msg.timestamp)}</span>
                          {isGapMessage && (
                            <span className="text-[10px] text-red-400/60 flex items-center gap-0.5">
                              <AlertTriangle size={8} /> luka
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input (only when taken over by me) */}
              {isTakenOverByMe && (
                <div className="p-3 border-t border-white/[0.04] flex-shrink-0">
                  <div className="flex gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Napisz wiadomość..."
                      className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!inputText.trim()}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 px-4"
                    >
                      <Send size={16} />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
