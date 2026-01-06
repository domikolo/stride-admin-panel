/**
 * Main Dashboard Page
 */

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getClientStats, getClientDailyStats } from '@/lib/api';
import { ClientStats, DailyStat } from '@/lib/types';
import StatsCard from '@/components/dashboard/StatsCard';
import { MessageSquare, Calendar, TrendingUp, DollarSign } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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

  if (loading) {
    return (
      <div className="space-y-8">
        <h1 className="text-4xl font-bold text-white">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="text-zinc-400 mt-2">Last 30 days overview</p>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Conversations"
          value={stats?.conversations_count || 0}
          icon={MessageSquare}
          trend="up"
          change={12}
        />
        <StatsCard
          title="Appointments"
          value={stats?.appointments_created || 0}
          icon={Calendar}
          trend="up"
          change={8}
        />
        <StatsCard
          title="Conversion Rate"
          value={`${stats?.conversion_rate.toFixed(1) || 0}%`}
          icon={TrendingUp}
          trend="neutral"
        />
        <StatsCard
          title="Total Cost"
          value={`$${stats?.total_cost_usd.toFixed(2) || '0.00'}`}
          icon={DollarSign}
          trend="down"
          change={-5}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart - Conversations Over Time */}
        <Card className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Activity Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="date"
                stroke="#71717a"
                tick={{ fill: '#71717a' }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis stroke="#71717a" tick={{ fill: '#71717a' }} />
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
                dot={{ fill: '#3b82f6' }}
                name="Conversations"
              />
              <Line
                type="monotone"
                dataKey="appointments"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ fill: '#8b5cf6' }}
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
                { name: 'Conversations', value: stats?.conversations_count || 0 },
                { name: 'Appointments', value: stats?.appointments_created || 0 },
                { name: 'Verified', value: stats?.appointments_verified || 0 },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="name" stroke="#71717a" tick={{ fill: '#71717a' }} />
              <YAxis stroke="#71717a" tick={{ fill: '#71717a' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '8px',
                  color: '#fff',
                }}
                labelStyle={{ color: '#a1a1aa' }}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
