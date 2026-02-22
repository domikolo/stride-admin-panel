/**
 * Dashboard Page
 * Central dashboard with AI briefing, stats, chart, insights, and activity
 */

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  getClientStats,
  getClientDailyStats,
  getTrendingTopics,
  getGaps,
  getRecentActivity,
  getDailyBriefing,
} from '@/lib/api';
import { ClientStats, DailyStat, Topic, Activity, DailyBriefing } from '@/lib/types';
import StatsCard from '@/components/dashboard/StatsCard';
import AIDailyBriefing from '@/components/dashboard/AIDailyBriefing';
import InsightsPreview from '@/components/dashboard/InsightsPreview';
import RecentActivityFeed from '@/components/dashboard/RecentActivityFeed';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, DollarSign, AlertTriangle, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';

export default function DashboardPage() {
  const { user } = useAuth();

  // State
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [gapsCount, setGapsCount] = useState(0);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);

  const [loading, setLoading] = useState(true);
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [briefingRefreshing, setBriefingRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getClientId = () =>
    user?.role === 'owner' ? 'stride-services' : user?.clientId || 'stride-services';

  useEffect(() => {
    if (user) {
      loadAllData();
    }
  }, [user]);

  const loadAllData = async () => {
    const clientId = getClientId();

    // Load briefing independently (slow - AI generation)
    setBriefingLoading(true);
    getDailyBriefing(clientId)
      .then((data) => setBriefing(data))
      .catch(() => setBriefing(null))
      .finally(() => setBriefingLoading(false));

    // Load everything else (fast - DB queries)
    try {
      setLoading(true);
      const [statsData, dailyData, topicsData, gapsData, activityData] = await Promise.all([
        getClientStats(clientId, 'MONTHLY').catch(() => null),
        getClientDailyStats(clientId, 7).catch(() => ({ dailyStats: [] })),
        getTrendingTopics(clientId, 'yesterday').catch(() => ({ topics: [] })),
        getGaps(clientId, 'month').catch(() => ({ gaps: [] })),
        getRecentActivity(clientId, 10).catch(() => ({ activities: [] })),
      ]);

      setStats(statsData);
      setDailyStats(dailyData.dailyStats);
      setTopics(topicsData.topics);
      setGapsCount(gapsData.gaps?.length || 0);
      setActivities(activityData.activities);
      setRefreshedAt(new Date());
      setError(null);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Nie udalo sie zaladowac danych.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshBriefing = async () => {
    try {
      setBriefingRefreshing(true);
      const clientId = getClientId();
      const data = await getDailyBriefing(clientId, true);
      setBriefing(data);
    } catch (err) {
      console.error('Failed to refresh briefing:', err);
    } finally {
      setBriefingRefreshing(false);
    }
  };

  // Build 7-day chart with all days (fill missing days with 0)
  const chartData = (() => {
    const statsMap = new Map(dailyStats.map(d => [d.date, d]));
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      // Use local date to match backend keys (avoid UTC timezone shift)
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

  if (loading) {
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Dashboard
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Przegląd aktywności i statystyk
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
          onClick={loadAllData}
          className="text-zinc-400 hover:text-white gap-2 mt-1"
        >
          <RefreshCw size={14} />
          Odśwież dane
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* AI Daily Briefing */}
      <AIDailyBriefing
        briefing={briefing}
        loading={briefingLoading}
        onRefresh={handleRefreshBriefing}
        refreshing={briefingRefreshing}
      />

      {/* Quick Stats - 3 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <StatsCard
          title="Rozmowy"
          value={stats?.conversationsCount || 0}
          icon={MessageSquare}
          iconColor="text-blue-400"
          description="Liczba rozmow w ostatnich 30 dniach"
          valueHref="/conversations"
          sparklineData={dailyStats.map(d => d.conversations)}
        />
        <StatsCard
          title="Calkowity Koszt"
          value={`$${stats?.totalCostUsd.toFixed(2) || '0.00'}`}
          icon={DollarSign}
          iconColor="text-amber-400"
          description="Koszt AI w ostatnich 30 dniach"
        />
        <StatsCard
          title="Luki w KB"
          value={gapsCount}
          icon={AlertTriangle}
          iconColor={gapsCount > 0 ? "text-red-400" : "text-zinc-400"}
          description="Luki w bazie wiedzy (30 dni)"
          valueHref="/insights?period=monthly"
        />
      </div>

      {/* 7-day Activity Chart */}
      {!loading && (
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
      )}

      {/* Main Content: Insights + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InsightsPreview topics={topics} gapsCount={gapsCount} loading={loading} />
        <RecentActivityFeed activities={activities} loading={loading} />
      </div>
    </div>
  );
}
