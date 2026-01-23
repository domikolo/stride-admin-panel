/**
 * Main Dashboard Page - Improved with sparklines, better layout
 */

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getClientStats, getClientDailyStats } from '@/lib/api';
import { ClientStats, DailyStat } from '@/lib/types';
import StatsCard from '@/components/dashboard/StatsCard';
import { MessageSquare, Calendar, TrendingUp, DollarSign, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import ActivityHeatmap from '@/components/dashboard/charts/ActivityHeatmap';
import ConversationLengthChart from '@/components/dashboard/charts/ConversationLengthChart';
import DropOffChart from '@/components/dashboard/charts/DropOffChart';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadStats();
      loadDailyStats();
    }
  }, [user]);

  const loadStats = async () => {
    try {
      const clientId = user?.role === 'owner' ? 'stride-services' : user?.clientId || 'stride-services';
      const data = await getClientStats(clientId, 'MONTHLY');
      setStats(data);
      setError(null);
    } catch (error) {
      console.error('Failed to load stats:', error);
      setError('Failed to load stats. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadDailyStats = async () => {
    try {
      const clientId = user?.role === 'owner' ? 'stride-services' : user?.clientId || 'stride-services';
      const data = await getClientDailyStats(clientId, 30);
      setDailyStats(data.daily_stats);
    } catch (error) {
      console.error('Failed to load daily stats:', error);
    }
  };

  // Generate sparkline data from daily stats
  const conversationSparkline = dailyStats.slice(-7).map(d => d.conversations);
  const appointmentSparkline = dailyStats.slice(-7).map(d => d.appointments);

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
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
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Last 30 days overview
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Rozmowy"
          value={stats?.conversations_count || 0}
          icon={MessageSquare}
          trend="up"
          change={12}
          sparklineData={conversationSparkline}
          iconColor="text-blue-400"
          description="Liczba wszystkich rozpoczętych konwersacji z botem w wybranym okresie."
        />
        <StatsCard
          title="Spotkania"
          value={stats?.appointments_created || 0}
          icon={Calendar}
          trend="up"
          change={8}
          sparklineData={appointmentSparkline}
          iconColor="text-purple-400"
          description="Liczba wstępnie umówionych spotkań przez bota (przed weryfikacją)."
        />
      </div>

      {/* Advanced Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Cost Per Appointment (CPA)"
          value={`$${stats?.cpa_usd?.toFixed(2) || '0.00'}`}
          icon={DollarSign}
          trend="neutral"
          iconColor="text-pink-400"
          description="Średni koszt pozyskania jednego zweryfikowanego spotkania. Obliczany jako całkowity koszt tokenów AI podzielony przez liczbę potwierdzonych spotkań."
        />
        <StatsCard
          title="Śr. czas konwersji"
          value={`${stats?.avg_time_to_conversion_min?.toFixed(1) || 0} min`}
          icon={Calendar}
          trend="down"
          sparklineData={appointmentSparkline} // Reusing sparkline as proxy for now
          iconColor="text-indigo-400"
          description="Średni czas trwania rozmowy od pierwszej wiadomości do momentu umówienia spotkania."
        />
        <StatsCard
          title="Wskaźnik Konwersji"
          value={`${stats?.conversion_rate.toFixed(1) || 0}%`}
          icon={TrendingUp}
          trend="neutral"
          iconColor="text-emerald-400"
          description="Procent rozmów, które zakończyły się sukcesem (umówieniem spotkania). Wyższy wynik oznacza lepszą skuteczność skryptu."
        />
        <StatsCard
          title="Całkowity Koszt"
          value={`$${stats?.total_cost_usd.toFixed(2) || '0.00'}`}
          icon={DollarSign}
          trend="down"
          change={-5}
          iconColor="text-amber-400"
          description="Suma kosztów tokenów (input/output) zużytych przez model AI na wszystkie rozmowy w tym okresie."
        />
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/conversations">
          <Button variant="ghost" className="text-zinc-400 hover:text-white gap-2">
            View all conversations <ArrowRight size={16} />
          </Button>
        </Link>
        <Link href="/appointments">
          <Button variant="ghost" className="text-zinc-400 hover:text-white gap-2">
            View all appointments <ArrowRight size={16} />
          </Button>
        </Link>
        <Link href="/insights">
          <Button variant="ghost" className="text-zinc-400 hover:text-white gap-2">
            View insights <ArrowRight size={16} />
          </Button>
        </Link>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart - Activity Over Time */}
        <Card className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Activity Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="date"
                stroke="#71717a"
                tick={{ fill: '#71717a', fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis stroke="#71717a" tick={{ fill: '#71717a', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '8px',
                  color: '#fff',
                }}
                labelStyle={{ color: '#a1a1aa' }}
              />
              <Legend wrapperStyle={{ color: '#a1a1aa' }} />
              <Line
                type="monotone"
                dataKey="conversations"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="Conversations"
              />
              <Line
                type="monotone"
                dataKey="appointments"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
                name="Appointments"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Bar Chart - Conversion Funnel */}
        <Card className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Conversion Funnel</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={[
                { name: 'Conversations', value: stats?.conversations_count || 0, fill: '#3b82f6' },
                { name: 'Appointments', value: stats?.appointments_created || 0, fill: '#8b5cf6' },
                { name: 'Verified', value: stats?.appointments_verified || 0, fill: '#22c55e' },
              ]}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
              <XAxis type="number" stroke="#71717a" tick={{ fill: '#71717a', fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#71717a"
                tick={{ fill: '#71717a', fontSize: 12 }}
                width={100}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '8px',
                  color: '#fff',
                }}
                labelStyle={{ color: '#a1a1aa' }}
              />
              <Bar dataKey="value" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Deep Insights Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-6 gap-6">
        {/* Heatmap takes full width on top */}
        <div className="xl:col-span-6">
          <ActivityHeatmap data={stats?.activity_heatmap} loading={loading} />
        </div>

        {/* Drop-off takes 3/6 */}
        <div className="xl:col-span-4">
          <DropOffChart data={stats?.drop_off_by_length} loading={loading} />
        </div>

        {/* Histogram takes 2/6 */}
        <div className="xl:col-span-2">
          <ConversationLengthChart data={stats?.conversation_length_histogram} loading={loading} />
        </div>
      </div>
    </div>
  );
}
