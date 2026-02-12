/**
 * Insights Page - Trending Questions & Knowledge Gaps
 * With Daily / Weekly / Monthly period tabs, gaps shown inline
 */

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getTrendingTopics, Timeframe, resolveGap, getResolvedGaps } from '@/lib/api';
import { Topic, Gap } from '@/lib/types';
import TrendingTopicCard from '@/components/insights/TrendingTopicCard';
import GapCard from '@/components/insights/GapCard';
import SmartInsightCard from '@/components/insights/SmartInsightCard';
import TopMoverCard from '@/components/insights/TopMoverCard';
import WeeklyCategoryChart from '@/components/insights/WeeklyCategoryChart';
import StatsCard from '@/components/dashboard/StatsCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Flame, AlertTriangle, MessageSquare, TrendingUp, Calendar, Clock } from 'lucide-react';

interface PeriodData {
  topics: Topic[];
  gaps: Gap[];
  summary: { totalTopics: number; totalQuestions: number; gapsCount: number };
}

export default function InsightsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [daily, setDaily] = useState<PeriodData>({ topics: [], gaps: [], summary: { totalTopics: 0, totalQuestions: 0, gapsCount: 0 } });
  const [weekly, setWeekly] = useState<PeriodData>({ topics: [], gaps: [], summary: { totalTopics: 0, totalQuestions: 0, gapsCount: 0 } });
  const [monthly, setMonthly] = useState<PeriodData>({ topics: [], gaps: [], summary: { totalTopics: 0, totalQuestions: 0, gapsCount: 0 } });

  const [resolvedGaps, setResolvedGaps] = useState<string[]>([]);
  const [resolvingGaps, setResolvingGaps] = useState<Set<string>>(new Set());

  const periodParam = searchParams.get('period');
  const initialPeriod = (['daily', 'weekly', 'monthly'] as const).includes(periodParam as any)
    ? (periodParam as 'daily' | 'weekly' | 'monthly')
    : 'daily';

  const [activePeriod, setActivePeriod] = useState<'daily' | 'weekly' | 'monthly'>(initialPeriod);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getClientId = () =>
    user?.role === 'owner' ? 'stride-services' : user?.clientId || 'stride-services';

  // Load resolved gaps from API
  useEffect(() => {
    if (user) {
      getResolvedGaps(getClientId())
        .then(data => setResolvedGaps(data.resolvedGapIds || []))
        .catch(() => {
          // Fallback to localStorage
          const stored = localStorage.getItem('resolvedGaps');
          if (stored) {
            try { setResolvedGaps(JSON.parse(stored)); } catch { }
          }
        });
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const topicsToGaps = (topics: Topic[]): Gap[] =>
    topics.filter(t => t.isGap).map(t => ({
      topicId: t.topicId,
      topicName: t.topicName,
      count: t.count,
      questionExamples: t.questionExamples,
      gapReason: t.gapReason || '',
      suggestion: `Dodaj informacje o "${t.topicName}" do bazy wiedzy chatbota.`
    }));

  const buildPeriodData = (data: { topics: Topic[] }): PeriodData => {
    const gaps = topicsToGaps(data.topics);
    return {
      topics: data.topics,
      gaps,
      summary: {
        totalTopics: data.topics.length,
        totalQuestions: data.topics.reduce((sum, t) => sum + t.count, 0),
        gapsCount: gaps.length,
      },
    };
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const cid = getClientId();

      const [dailyData, weeklyData, monthlyData] = await Promise.all([
        getTrendingTopics(cid, 'yesterday', true),
        getTrendingTopics(cid, 'week', true),
        getTrendingTopics(cid, 'month', true),
      ]);

      setDaily(buildPeriodData(dailyData));
      setWeekly(buildPeriodData(weeklyData));
      setMonthly(buildPeriodData(monthlyData));
      setError(null);
    } catch (err) {
      console.error('Failed to load insights:', err);
      setError('Nie udalo sie zaladowac danych. Sprobuj ponownie.');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveGap = async (topicId: string) => {
    // Optimistic update
    const previousResolved = [...resolvedGaps];
    setResolvedGaps(prev => [...prev, topicId]);
    setResolvingGaps(prev => new Set(prev).add(topicId));

    const gap = current.gaps.find(g => g.topicId === topicId);

    try {
      await resolveGap(getClientId(), topicId, gap?.topicName || '');
    } catch (err) {
      // Rollback on failure
      console.error('Failed to resolve gap:', err);
      setResolvedGaps(previousResolved);
    } finally {
      setResolvingGaps(prev => {
        const next = new Set(prev);
        next.delete(topicId);
        return next;
      });
    }
  };

  const current = activePeriod === 'daily' ? daily : activePeriod === 'weekly' ? weekly : monthly;
  const activeGaps = current.gaps.filter(gap => !resolvedGaps.includes(gap.topicId));

  // Calculate top buying intent for current period
  const topBuyingTopic = [...current.topics]
    .sort((a, b) => (b.intentBreakdown?.buying || 0) - (a.intentBreakdown?.buying || 0))[0];

  const renderPeriodContent = (data: PeriodData, periodKey: string) => {
    const filteredGaps = data.gaps.filter(g => !resolvedGaps.includes(g.topicId));
    const isDaily = periodKey === 'daily';

    if (data.topics.length === 0) {
      return (
        <Card className="glass-card p-8 text-center">
          <p className="text-zinc-400">
            Brak danych. Poczekaj na pierwsza analize (codziennie o 2:00 w nocy).
          </p>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        {/* Smart Insight for daily top topic */}
        {isDaily && data.topics.length > 0 && data.topics[0].smartInsight && (
          <SmartInsightCard
            insight={data.topics[0].smartInsight}
            topicName={data.topics[0].topicName}
          />
        )}

        {/* Topics */}
        {isDaily ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.topics.map((topic) => (
              <TrendingTopicCard
                key={topic.topicId}
                rank={topic.rank}
                topicName={topic.topicName}
                count={topic.count}
                totalQuestions={data.summary.totalQuestions}
                examples={topic.questionExamples}
                trend={topic.trend}
                intentBreakdown={topic.intentBreakdown}
                isGap={topic.isGap}
                gapReason={topic.gapReason}
              />
            ))}
          </div>
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
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 content-start">
              {data.topics.map((topic) => (
                <TrendingTopicCard
                  key={topic.topicId}
                  rank={topic.rank}
                  topicName={topic.topicName}
                  count={topic.count}
                  totalQuestions={data.summary.totalQuestions}
                  examples={topic.questionExamples}
                  trend={topic.trend}
                  intentBreakdown={topic.intentBreakdown}
                  isGap={topic.isGap}
                />
              ))}
            </div>
          </div>
        )}

        {/* Gaps Section - Inline below topics */}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredGaps.map((gap) => (
                <GapCard
                  key={gap.topicId}
                  topicId={gap.topicId}
                  topicName={gap.topicName}
                  count={gap.count}
                  examples={gap.questionExamples}
                  gapReason={gap.gapReason}
                  suggestion={gap.suggestion}
                  onResolve={handleResolveGap}
                  resolving={resolvingGaps.has(gap.topicId)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <h1 className="text-4xl font-bold text-white">Insights</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-transparent flex items-center gap-3">
          <Flame className="text-orange-500" />
          Trending Questions
        </h1>
        <p className="text-zinc-400 mt-2">
          Analiza pytan uzytkownikow chatbota
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Period Tabs */}
      <Tabs value={activePeriod} onValueChange={(v) => setActivePeriod(v as any)} className="w-full">
        <TabsList className="bg-zinc-800/50 mb-6">
          <TabsTrigger value="daily" className="data-[state=active]:bg-white data-[state=active]:text-black flex items-center gap-2">
            <Clock size={16} />
            Wczoraj (24h)
          </TabsTrigger>
          <TabsTrigger value="weekly" className="data-[state=active]:bg-white data-[state=active]:text-black flex items-center gap-2">
            <Calendar size={16} />
            Tydzien (7 dni)
          </TabsTrigger>
          <TabsTrigger value="monthly" className="data-[state=active]:bg-white data-[state=active]:text-black flex items-center gap-2">
            <Calendar size={16} />
            Miesiac (30 dni)
          </TabsTrigger>
        </TabsList>

        {/* Period info */}
        <p className="text-zinc-500 text-sm mb-4">
          {activePeriod === 'daily'
            ? 'Dane z wczoraj (ostatnie pelne 24h) - Trend: zmiana vs poprzedni dzien'
            : activePeriod === 'weekly'
              ? 'Dane z ostatnich 7 dni - Trend: zmiana vs poprzedni tydzien'
              : 'Dane z ostatnich 30 dni - Trend: zmiana vs poprzedni miesiac'
          }
        </p>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <StatsCard
            title="Unikalne tematy"
            value={current.summary.totalTopics}
            icon={MessageSquare}
          />
          <StatsCard
            title="Laczne pytania"
            value={current.summary.totalQuestions}
            icon={TrendingUp}
          />
          <StatsCard
            title="Luki w bazie wiedzy"
            value={current.summary.gapsCount}
            icon={AlertTriangle}
            trend={activePeriod === 'daily' && current.summary.gapsCount > 0 ? 'down' : undefined}
          />
        </div>

        {/* Buying Intent Highlight */}
        {topBuyingTopic && topBuyingTopic.intentBreakdown?.buying > 30 && (
          <Card className="glass-card p-4 border-green-500/30 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💰</span>
              <div>
                <p className="text-white font-medium">
                  Hot Lead Alert: &quot;{topBuyingTopic.topicName}&quot;
                </p>
                <p className="text-sm text-zinc-400">
                  {topBuyingTopic.intentBreakdown.buying.toFixed(0)}% pytajacych wyraza zamiar zakupu
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Content for each period */}
        <TabsContent value="daily" className="mt-0">
          {renderPeriodContent(daily, 'daily')}
        </TabsContent>
        <TabsContent value="weekly" className="mt-0">
          {renderPeriodContent(weekly, 'weekly')}
        </TabsContent>
        <TabsContent value="monthly" className="mt-0">
          {renderPeriodContent(monthly, 'monthly')}
        </TabsContent>
      </Tabs>
    </div>
  );
}
