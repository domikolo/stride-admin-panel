/**
 * Insights Page - Trending Questions & Knowledge Gaps + Reports
 * With top-level Trendy / Raporty switcher.
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/useAuth';
import { useClientId } from '@/hooks/useClientId';
import { useSWR, fetcher } from '@/lib/swr';
import { resolveGap, generateReport, deleteReport } from '@/lib/api';
import { Timeframe } from '@/lib/api';
import { Topic, Gap, ResolvedGap, Report } from '@/lib/types';
import toast from 'react-hot-toast';
import TrendingTopicCard from '@/components/insights/TrendingTopicCard';
import GapCard from '@/components/insights/GapCard';
import SmartInsightCard from '@/components/insights/SmartInsightCard';
import TopMoverCard from '@/components/insights/TopMoverCard';
import WeeklyCategoryChart from '@/components/insights/WeeklyCategoryChart';
import StatsCard from '@/components/dashboard/StatsCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle, MessageSquare, TrendingUp, DollarSign, RefreshCw,
  Info, CheckCircle, ChevronDown, ChevronUp, FileText,
  Calendar, Users, Phone, Mail, Trash2,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';

const ReportDownloadButton = dynamic(
  () => import('@/components/reports/ReportDownloadButton'),
  {
    ssr: false,
    loading: () => (
      <button
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white/[0.06] text-zinc-500 border border-white/[0.08] cursor-not-allowed"
        disabled
      >
        Pobierz PDF
      </button>
    ),
  }
);

type MainTab = 'trendy' | 'raporty';
type Period = 'daily' | 'weekly' | 'monthly';

interface PeriodData {
  topics: Topic[];
  gaps: Gap[];
  summary: { totalTopics: number; totalQuestions: number; gapsCount: number };
}

const PERIOD_TO_TIMEFRAME: Record<Period, Timeframe> = {
  daily: 'yesterday',
  weekly: 'week',
  monthly: 'month',
};

// ─── Reports Tab ──────────────────────────────────────────────────────────────

interface ReportsTabProps {
  clientId: string | null;
  isOwner: boolean;
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
      <span className="text-xs text-zinc-400">{label}</span>
      <span className="text-xs font-medium text-white tabular-nums">{value}</span>
    </div>
  );
}

function ReportsTab({ clientId, isOwner }: ReportsTabProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [customOpen, setCustomOpen] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [customGenerating, setCustomGenerating] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'weekly' | 'monthly' | 'custom'>('all');

  const {
    data,
    isLoading,
    mutate,
  } = useSWR<{ reports: Report[]; count: number }>(
    clientId ? `/clients/${clientId}/reports` : null,
    fetcher
  );

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (reportId: string) => {
    if (!clientId || !confirm('Usunąć ten raport?')) return;
    try {
      await deleteReport(clientId, reportId);
      await mutate();
      toast.success('Raport usunięty');
    } catch {
      toast.error('Nie udało się usunąć raportu');
    }
  };

  const handleGenerateCustom = async () => {
    if (!clientId || !customStart || !customEnd) return;
    setCustomGenerating(true);
    try {
      await generateReport(clientId, 'custom', customStart, customEnd);
      await mutate();
      toast.success('Raport niestandardowy wygenerowany');
      setCustomOpen(false);
      setCustomStart('');
      setCustomEnd('');
    } catch {
      toast.error('Nie udało się wygenerować raportu');
    } finally {
      setCustomGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    );
  }

  const allReports = data?.reports ?? [];
  const reports = filterType === 'all' ? allReports : allReports.filter(r => r.reportType === filterType);

  const filterLabels: Record<typeof filterType, string> = {
    all: 'Wszystkie',
    weekly: 'Tygodniowe',
    monthly: 'Miesięczne',
    custom: 'Niestandardowe',
  };

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Filter pills */}
        <div className="flex items-center gap-1.5">
          {(['all', 'weekly', 'monthly', 'custom'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                filterType === type
                  ? 'bg-white/[0.1] text-white border border-white/[0.15]'
                  : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              {filterLabels[type]}
              {type !== 'all' && allReports.filter(r => r.reportType === type).length > 0 && (
                <span className="ml-1.5 text-zinc-600">
                  {allReports.filter(r => r.reportType === type).length}
                </span>
              )}
            </button>
          ))}
        </div>
        {/* Custom range button (owner only) */}
        {isOwner && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCustomOpen(o => !o)}
            className={`gap-1.5 text-xs border-white/[0.08] hover:bg-white/[0.06] text-zinc-300 ${customOpen ? 'bg-white/[0.08]' : 'bg-white/[0.03]'}`}
          >
            <Calendar size={13} />
            Własny zakres
          </Button>
        )}
      </div>

      {/* Custom date picker row */}
      {isOwner && customOpen && (
        <div className="flex items-center gap-3 flex-wrap p-4 glass-card rounded-xl">
          <span className="text-xs text-zinc-400">Od:</span>
          <input
            type="date"
            value={customStart}
            onChange={e => setCustomStart(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white [color-scheme:dark] focus:outline-none focus:ring-1 focus:ring-white/20"
          />
          <span className="text-xs text-zinc-400">Do:</span>
          <input
            type="date"
            value={customEnd}
            onChange={e => setCustomEnd(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white [color-scheme:dark] focus:outline-none focus:ring-1 focus:ring-white/20"
          />
          <Button
            size="sm"
            disabled={customGenerating || !customStart || !customEnd}
            onClick={handleGenerateCustom}
            className="gap-1.5 text-xs"
          >
            {customGenerating ? <RefreshCw size={12} className="animate-spin" /> : <Calendar size={12} />}
            Generuj raport
          </Button>
        </div>
      )}

      {reports.length === 0 ? (
        <Card className="glass-card p-10 text-center space-y-3">
          <FileText size={32} className="mx-auto text-zinc-600" />
          <p className="text-zinc-400 text-sm">
            {filterType === 'all'
              ? 'Brak raportów. Raporty tygodniowe i miesięczne generowane są automatycznie co poniedziałek i 1. dnia miesiąca.'
              : `Brak raportów typu „${filterLabels[filterType]}".`}
          </p>
          {filterType === 'all' && isOwner && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCustomOpen(true)}
              className="gap-2 border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-zinc-300"
            >
              <Calendar size={14} />
              Wygeneruj raport za własny zakres dat
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map(report => {
            const isOpen = expandedIds.has(report.reportId);
            const generatedDate = report.generatedAt ? new Date(report.generatedAt) : null;
            const { stats } = report;

            return (
              <Card
                key={report.reportId}
                className="glass-card overflow-hidden"
              >
                {/* Card header — always visible */}
                <div className="px-5 py-2.5 flex items-start gap-4">
                  <button
                    className="flex items-start gap-4 flex-1 text-left hover:opacity-80 transition-opacity"
                    onClick={() => toggleExpand(report.reportId)}
                  >
                    <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <FileText size={17} className="text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{report.title}</p>
                      {generatedDate && (
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Wygenerowano {formatDistanceToNow(generatedDate, { addSuffix: true, locale: pl })}
                        </p>
                      )}
                      {/* Stat chips */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] text-xs text-zinc-400 border border-white/[0.06]">
                          <MessageSquare size={10} />
                          {stats.conversationsTotal} rozmów
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] text-xs text-zinc-400 border border-white/[0.06]">
                          <Users size={10} />
                          {stats.leadsTotal} leadów
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] text-xs text-zinc-400 border border-white/[0.06]">
                          <Calendar size={10} />
                          {stats.apptsConfirmed} spotkań
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] text-xs text-zinc-400 border border-white/[0.06]">
                          <DollarSign size={10} />
                          ${stats.costTotalUsd.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 mt-1 text-zinc-500">
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>
                  {/* PDF download + delete — separate from expand click */}
                  {clientId && (
                    <div className="shrink-0 mt-1 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                      <ReportDownloadButton report={report} clientId={clientId} />
                      {isOwner && (
                        <button
                          onClick={() => handleDelete(report.reportId)}
                          className="flex items-center justify-center w-7 h-7 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Usuń raport"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Expanded content */}
                {isOpen && (
                  <div className="px-5 pb-5 border-t border-white/[0.04] pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Rozmowy */}
                      <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04]">
                        <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-2">
                          Rozmowy
                        </p>
                        <StatRow label="Łącznie" value={stats.conversationsTotal} />
                        <StatRow label="Wiadomości" value={stats.messagesTotal} />
                        <StatRow label="Śred. / rozmowę" value={stats.avgMessagesPerConv} />
                      </div>

                      {/* Leady */}
                      <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04]">
                        <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-2">
                          Leady
                        </p>
                        <StatRow label="Email" value={stats.leadsEmail} />
                        <StatRow label="Telefon" value={stats.leadsPhone} />
                        <StatRow label="Łącznie" value={stats.leadsTotal} />
                      </div>

                      {/* Spotkania */}
                      <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04]">
                        <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-2">
                          Spotkania
                        </p>
                        <StatRow label="Łącznie" value={stats.apptsTotal} />
                        <StatRow label="Potwierdzone" value={stats.apptsConfirmed} />
                        <StatRow label="Oczekujące" value={stats.apptsPending} />
                        <StatRow label="Odwołane" value={stats.apptsCancelled} />
                      </div>

                      {/* Koszty */}
                      <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04]">
                        <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-2">
                          Koszty AI
                        </p>
                        <StatRow label="Całkowity" value={`$${stats.costTotalUsd.toFixed(4)}`} />
                        <StatRow label="Na rozmowę" value={`$${stats.costPerConvUsd.toFixed(4)}`} />
                      </div>

                      {/* Oceny */}
                      <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04]">
                        <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-2">
                          Oceny rozmów
                        </p>
                        <StatRow label="Pozytywne" value={stats.ratingsPositive} />
                        <StatRow label="Negatywne" value={stats.ratingsNegative} />
                        <StatRow
                          label="Satysfakcja"
                          value={stats.satisfactionPct === -1 ? 'Brak ocen' : `${stats.satisfactionPct}%`}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const periodParam = searchParams.get('period');
  const initialPeriod: Period = (['daily', 'weekly', 'monthly'] as const).includes(periodParam as any)
    ? (periodParam as Period)
    : 'daily';

  const [mainTab, setMainTab] = useState<MainTab>('trendy');
  const [activePeriod, setActivePeriod] = useState<Period>(initialPeriod);
  const [resolvedGaps, setResolvedGaps] = useState<string[]>([]);
  const [resolvedGapHistory, setResolvedGapHistory] = useState<ResolvedGap[]>([]);
  const [resolvingGaps, setResolvingGaps] = useState<Set<string>>(new Set());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Record<Period, Date | null>>({
    daily: null, weekly: null, monthly: null,
  });

  const clientId = useClientId();
  const isOwner = user?.role === 'owner';

  // Lazy load per tab — null key when tab is inactive
  const { data: dailyRaw, isLoading: dailyLoading, mutate: mutateDaily } = useSWR<{ topics: Topic[] }>(
    clientId && mainTab === 'trendy' && activePeriod === 'daily' ? `/clients/${clientId}/trending-topics?timeframe=yesterday&include_gaps=true` : null, fetcher
  );
  const { data: weeklyRaw, isLoading: weeklyLoading, mutate: mutateWeekly } = useSWR<{ topics: Topic[] }>(
    clientId && mainTab === 'trendy' && activePeriod === 'weekly' ? `/clients/${clientId}/trending-topics?timeframe=week&include_gaps=true` : null, fetcher
  );
  const { data: monthlyRaw, isLoading: monthlyLoading, mutate: mutateMonthly } = useSWR<{ topics: Topic[] }>(
    clientId && mainTab === 'trendy' && activePeriod === 'monthly' ? `/clients/${clientId}/trending-topics?timeframe=month&include_gaps=true` : null, fetcher
  );
  const { data: resolvedData } = useSWR<{ resolvedGapIds: string[]; resolvedGaps: ResolvedGap[] }>(
    clientId ? `/clients/${clientId}/gaps/resolved` : null, fetcher
  );

  useEffect(() => {
    if (resolvedData) {
      setResolvedGaps(resolvedData.resolvedGapIds || []);
      setResolvedGapHistory(resolvedData.resolvedGaps || []);
    }
  }, [resolvedData]);

  useEffect(() => { if (dailyRaw) setRefreshedAt(prev => ({ ...prev, daily: new Date() })); }, [dailyRaw]);
  useEffect(() => { if (weeklyRaw) setRefreshedAt(prev => ({ ...prev, weekly: new Date() })); }, [weeklyRaw]);
  useEffect(() => { if (monthlyRaw) setRefreshedAt(prev => ({ ...prev, monthly: new Date() })); }, [monthlyRaw]);

  const topicsToGaps = (topics: Topic[]): Gap[] =>
    topics.filter(t => t.isGap).map(t => ({
      topicId: t.topicId,
      topicName: t.topicName,
      count: t.count,
      questionExamples: t.questionExamples,
      gapExamples: t.gapExamples || [],
      questionSources: t.questionSources,
      gapReason: t.gapReason || '',
    }));

  const buildPeriodData = (raw: { topics: Topic[] } | undefined): PeriodData | null => {
    if (!raw) return null;
    const gaps = topicsToGaps(raw.topics);
    return {
      topics: raw.topics,
      gaps,
      summary: {
        totalTopics: raw.topics.length,
        totalQuestions: raw.topics.reduce((sum, t) => sum + t.count, 0),
        gapsCount: gaps.length,
      },
    };
  };

  const periodData: Record<Period, PeriodData | null> = {
    daily: buildPeriodData(dailyRaw),
    weekly: buildPeriodData(weeklyRaw),
    monthly: buildPeriodData(monthlyRaw),
  };

  const periodLoading: Record<Period, boolean> = {
    daily: dailyLoading,
    weekly: weeklyLoading,
    monthly: monthlyLoading,
  };

  const handleTabChange = (period: Period) => {
    setActivePeriod(period);
  };

  const handleRefresh = () => {
    if (activePeriod === 'daily') mutateDaily();
    else if (activePeriod === 'weekly') mutateWeekly();
    else mutateMonthly();
  };

  const handleResolveGap = async (topicId: string) => {
    if (!clientId) return;
    const gap = current?.gaps.find(g => g.topicId === topicId);
    const topicName = gap?.topicName || '';
    const previousResolved = [...resolvedGaps];
    setResolvedGaps(prev => [...prev, topicName]);
    setResolvingGaps(prev => new Set(prev).add(topicId));

    try {
      await resolveGap(clientId, topicId, gap?.topicName || '');
      toast.success('Luka oznaczona jako naprawiona');
    } catch (err) {
      console.error('Failed to resolve gap:', err);
      setResolvedGaps(previousResolved);
      toast.error('Nie udało się zapisać zmiany');
    } finally {
      setResolvingGaps(prev => {
        const next = new Set(prev);
        next.delete(topicId);
        return next;
      });
    }
  };

  const current = periodData[activePeriod];
  const isLoading = periodLoading[activePeriod];
  const currentRefreshedAt = refreshedAt[activePeriod];
  const activeGaps = current ? current.gaps.filter(gap => !resolvedGaps.includes(gap.topicName)) : [];
  const topBuyingTopic = current
    ? [...current.topics].sort((a, b) => (b.intentBreakdown?.buying || 0) - (a.intentBreakdown?.buying || 0))[0]
    : null;

  const renderPeriodContent = (data: PeriodData | null, periodKey: string) => {
    if (!data) return null;

    const filteredGaps = data.gaps.filter(g => !resolvedGaps.includes(g.topicName));
    const isDaily = periodKey === 'daily';

    // Framer-motion stagger variants
    const gridVariants = {
      hidden: {},
      visible: { transition: { staggerChildren: 0.04 } },
    };
    const cardVariants = {
      hidden: { opacity: 0, y: 8 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] as const } },
    };

    if (data.topics.length === 0) {
      return (
        <Card className="glass-card p-8 text-center">
          <p className="text-zinc-400">
            Brak danych. Poczekaj na pierwszą analizę (codziennie o 2:00 w nocy).
          </p>
        </Card>
      );
    }

    // Topics without gaps — gaps are shown separately in the dedicated section below
    const nonGapTopics = data.topics.filter(t => !t.isGap);

    // Top mover — topic with highest count among trending up/down topics
    const upTopics = data.topics.filter(t => t.trend === 'up').sort((a, b) => b.count - a.count);
    const downTopics = data.topics.filter(t => t.trend === 'down').sort((a, b) => b.count - a.count);
    const topMover = upTopics[0] || downTopics[0] || null;
    const period = periodKey as Period;

    return (
      <div className="space-y-4">
        {isDaily && data.topics.length > 0 && data.topics[0].smartInsight && (
          <SmartInsightCard
            insight={data.topics[0].smartInsight}
            topicName={data.topics[0].topicName}
          />
        )}

        {isDaily ? (
          <>
            <motion.div
              key={`${periodKey}-topics-${data.topics.length}`}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              variants={gridVariants}
              initial="hidden"
              animate="visible"
            >
              {nonGapTopics.map((topic) => (
                <motion.div key={topic.topicId} variants={cardVariants}>
                  <TrendingTopicCard
                    rank={topic.rank}
                    topicName={topic.topicName}
                    count={topic.count}
                    totalQuestions={data.summary.totalQuestions}
                    examples={topic.questionExamples}
                    questionSources={topic.questionSources}
                    trend={topic.trend}
                    intentBreakdown={topic.intentBreakdown}
                    isGap={false}
                  />
                </motion.div>
              ))}
            </motion.div>
            <WeeklyCategoryChart
              topics={data.topics}
              totalQuestions={data.summary.totalQuestions}
              period={period}
            />
          </>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 space-y-4">
              {topMover && (
                <TopMoverCard
                  topicName={topMover.topicName}
                  count={topMover.count}
                  trend={topMover.trend as 'up' | 'down'}
                />
              )}
              <WeeklyCategoryChart
                topics={data.topics}
                totalQuestions={data.summary.totalQuestions}
                period={period}
              />
            </div>
            <motion.div
              key={`${periodKey}-topics-${data.topics.length}`}
              className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 content-start"
              variants={gridVariants}
              initial="hidden"
              animate="visible"
            >
              {nonGapTopics.map((topic) => (
                <motion.div key={topic.topicId} variants={cardVariants}>
                  <TrendingTopicCard
                    rank={topic.rank}
                    topicName={topic.topicName}
                    count={topic.count}
                    totalQuestions={data.summary.totalQuestions}
                    examples={topic.questionExamples}
                    questionSources={topic.questionSources}
                    trend={topic.trend}
                    intentBreakdown={topic.intentBreakdown}
                    isGap={false}
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}

        <div className="flex items-center gap-4 pt-4">
          <div className="h-px flex-1 bg-yellow-500/30" />
          <span className="text-sm font-medium text-yellow-400 flex items-center gap-2">
            <AlertTriangle size={14} />
            Luki w bazie wiedzy ({filteredGaps.length})
          </span>
          <div className="h-px flex-1 bg-yellow-500/30" />
        </div>

        {filteredGaps.length > 0 ? (
          <motion.div
            key={`${periodKey}-gaps-${filteredGaps.length}`}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            variants={gridVariants}
            initial="hidden"
            animate="visible"
          >
            {filteredGaps.map((gap) => (
              <motion.div key={gap.topicId} variants={cardVariants}>
                <GapCard
                  topicId={gap.topicId}
                  topicName={gap.topicName}
                  count={gap.count}
                  examples={gap.questionExamples}
                  gapExamples={gap.gapExamples}
                  questionSources={gap.questionSources}
                  gapReason={gap.gapReason}
                  onResolve={handleResolveGap}
                  resolving={resolvingGaps.has(gap.topicId)}
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <Card className="glass-card p-4 text-center border-emerald-500/10">
            <p className="text-sm text-emerald-400 font-medium">Brak luk w bazie wiedzy</p>
            <p className="text-xs text-zinc-500 mt-1">Chatbot ma odpowiedzi na wszystkie popularne pytania.</p>
          </Card>
        )}
      </div>
    );
  };

  // Full skeleton only on very first load (no data loaded yet)
  const nothingLoaded = Object.values(periodData).every(d => d === null);
  if (mainTab === 'trendy' && nothingLoaded && isLoading) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-semibold tracking-tight text-white">Insights</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-white">Insights</h1>
          <p className="text-sm text-zinc-500 mt-1 flex items-center gap-1.5">
            Analiza pytań, trendów i raporty
            {mainTab === 'trendy' && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info size={13} className="text-zinc-600 hover:text-zinc-400 transition-colors cursor-help flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[300px]">
                    <p>Analizowane są wyłącznie pytania użytkowników. Odpowiedzi na pytania chatbota (np. &quot;implementuję systemy CRM&quot;) oraz wiadomości niebędące pytaniami są automatycznie pomijane.</p>
                  </TooltipContent>
                </Tooltip>
                {currentRefreshedAt && (
                  <span className="ml-2">
                    · Zaktualizowano {formatDistanceToNow(currentRefreshedAt, { addSuffix: true, locale: pl })}
                  </span>
                )}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mainTab === 'trendy' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="text-zinc-400 hover:text-white gap-2 mt-1"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              Odśwież
            </Button>
          )}
        </div>
      </div>

      {/* Main tab switcher */}
      <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-xl border border-white/[0.06] w-fit">
        {(['trendy', 'raporty'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setMainTab(tab)}
            className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${
              mainTab === tab
                ? 'bg-white/[0.08] text-white font-medium'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {tab === 'trendy' ? 'Trendy' : 'Raporty'}
          </button>
        ))}
      </div>

      {/* ── Trendy tab ── */}
      {mainTab === 'trendy' && (
        <>
          {/* Period Tabs */}
          <Tabs value={activePeriod} onValueChange={(v) => handleTabChange(v as Period)} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="daily" className="data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-sm">
                Wczoraj
              </TabsTrigger>
              <TabsTrigger value="weekly" className="data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-sm">
                7 dni
              </TabsTrigger>
              <TabsTrigger value="monthly" className="data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-sm">
                30 dni
              </TabsTrigger>
            </TabsList>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <StatsCard
                title="Unikalne tematy"
                value={current?.summary.totalTopics || 0}
                icon={MessageSquare}
                iconColor="text-blue-400"
              />
              <StatsCard
                title="Łączne pytania"
                value={current?.summary.totalQuestions || 0}
                icon={TrendingUp}
                iconColor="text-emerald-400"
              />
              <StatsCard
                title="Luki w bazie wiedzy"
                value={activeGaps.length}
                icon={AlertTriangle}
                iconColor={activeGaps.length > 0 ? 'text-amber-400' : 'text-zinc-400'}
              />
            </div>

            {topBuyingTopic && topBuyingTopic.intentBreakdown?.buying > 30 && (
              <div className="flex items-center gap-3 p-4 glass-card border-emerald-500/20 mb-6">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <DollarSign size={18} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-white font-medium">
                    Hot Lead: &quot;{topBuyingTopic.topicName}&quot;
                  </p>
                  <p className="text-xs text-zinc-500">
                    {topBuyingTopic.intentBreakdown.buying.toFixed(0)}% pytających wyraża zamiar zakupu
                  </p>
                </div>
              </div>
            )}

            <TabsContent value="daily" className="mt-0">
              {periodLoading.daily && !periodData.daily ? (
                <div className="flex items-center justify-center py-16">
                  <RefreshCw size={20} className="animate-spin text-zinc-500" />
                </div>
              ) : renderPeriodContent(periodData.daily, 'daily')}
            </TabsContent>
            <TabsContent value="weekly" className="mt-0">
              {periodLoading.weekly && !periodData.weekly ? (
                <div className="flex items-center justify-center py-16">
                  <RefreshCw size={20} className="animate-spin text-zinc-500" />
                </div>
              ) : renderPeriodContent(periodData.weekly, 'weekly')}
            </TabsContent>
            <TabsContent value="monthly" className="mt-0">
              {periodLoading.monthly && !periodData.monthly ? (
                <div className="flex items-center justify-center py-16">
                  <RefreshCw size={20} className="animate-spin text-zinc-500" />
                </div>
              ) : renderPeriodContent(periodData.monthly, 'monthly')}
            </TabsContent>
          </Tabs>

          {/* Historia naprawionych luk */}
          {resolvedGapHistory.length > 0 && (
            <div>
              <button
                onClick={() => setHistoryOpen(o => !o)}
                className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors w-full"
              >
                <CheckCircle size={14} className="text-emerald-500/70" />
                <span>Historia naprawionych luk ({resolvedGapHistory.length})</span>
                {historyOpen ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
              </button>

              {historyOpen && (
                <Card className="glass-card mt-3 divide-y divide-white/[0.04]">
                  {resolvedGapHistory.map((rg) => {
                    const date = rg.resolvedAt
                      ? new Date(rg.resolvedAt)
                      : null;
                    return (
                      <div key={rg.topicId} className="flex items-center justify-between px-4 py-3 gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                          <span className="text-sm text-zinc-300 truncate">{rg.topicName}</span>
                        </div>
                        <div className="text-right shrink-0">
                          {date && (
                            <p className="text-xs text-zinc-500">
                              {date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          )}
                          {rg.resolvedBy && rg.resolvedBy !== 'unknown' && (
                            <p className="text-[11px] text-zinc-600">{rg.resolvedBy}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Raporty tab ── */}
      {mainTab === 'raporty' && (
        <ReportsTab clientId={clientId} isOwner={isOwner} />
      )}
    </div>
  );
}
