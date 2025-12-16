/**
 * Main Dashboard Page
 */

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getClientStats } from '@/lib/api';
import { ClientStats } from '@/lib/types';
import StatsCard from '@/components/dashboard/StatsCard';
import { MessageSquare, Calendar, TrendingUp, DollarSign } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user]);

  const loadStats = async () => {
    try {
      // For owner: show stride-services stats (MVP)
      // For client: show their own stats
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

      {/* Charts placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Conversations Over Time</h3>
          <div className="h-64 flex items-center justify-center text-zinc-500">
            Chart placeholder (Recharts LineChart)
          </div>
        </Card>
        <Card className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Conversion Funnel</h3>
          <div className="h-64 flex items-center justify-center text-zinc-500">
            Chart placeholder (Recharts BarChart)
          </div>
        </Card>
      </div>
    </div>
  );
}
