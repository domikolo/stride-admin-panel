/**
 * Dashboard Page
 * Central dashboard with AI briefing, stats, chart, insights, and activity
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useSWR, fetcher } from '@/lib/swr';
import {
  getDailyBriefing,
} from '@/lib/api';
import { ClientStats, DailyStat, Topic, Activity, DailyBriefing } from '@/lib/types';
import StatsCard from '@/components/dashboard/StatsCard';
import AIDailyBriefing from '@/components/dashboard/AIDailyBriefing';
import InsightsPreview from '@/components/dashboard/InsightsPreview';
import RecentActivityFeed from '@/components/dashboard/RecentActivityFeed';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, DollarSign, AlertTriangle, RefreshCw, SmilePlus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';

export default function DashboardPage() {
  const { user } = useAuth();

  const clientId = user?.role === 'owner' ? 'stride-services' : user?.clientId || 'stride-services';

  // SWR hooks — null key prevents fetching until clientId is available
  const { data: stats, mutate: mutateStats } = useSWR<ClientStats>(
    clientId ? `/clients/${clientId}/stats?period=MONTHLY` : null, fetcher
  );
  const { data: dailyData, mutate: mutateDailyStats } = useSWR<{ clientId: string; dailyStats: DailyStat[]; count: number }>(
    clientId ? `/clients/${clientId}/stats/daily?days=7` : null, fetcher
  );
  const { data: topicsData, mutate: mutateTopics } = useSWR<{ topics: Topic[] }>(
    clientId ? `/clients/${clientId}/trending-topics?timeframe=yesterday` : null, fetcher
  );
  const { data: gapsData, mutate: mutateGaps } = useSWR<{ gaps: { length: number }[] }>(
    clientId ? `/clients/${clientId}/trending-topics?timeframe=month&include_gaps=true` : null, fetcher
  );
  const { data: activityData, mutate: mutateActivity } = useSWR<{ activities: Activity[] }>(
    clientId ? `/clients/${clientId}/recent-activity?limit=10` : null, fetcher
  );

  // Briefing keeps its own sessionStorage cache
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingRefreshing, setBriefingRefreshing] = useState(false);
  const [briefingIsNew, setBriefingIsNew] = useState(false);
  const [briefingLoaded, setBriefingLoaded] = useState(false);

  // Load briefing once clientId is ready
  if (clientId && !briefingLoaded && !briefingLoading) {
    setBriefingLoading(true);
    setBriefingLoaded(true);
    getDailyBriefing(clientId)
      .then(data => setBriefing(data))
      .catch(() => setBriefing(null))
      .finally(() => setBriefingLoading(false));
  }

  const handleRefreshBriefing = async () => {
    try {
      setBriefingRefreshing(true);
      const data = await getDailyBriefing(clientId, true);
      setBriefing(data);
      setBriefingIsNew(true);
    } catch (err) {
      console.error('Failed to refresh briefing:', err);
    } finally {
      setBriefingRefreshing(false);
    }
  };

  const handleRefreshAll = () => {
    mutateStats();
    mutateDailyStats();
    mutateTopics();
    mutateGaps();
    mutateActivity();
  };

  const dailyStats = dailyData?.dailyStats ?? [];
  const topics = topicsData?.topics ?? [];
  const gapsCount = (gapsData as { gaps?: unknown[] } | undefined)?.gaps?.length ?? 0;
  const activities = activityData?.activities ?? [];

  const loading = !stats && !dailyData && !topicsData && !gapsData && !activityData;

  // Build 7-day chart with all days (fill missing days with 0)
  const chartData = (() => {
    const statsMap = new Map(dailyStats.map(d => [d.date, d]));
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const stat = statsMap.get(key);
      days.push({
        label: date.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric' }),
        rozmowy: stat?.conversations ?? 0,
        wiadomosci: stat?.messages ?? 0,
      });
    }
    return days;
  })();

  if (loading && clientId) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  // Stagger variants for card grids
  const cardGridVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.05 } },
  };
  const cardItemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] as const } },
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Dashboard
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Przegląd aktywności i statystyk
            {stats && (
              <span className="ml-2">
                · Zaktualizowano {formatDistanceToNow(new Date(), { addSuffix: true, locale: pl })}
              </span>
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefreshAll}
          className="text-zinc-400 hover:text-white gap-2 mt-1"
        >
          <RefreshCw size={14} />
          Odśwież dane
        </Button>
      </div>

      {/* AI Daily Briefing */}
      <AIDailyBriefing
        briefing={briefing}
        loading={briefingLoading}
        onRefresh={handleRefreshBriefing}
        refreshing={briefingRefreshing}
        isNew={briefingIsNew}
      />

      {/* Quick Stats - 4 cards */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5"
        variants={cardGridVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={cardItemVariants}>
          <StatsCard
            title="Rozmowy"
            value={stats?.conversationsCount || 0}
            icon={MessageSquare}
            iconColor="text-blue-400"
            description="Liczba rozmow w ostatnich 30 dniach"
            valueHref="/conversations"
            sparklineData={dailyStats.map(d => d.conversations)}
          />
        </motion.div>
        <motion.div variants={cardItemVariants}>
          <StatsCard
            title="Calkowity Koszt"
            value={`$${stats?.totalCostUsd.toFixed(2) || '0.00'}`}
            icon={DollarSign}
            iconColor="text-amber-400"
            description="Koszt AI w ostatnich 30 dniach"
          />
        </motion.div>
        <motion.div variants={cardItemVariants}>
          <StatsCard
            title="Luki w KB"
            value={gapsCount}
            icon={AlertTriangle}
            iconColor={gapsCount > 0 ? "text-red-400" : "text-zinc-400"}
            description="Luki w bazie wiedzy (30 dni)"
            valueHref="/insights?period=monthly"
          />
        </motion.div>
        <motion.div variants={cardItemVariants}>
          <StatsCard
            title="Satysfakcja"
            value={stats?.satisfactionRate != null ? `${stats.satisfactionRate}%` : '—'}
            icon={SmilePlus}
            iconColor={
              stats?.satisfactionRate == null ? 'text-zinc-400'
                : stats.satisfactionRate >= 75 ? 'text-green-400'
                  : stats.satisfactionRate >= 50 ? 'text-yellow-400'
                    : 'text-red-400'
            }
            description={stats?.feedbackTotal ? `${stats.feedbackTotal} ocen (${stats.feedbackPositive} 👍 / ${stats.feedbackNegative} 👎)` : 'Brak ocen w tym okresie'}
          />
        </motion.div>
      </motion.div>

      {/* 7-day Activity Chart */}
      <Card className="glass-card p-5">
        <h3 className="text-sm font-medium text-zinc-500 mb-4">
          Aktywność — ostatnie 7 dni
        </h3>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorRozmowy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="label"
                stroke="#71717a"
                tick={{ fill: '#71717a', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <YAxis
                stroke="#71717a"
                tick={{ fill: '#71717a', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                domain={[0, 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111113',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
                labelStyle={{ color: '#a1a1aa' }}
              />
              <Area
                type="monotone"
                dataKey="rozmowy"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#colorRozmowy)"
                name="Rozmowy"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Main Content: Insights + Recent Activity */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        variants={cardGridVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={cardItemVariants}>
          <InsightsPreview topics={topics} gapsCount={gapsCount} loading={loading} />
        </motion.div>
        <motion.div variants={cardItemVariants}>
          <RecentActivityFeed activities={activities} loading={loading} />
        </motion.div>
      </motion.div>
    </div>
  );
}
