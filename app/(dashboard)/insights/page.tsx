/**
 * Insights Page - Trending Questions & Knowledge Gaps
 * With Daily / Weekly / Monthly period tabs, load-on-demand per tab.
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSWR, fetcher } from '@/lib/swr';
import { resolveGap } from '@/lib/api';
import { Timeframe } from '@/lib/api';
import { Topic, Gap } from '@/lib/types';
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
import { AlertTriangle, MessageSquare, TrendingUp, DollarSign, RefreshCw, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';

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

export default function InsightsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const periodParam = searchParams.get('period');
  const initialPeriod: Period = (['daily', 'weekly', 'monthly'] as const).includes(periodParam as any)
    ? (periodParam as Period)
    : 'daily';

  const [activePeriod, setActivePeriod] = useState<Period>(initialPeriod);
  const [resolvedGaps, setResolvedGaps] = useState<string[]>([]);
  const [resolvingGaps, setResolvingGaps] = useState<Set<string>>(new Set());

  const clientId = user ? (user.role === 'owner' ? 'stride-services' : (user.clientId ?? null)) : null;

  // Lazy load per tab — null key when tab is inactive
  const { data: dailyRaw, isLoading: dailyLoading, mutate: mutateDaily } = useSWR<{ topics: Topic[] }>(
    clientId && activePeriod === 'daily' ? `/clients/${clientId}/trending-topics?timeframe=yesterday&include_gaps=true` : null, fetcher
  );
  const { data: weeklyRaw, isLoading: weeklyLoading, mutate: mutateWeekly } = useSWR<{ topics: Topic[] }>(
    clientId && activePeriod === 'weekly' ? `/clients/${clientId}/trending-topics?timeframe=week&include_gaps=true` : null, fetcher
  );
  const { data: monthlyRaw, isLoading: monthlyLoading, mutate: mutateMonthly } = useSWR<{ topics: Topic[] }>(
    clientId && activePeriod === 'monthly' ? `/clients/${clientId}/trending-topics?timeframe=month&include_gaps=true` : null, fetcher
  );
  const { data: resolvedData } = useSWR<{ resolvedGapIds: string[] }>(
    clientId ? `/clients/${clientId}/gaps/resolved` : null, fetcher
  );

  useEffect(() => {
    if (resolvedData) setResolvedGaps(resolvedData.resolvedGapIds || []);
  }, [resolvedData]);

  const topicsToGaps = (topics: Topic[]): Gap[] =>
    topics.filter(t => t.isGap).map(t => ({
      topicId: t.topicId,
      topicName: t.topicName,
      count: t.count,
      questionExamples: t.questionExamples,
      gapExamples: t.gapExamples || [],
      questionSources: t.questionSources,
      gapReason: t.gapReason || '',
      suggestion: `Dodaj informacje o "${t.topicName}" do bazy wiedzy chatbota.`,
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

  const refreshedAt = dailyRaw || weeklyRaw || monthlyRaw ? new Date() : null;

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

    return (
      <div className="space-y-6">
        {isDaily && data.topics.length > 0 && data.topics[0].smartInsight && (
          <SmartInsightCard
            insight={data.topics[0].smartInsight}
            topicName={data.topics[0].topicName}
          />
        )}

        {isDaily ? (
          <motion.div
            key={`${periodKey}-topics-${data.topics.length}`}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={gridVariants}
            initial="hidden"
            animate="visible"
          >
            {data.topics.map((topic) => (
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
                  isGap={topic.isGap}
                  gapReason={topic.gapReason}
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              {data.topics.some(t => t.trend === 'up') && (
                <TopMoverCard
                  topicName={data.topics.find(t => t.trend === 'up')?.topicName || ''}
                  count={data.topics.find(t => t.trend === 'up')?.count || 0}
                  trend="up"
                />
              )}
              <WeeklyCategoryChart
                topics={data.topics}
                totalQuestions={data.summary.totalQuestions}
              />
            </div>
            <motion.div
              key={`${periodKey}-topics-${data.topics.length}`}
              className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 content-start"
              variants={gridVariants}
              initial="hidden"
              animate="visible"
            >
              {data.topics.map((topic) => (
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
                    isGap={topic.isGap}
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}

        {filteredGaps.length > 0 && (
          <>
            <div className="flex items-center gap-4 pt-4">
              <div className="h-px flex-1 bg-yellow-500/30" />
              <span className="text-sm font-medium text-yellow-400 flex items-center gap-2">
                <AlertTriangle size={14} />
                Luki w bazie wiedzy ({filteredGaps.length})
              </span>
              <div className="h-px flex-1 bg-yellow-500/30" />
            </div>
            <motion.div
              key={`${periodKey}-gaps-${filteredGaps.length}`}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
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
                    suggestion={gap.suggestion}
                    onResolve={handleResolveGap}
                    resolving={resolvingGaps.has(gap.topicId)}
                  />
                </motion.div>
              ))}
            </motion.div>
          </>
        )}
      </div>
    );
  };

  // Full skeleton only on very first load (no data loaded yet)
  const nothingLoaded = Object.values(periodData).every(d => d === null);
  if (nothingLoaded && isLoading) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Insights</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Insights</h1>
          <p className="text-sm text-zinc-500 mt-1 flex items-center gap-1.5">
            Analiza pytań i trendów użytkowników
            <Tooltip>
              <TooltipTrigger asChild>
                <Info size={13} className="text-zinc-600 hover:text-zinc-400 transition-colors cursor-help flex-shrink-0" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[300px]">
                <p>Analizowane są wyłącznie pytania użytkowników. Odpowiedzi na pytania chatbota (np. &quot;implementuję systemy CRM&quot;) oraz wiadomości niebędące pytaniami są automatycznie pomijane.</p>
              </TooltipContent>
            </Tooltip>
            {refreshedAt && (
              <span className="ml-2">
                · Zaktualizowano {formatDistanceToNow(refreshedAt, { addSuffix: true, locale: pl })}
              </span>
            )}
          </p>
        </div>
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
      </div>

      {/* Period Tabs */}
      <Tabs value={activePeriod} onValueChange={(v) => handleTabChange(v as Period)} className="w-full">
        <TabsList className="bg-[#111113] mb-4 border border-white/[0.06]">
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
    </div>
  );
}
