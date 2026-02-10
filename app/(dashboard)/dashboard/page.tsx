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
import { MessageSquare, DollarSign, AlertTriangle, Flame, ArrowRight, Calendar as CalendarIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
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
    try {
      setLoading(true);
      const clientId = getClientId();

      const [statsData, dailyData, topicsData, gapsData, activityData, briefingData] = await Promise.all([
        getClientStats(clientId, 'MONTHLY').catch(() => null),
        getClientDailyStats(clientId, 7).catch(() => ({ dailyStats: [] })),
        getTrendingTopics(clientId, 'yesterday').catch(() => ({ topics: [] })),
        getGaps(clientId, 'month').catch(() => ({ gaps: [] })),
        getRecentActivity(clientId, 10).catch(() => ({ activities: [] })),
        getDailyBriefing(clientId).catch(() => null),
      ]);

      setStats(statsData);
      setDailyStats(dailyData.dailyStats);
      setTopics(topicsData.topics);
      setGapsCount(gapsData.gaps?.length || 0);
      setActivities(activityData.activities);
      setBriefing(briefingData);
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
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
        <h1 className="text-4xl font-bold bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-transparent">
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
        loading={loading}
        onRefresh={handleRefreshBriefing}
        refreshing={briefingRefreshing}
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
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
          valueHref="/insights?period=monthly&tab=gaps"
        />
        <StatsCard
          title="Top Pytanie"
          value={topics[0]?.topicName || '-'}
          icon={Flame}
          iconColor="text-orange-400"
          description="Najczesciej zadawane pytanie"
          valueHref="/insights?period=daily"
        />
      </div>

      {/* Main Content: Insights + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InsightsPreview topics={topics} gapsCount={gapsCount} loading={loading} />
        <RecentActivityFeed activities={activities} loading={loading} />
      </div>

      {/* Bottom Row: Chart + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Chart */}
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
                  border: '1px solid #27272a',
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

        {/* Quick Actions */}
        <Card className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Szybkie akcje</h3>
          <div className="space-y-3">
            <Link href="/conversations" className="block">
              <Button
                variant="ghost"
                className="w-full h-14 justify-between text-zinc-300 hover:text-white hover:bg-white/10 text-base px-5"
              >
                <span className="flex items-center gap-3">
                  <MessageSquare size={20} className="text-blue-400" />
                  Zobacz rozmowy
                </span>
                <ArrowRight size={20} />
              </Button>
            </Link>
            <Link href="/insights" className="block">
              <Button
                variant="ghost"
                className="w-full h-14 justify-between text-zinc-300 hover:text-white hover:bg-white/10 text-base px-5"
              >
                <span className="flex items-center gap-3">
                  <Flame size={20} className="text-orange-400" />
                  Trending Topics
                </span>
                <ArrowRight size={20} />
              </Button>
            </Link>
            <Link href="/appointments" className="block">
              <Button
                variant="ghost"
                className="w-full h-14 justify-between text-zinc-300 hover:text-white hover:bg-white/10 text-base px-5"
              >
                <span className="flex items-center gap-3">
                  <CalendarIcon size={20} className="text-purple-400" />
                  Spotkania
                </span>
                <ArrowRight size={20} />
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
