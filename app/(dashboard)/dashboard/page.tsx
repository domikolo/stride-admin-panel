/**
 * Dashboard Page - AI Hub
 * Central dashboard with AI briefing, chat assistant, and quick insights
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
  getDailyBriefing
} from '@/lib/api';
import { ClientStats, DailyStat, Topic, Activity, DailyBriefing } from '@/lib/types';
import StatsCard from '@/components/dashboard/StatsCard';
import AIDailyBriefing from '@/components/dashboard/AIDailyBriefing';
import AIChatAssistant from '@/components/dashboard/AIChatAssistant';
import InsightsPreview from '@/components/dashboard/InsightsPreview';
import RecentActivityFeed from '@/components/dashboard/RecentActivityFeed';
import { MessageSquare, DollarSign, AlertTriangle, Flame, ArrowRight, Calendar as CalendarIcon, Lightbulb } from 'lucide-react';
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

      // Parallel data fetching
      const [statsData, dailyData, topicsData, gapsData, activityData, briefingData] = await Promise.all([
        getClientStats(clientId, 'MONTHLY').catch(() => null),
        getClientDailyStats(clientId, 7).catch(() => ({ daily_stats: [] })),
        getTrendingTopics(clientId, 'daily').catch(() => ({ topics: [] })),
        getGaps(clientId).catch(() => ({ gaps: [] })),
        getRecentActivity(clientId, 10).catch(() => ({ activities: [] })),
        getDailyBriefing(clientId).catch(() => null),
      ]);

      setStats(statsData);
      setDailyStats(dailyData.daily_stats);
      setTopics(topicsData.topics);
      setGapsCount(gapsData.gaps?.length || 0);
      setActivities(activityData.activities);
      setBriefing(briefingData);
      setError(null);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Nie udało się załadować danych.');
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
      <div className="space-y-6">
        <Skeleton className="h-32" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
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
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-zinc-400 mt-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            AI Hub - centralny panel zarządzania
          </p>
        </div>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Rozmowy"
          value={stats?.conversations_count || 0}
          icon={MessageSquare}
          iconColor="text-blue-400"
          description="Liczba rozmów w ostatnich 30 dniach"
        />
        <StatsCard
          title="Całkowity Koszt"
          value={`$${stats?.total_cost_usd.toFixed(2) || '0.00'}`}
          icon={DollarSign}
          iconColor="text-amber-400"
          description="Koszt AI w ostatnich 30 dniach"
        />
        <Link href="/insights?tab=gaps">
          <StatsCard
            title="Luki w KB"
            value={gapsCount}
            icon={AlertTriangle}
            iconColor={gapsCount > 0 ? "text-red-400" : "text-zinc-400"}
            description="Kliknij, aby zobaczyć brakujące odpowiedzi"
          />
        </Link>
        <StatsCard
          title="Top Pytanie"
          value={topics[0]?.topic_name || '-'}
          icon={Flame}
          iconColor="text-orange-400"
          description="Najczęściej zadawane pytanie"
        />
      </div>

      {/* Main Content: Chat + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AIChatAssistant />
        <InsightsPreview topics={topics} gapsCount={gapsCount} loading={loading} />
      </div>

      {/* Bottom Row: Activity + Chart + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <RecentActivityFeed activities={activities} loading={loading} />

        {/* Activity Chart - BarChart without animation (fixes auto-scroll) */}
        <Card className="glass-card p-4 lg:col-span-1">
          <h3 className="text-lg font-semibold text-white mb-4">Aktywność (7 dni)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="date"
                stroke="#71717a"
                tick={{ fill: '#71717a', fontSize: 10 }}
                tickFormatter={(value: string) => {
                  const date = new Date(value);
                  return `${date.getDate()}/${date.getMonth() + 1}`;
                }}
              />
              <YAxis stroke="#71717a" tick={{ fill: '#71717a', fontSize: 10 }} />
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

        {/* Quick Actions - Fitts's Law: larger touch targets */}
        <Card className="glass-card p-5">
          <h3 className="text-lg font-semibold text-white mb-5">Szybkie akcje</h3>
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
