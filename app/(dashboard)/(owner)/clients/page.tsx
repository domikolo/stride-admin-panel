/**
 * Clients Page (Owner Only) — Clients list + Observability tab
 */

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getClients, getObservability } from '@/lib/api';
import { Client, ClientObsStats, ObservabilityData } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

type Tab = 'clients' | 'observability';
type ObsDays = 7 | 30 | 90;

const REASON_LABELS: Record<string, string> = {
  chat: 'Chat',
  briefing: 'Briefing',
  suggestion: 'Sugestia',
  score: 'Lead Score',
  kb_generate: 'KB Generate',
  kb_edit: 'KB Edit',
};

export default function ClientsPage() {
  const { user } = useAuth();

  // Clients tab
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Observability tab
  const [activeTab, setActiveTab] = useState<Tab>('clients');
  const [obsData, setObsData] = useState<ObservabilityData | null>(null);
  const [obsLoading, setObsLoading] = useState(false);
  const [obsError, setObsError] = useState<string | null>(null);
  const [obsDays, setObsDays] = useState<ObsDays>(30);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role === 'owner') {
      loadClients();
    } else if (user) {
      setError('Access denied. Owner role required.');
      setLoading(false);
    }
  }, [user]);

  const loadClients = async () => {
    try {
      const data = await getClients();
      setClients(data.clients);
      setError(null);
    } catch (err) {
      console.error('Failed to load clients:', err);
      setError('Failed to load clients. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadObservability = async (days: ObsDays) => {
    setObsLoading(true);
    setObsError(null);
    try {
      const data = await getObservability(days);
      setObsData(data);
    } catch (err) {
      console.error('Failed to load observability:', err);
      setObsError('Failed to load observability data.');
    } finally {
      setObsLoading(false);
    }
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === 'observability' && !obsData && !obsLoading) {
      loadObservability(obsDays);
    }
  };

  const handleDaysChange = (days: ObsDays) => {
    setObsDays(days);
    loadObservability(days);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-4xl font-bold text-white">Clients</h1>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (user?.role !== 'owner') {
    return (
      <div className="space-y-4">
        <h1 className="text-4xl font-bold text-white">Clients</h1>
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          Access denied. Owner role required.
        </div>
      </div>
    );
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'paused': return 'secondary';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  // Max cost for progress bars
  const maxCost = obsData && obsData.clients.length > 0
    ? Math.max(...obsData.clients.map(c => c.costUsd), 0.0001)
    : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-transparent">
          Clients
        </h1>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg border border-border w-fit">
        {(['clients', 'observability'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
              activeTab === tab
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'clients' ? 'Klienci' : 'Observability'}
          </button>
        ))}
      </div>

      {/* ── Clients tab ── */}
      {activeTab === 'clients' && (
        <>
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              {error}
            </div>
          )}
          <Card className="glass-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client ID</TableHead>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Conversations</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-zinc-500">
                      No clients found
                    </TableCell>
                  </TableRow>
                ) : (
                  clients.map((client) => (
                    <TableRow key={client.clientId}>
                      <TableCell className="font-mono text-sm">{client.clientId}</TableCell>
                      <TableCell className="font-medium">{client.companyName}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(client.status)}>
                          {client.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{client.totalConversations}</TableCell>
                      <TableCell className="text-zinc-400 text-sm">
                        {new Date(client.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {/* ── Observability tab ── */}
      {activeTab === 'observability' && (
        <div className="space-y-4">
          {/* Period selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400">Okres:</span>
            {([7, 30, 90] as ObsDays[]).map(d => (
              <button
                key={d}
                onClick={() => handleDaysChange(d)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  obsDays === d
                    ? 'bg-violet-600 text-white'
                    : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {d}d
              </button>
            ))}
            <button
              onClick={() => loadObservability(obsDays)}
              disabled={obsLoading}
              className="ml-2 px-3 py-1.5 text-sm bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
            >
              {obsLoading ? 'Ładowanie…' : '↻ Odśwież'}
            </button>
          </div>

          {obsError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {obsError}
            </div>
          )}

          {obsLoading && !obsData && (
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
              <Skeleton className="h-64" />
            </div>
          )}

          {obsData && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <SummaryCard
                  label="Total Cost"
                  value={`$${obsData.totals.costUsd.toFixed(4)}`}
                />
                <SummaryCard
                  label="Chatbot AI"
                  value={`$${obsData.totals.chatbotCostUsd.toFixed(4)}`}
                  sub="chatbot"
                />
                <SummaryCard
                  label="Admin AI"
                  value={`$${obsData.totals.adminCostUsd.toFixed(4)}`}
                  sub="suggestion+score+briefing+chat+kb"
                />
                <SummaryCard
                  label="Tokeny"
                  value={`${(obsData.totals.tokensInput / 1000).toFixed(1)}k in`}
                  sub={`${(obsData.totals.tokensOutput / 1000).toFixed(1)}k out`}
                />
                <SummaryCard
                  label="Lambda Errors"
                  value={`${obsData.totals.lambdaErrorRate.toFixed(1)}%`}
                  valueClass={obsData.totals.lambdaErrorRate > 1 ? 'text-red-400' : 'text-green-400'}
                  sub={`${obsData.totals.lambdaInvocations} inv.`}
                />
              </div>

              {/* Per-client table */}
              <Card className="glass-card overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Klient</TableHead>
                      <TableHead className="text-right">Chatbot $</TableHead>
                      <TableHead className="text-right">Admin $</TableHead>
                      <TableHead>Cost bar</TableHead>
                      <TableHead className="text-right">Tokeny</TableHead>
                      <TableHead className="text-right">Lambda Inv.</TableHead>
                      <TableHead className="text-right">Błędy %</TableHead>
                      <TableHead className="text-right">Avg ms</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {obsData.clients.map((c) => (
                      <>
                        <TableRow
                          key={c.clientId}
                          className="cursor-pointer hover:bg-white/5"
                          onClick={() =>
                            setExpandedClient(expandedClient === c.clientId ? null : c.clientId)
                          }
                        >
                          <TableCell>
                            <div className="font-medium">{c.companyName}</div>
                            <div className="text-xs text-zinc-500 font-mono">{c.clientId}</div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            ${c.chatbotCostUsd.toFixed(4)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            ${c.adminCostUsd.toFixed(4)}
                          </TableCell>
                          <TableCell className="min-w-[120px]">
                            <div className="w-full bg-white/10 rounded-full h-2">
                              <div
                                className="bg-violet-500 h-2 rounded-full"
                                style={{ width: `${(c.costUsd / maxCost) * 100}%` }}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm text-zinc-400">
                            {(c.tokensTotal / 1000).toFixed(1)}k
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {c.lambdaInvocations}
                          </TableCell>
                          <TableCell className={`text-right text-sm font-medium ${
                            c.lambdaErrorRate > 1 ? 'text-red-400' : 'text-zinc-400'
                          }`}>
                            {c.lambdaErrorRate.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right text-sm text-zinc-400">
                            {c.lambdaAvgDurationMs > 0 ? `${c.lambdaAvgDurationMs}ms` : '—'}
                          </TableCell>
                        </TableRow>

                        {/* Expanded row: cost by reason */}
                        {expandedClient === c.clientId && (
                          <TableRow key={`${c.clientId}-detail`}>
                            <TableCell colSpan={8} className="bg-white/5 py-3 px-4">
                              <div className="flex flex-col sm:flex-row gap-4">
                                {/* Per-reason */}
                                <div className="flex-1">
                                  <div className="text-xs text-zinc-400 mb-2 font-medium">Po typie wywołania:</div>
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(c.costByReason).length === 0 ? (
                                      <span className="text-xs text-zinc-500">Brak danych</span>
                                    ) : (
                                      Object.entries(c.costByReason)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([reason, cost]) => (
                                          <span key={reason} className="px-2 py-1 bg-white/10 rounded text-xs text-zinc-300">
                                            {REASON_LABELS[reason] ?? reason}: ${cost.toFixed(4)}
                                          </span>
                                        ))
                                    )}
                                  </div>
                                </div>
                                {/* Per-user */}
                                <div className="flex-1">
                                  <div className="text-xs text-zinc-400 mb-2 font-medium">Po użytkowniku:</div>
                                  <div className="flex flex-col gap-1.5">
                                    {Object.entries(c.costByUser).length === 0 ? (
                                      <span className="text-xs text-zinc-500">Brak danych</span>
                                    ) : (
                                      Object.entries(c.costByUser)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([email, cost]) => (
                                          <div key={email} className="flex items-center justify-between gap-4">
                                            <span className="text-xs text-zinc-300 font-mono">{email}</span>
                                            <span className="text-xs text-zinc-400 font-mono">${cost.toFixed(4)}</span>
                                          </div>
                                        ))
                                    )}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </Card>

              {/* Footer */}
              <p className="text-xs text-zinc-600 text-right">
                Wygenerowano: {new Date(obsData.generatedAt).toLocaleString('pl-PL')}
                {' · '}Okres: ostatnie {obsData.periodDays} dni
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  valueClass = 'text-white',
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="glass-card rounded-xl p-4 space-y-1">
      <div className="text-xs text-zinc-500 uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-bold font-mono ${valueClass}`}>{value}</div>
      {sub && <div className="text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}
