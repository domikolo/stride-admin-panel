/**
 * Appointments Page - With Analytics Section
 * Contains appointment management + analytics moved from dashboard
 */

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getClientAppointments, getClientStats } from '@/lib/api';
import { Appointment, ClientStats } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/ui/empty-state';
import StatsCard from '@/components/dashboard/StatsCard';
import ActivityHeatmap from '@/components/dashboard/charts/ActivityHeatmap';
import ConversationLengthChart from '@/components/dashboard/charts/ConversationLengthChart';
import DropOffChart from '@/components/dashboard/charts/DropOffChart';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, getDay } from 'date-fns';
import { Calendar, List, ChevronLeft, ChevronRight, Clock, User, Phone, Mail, ExternalLink, TrendingUp, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type ViewType = 'table' | 'calendar';
type StatusFilter = 'all' | 'verified' | 'pending' | 'cancelled';

export default function AppointmentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewType>('table');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const getClientId = () =>
    user?.role === 'owner' ? 'stride-services' : user?.clientId || 'stride-services';

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      const clientId = getClientId();
      const [appointmentsData, statsData] = await Promise.all([
        getClientAppointments(clientId),
        getClientStats(clientId, 'MONTHLY'),
      ]);
      setAppointments(appointmentsData.appointments);
      setStats(statsData);
      setError(null);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    if (statusFilter === 'all') return appointments;
    return appointments.filter(a => a.status === statusFilter);
  }, [appointments, statusFilter]);

  // Get appointments for a specific day (calendar view)
  const getAppointmentsForDay = (day: Date) => {
    return filteredAppointments.filter(a => isSameDay(new Date(a.datetime), day));
  };

  // Calendar grid
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });

    // Add padding for days before month starts
    const startDayOfWeek = getDay(start);
    const paddingDays = Array(startDayOfWeek).fill(null);

    return [...paddingDays, ...days];
  }, [currentMonth]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'verified': return 'default';
      case 'pending': return 'secondary';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-emerald-500';
      case 'pending': return 'bg-amber-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-zinc-500';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="flex gap-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-transparent">
            Appointments
          </h1>
          <p className="text-zinc-400 mt-1">
            {filteredAppointments.length} appointment{filteredAppointments.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
          <Button
            variant={view === 'table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setView('table')}
            className={view === 'table' ? '' : 'text-zinc-400'}
          >
            <List size={16} className="mr-2" />
            Table
          </Button>
          <Button
            variant={view === 'calendar' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setView('calendar')}
            className={view === 'calendar' ? '' : 'text-zinc-400'}
          >
            <Calendar size={16} className="mr-2" />
            Calendar
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Status Filters */}
      <div className="flex gap-2">
        {(['all', 'verified', 'pending', 'cancelled'] as StatusFilter[]).map((status) => (
          <Button
            key={status}
            variant={statusFilter === status ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setStatusFilter(status)}
            className={statusFilter === status ? '' : 'text-zinc-400 hover:text-white'}
          >
            {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            {status !== 'all' && (
              <span className="ml-2 text-xs opacity-60">
                ({appointments.filter(a => a.status === status).length})
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Content */}
      {view === 'table' ? (
        /* Table View */
        <Card className="glass-card">
          {filteredAppointments.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No appointments found"
              description={statusFilter !== 'all'
                ? `No ${statusFilter} appointments`
                : "Appointments will appear here when users book through the chatbot"}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Session</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAppointments.map((appt) => (
                  <TableRow key={appt.appointment_id} className="hover:bg-white/5">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                          <Clock size={18} className="text-zinc-400" />
                        </div>
                        <div>
                          <div className="font-medium text-white">
                            {format(new Date(appt.datetime), 'MMM d, yyyy')}
                          </div>
                          <div className="text-sm text-zinc-400">
                            {format(new Date(appt.datetime), 'h:mm a')}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {appt.contact_info.name && (
                          <div className="flex items-center gap-2 text-sm">
                            <User size={14} className="text-zinc-500" />
                            <span>{appt.contact_info.name}</span>
                          </div>
                        )}
                        {appt.contact_info.email && (
                          <div className="flex items-center gap-2 text-sm text-zinc-400">
                            <Mail size={14} className="text-zinc-500" />
                            <span>{appt.contact_info.email}</span>
                          </div>
                        )}
                        {appt.contact_info.phone && (
                          <div className="flex items-center gap-2 text-sm text-zinc-400">
                            <Phone size={14} className="text-zinc-500" />
                            <span>{appt.contact_info.phone}</span>
                          </div>
                        )}
                        {!appt.contact_info.name && !appt.contact_info.email && !appt.contact_info.phone && (
                          <span className="text-zinc-500 text-sm">No contact info</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(appt.status)}>
                        {appt.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/conversations/${appt.session_id}`)}
                        className="text-zinc-400 hover:text-white gap-1"
                      >
                        View chat
                        <ExternalLink size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      ) : (
        /* Calendar View */
        <Card className="glass-card p-6">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="text-zinc-400 hover:text-white"
              >
                <ChevronLeft size={20} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
                className="text-zinc-400 hover:text-white"
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="text-zinc-400 hover:text-white"
              >
                <ChevronRight size={20} />
              </Button>
            </div>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm text-zinc-500 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} className="h-24" />;
              }

              const dayAppointments = getAppointmentsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  className={`h-24 p-2 rounded-lg border transition-colors ${isCurrentMonth
                    ? 'border-white/5 bg-white/[0.02] hover:bg-white/5'
                    : 'border-transparent opacity-40'
                    } ${isToday ? 'ring-1 ring-white/20' : ''}`}
                >
                  <div className={`text-sm mb-1 ${isToday ? 'text-white font-bold' : 'text-zinc-400'}`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1 overflow-hidden">
                    {dayAppointments.slice(0, 2).map((appt) => (
                      <div
                        key={appt.appointment_id}
                        onClick={() => router.push(`/conversations/${appt.session_id}`)}
                        className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-zinc-300 truncate cursor-pointer hover:bg-white/20 transition-colors flex items-center gap-1"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getStatusColor(appt.status)}`} />
                        {format(new Date(appt.datetime), 'HH:mm')}
                      </div>
                    ))}
                    {dayAppointments.length > 2 && (
                      <div className="text-xs text-zinc-500 px-1">
                        +{dayAppointments.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Analytics Section - Now below appointments table/calendar */}
      {stats && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            <StatsCard
              title="Spotkania"
              value={stats.appointments_created}
              icon={Calendar}
              iconColor="text-purple-400"
              description="Spotkania umówione w ostatnich 30 dniach"
            />
            <StatsCard
              title="CPA"
              value={`$${stats.cpa_usd?.toFixed(2) || '0.00'}`}
              icon={DollarSign}
              iconColor="text-emerald-400"
              description="Koszt za spotkanie (ostatnie 30 dni)"
            />
            <StatsCard
              title="Śr. czas konwersji"
              value={`${stats.avg_time_to_conversion_min?.toFixed(1) || 0} min`}
              icon={Clock}
              iconColor="text-blue-400"
              description="Od pierwszej wiadomości do spotkania"
            />
            <StatsCard
              title="Wskaźnik Konwersji"
              value={`${stats.conversion_rate}%`}
              icon={TrendingUp}
              iconColor="text-amber-400"
              description="% rozmów zakończonych spotkaniem"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversion Funnel */}
            <Card className="glass-card p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Lejek konwersji</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={[
                    { name: 'Rozmowy', value: stats.conversations_count },
                    { name: 'Spotkania', value: stats.appointments_created },
                    { name: 'Zweryfikowane', value: stats.appointments_verified },
                  ]}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis type="number" stroke="#71717a" tick={{ fill: '#71717a' }} />
                  <YAxis type="category" dataKey="name" stroke="#71717a" tick={{ fill: '#a1a1aa' }} width={100} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Activity Heatmap */}
            {stats.activity_heatmap && (
              <ActivityHeatmap data={stats.activity_heatmap} />
            )}
          </div>

          {/* Second Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {stats.drop_off_by_length && Object.keys(stats.drop_off_by_length).length > 0 && (
              <DropOffChart data={stats.drop_off_by_length} />
            )}
            {stats.conversation_length_histogram && Object.keys(stats.conversation_length_histogram).length > 0 && (
              <ConversationLengthChart data={stats.conversation_length_histogram} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
