/**
 * Dashboard Page - AI Hub
 * Central dashboard with AI briefing, insights, activity, and charts
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
import { MessageSquare, DollarSign, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Dashboard
        </h1>
        <p className="text-zinc-400 mt-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          AI Hub - centralny panel zarzadzania
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* AI Daily Briefing - Hero */}
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

      {/* Main Content: Insights + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InsightsPreview topics={topics} gapsCount={gapsCount} loading={loading} />
        <RecentActivityFeed activities={activities} loading={loading} />
      </div>

      {/* Activity Chart - Full Width */}
      <Card className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-6">Aktywnosc (7 dni)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={dailyStats}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="date"
              stroke="#71717a"
              tick={{ fill: '#71717a', fontSize: 11 }}
              tickFormatter={(value: string) => {
                const date = new Date(value);
                return `${date.getDate()}/${date.getMonth() + 1}`;
              }}
            />
            <YAxis stroke="#71717a" tick={{ fill: '#71717a', fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
                color: '#fff',
              }}
            />
            <Bar
              dataKey="conversations"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
              name="Rozmowy"
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
