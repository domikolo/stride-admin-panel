/**
 * Appointments Page - With Analytics Section
 * Contains appointment management + analytics moved from dashboard
 */

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSWR, fetcher } from '@/lib/swr';
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
import { Calendar, List, ChevronLeft, ChevronRight, ChevronDown, Clock, User, Phone, Mail, ExternalLink, TrendingUp, DollarSign, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type ViewType = 'table' | 'calendar';
type StatusFilter = 'all' | 'verified' | 'pending' | 'cancelled';

export default function AppointmentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<ViewType>('table');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false);
  const [expandedAppointmentId, setExpandedAppointmentId] = useState<string | null>(null);

  const clientId = user?.role === 'owner' ? 'stride-services' : user?.clientId || 'stride-services';

  const { data: apptData, isLoading, error: apptError, mutate } = useSWR<{ appointments: Appointment[]; count: number }>(
    clientId ? `/clients/${clientId}/appointments` : null, fetcher
  );
  const { data: statsData } = useSWR<ClientStats>(
    clientId ? `/clients/${clientId}/stats?period=MONTHLY` : null, fetcher
  );

  const appointments: Appointment[] = apptData?.appointments ?? [];
  const stats: ClientStats | null = statsData ?? null;
  const loading = isLoading;
  const error = apptError ? 'Nie udało się załadować danych. Spróbuj ponownie.' : null;

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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'verified': return 'Potwierdzone';
      case 'pending': return 'Oczekujące';
      case 'cancelled': return 'Anulowane';
      default: return status;
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

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'verified': return 'text-emerald-400';
      case 'pending': return 'text-amber-400';
      case 'cancelled': return 'text-red-400';
      default: return 'text-zinc-400';
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
        <div className="mb-2">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Spotkania
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {filteredAppointments.length} wizyt
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => mutate()} className="text-zinc-400 hover:text-white gap-2">
            <RefreshCw size={14} />Odśwież
          </Button>
          {/* View Toggle */}
          <div className="flex gap-1 bg-[#111113] p-1 rounded-lg border border-white/[0.06]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView('table')}
            className={view === 'table' ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-400 hover:text-white'}
          >
            <List size={16} className="mr-2" />
            Tabela
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView('calendar')}
            className={view === 'calendar' ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-400 hover:text-white'}
          >
            <Calendar size={16} className="mr-2" />
            Kalendarz
          </Button>
          </div>
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
            {status === 'all' ? 'Wszystkie' : status === 'verified' ? 'Potwierdzone' : status === 'pending' ? 'Oczekujące' : 'Anulowane'}
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
              title="Brak wizyt"
              description={statusFilter !== 'all'
                ? "Brak wizyt o wybranym statusie"
                : "Wizyty pojawią się tutaj gdy użytkownicy umówią się przez chatbota"}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data i godzina</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sesja</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAppointments.map((appt) => (
                  <TableRow key={appt.appointmentId} className="hover:bg-white/5">
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
                        {appt.contactInfo.name && (
                          <div className="flex items-center gap-2 text-sm">
                            <User size={14} className="text-zinc-500" />
                            <span>{appt.contactInfo.name}</span>
                          </div>
                        )}
                        {appt.contactInfo.email && (
                          <div className="flex items-center gap-2 text-sm text-zinc-400">
                            <Mail size={14} className="text-zinc-500" />
                            <span>{appt.contactInfo.email}</span>
                          </div>
                        )}
                        {appt.contactInfo.phone && (
                          <div className="flex items-center gap-2 text-sm text-zinc-400">
                            <Phone size={14} className="text-zinc-500" />
                            <span>{appt.contactInfo.phone}</span>
                          </div>
                        )}
                        {!appt.contactInfo.name && !appt.contactInfo.email && !appt.contactInfo.phone && (
                          <span className="text-zinc-500 text-sm">Brak danych kontaktowych</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(appt.status)}>
                        {getStatusLabel(appt.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/conversations/${appt.sessionId}`)}
                        className="text-zinc-400 hover:text-white gap-1"
                      >
                        Zobacz czat
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
                Dziś
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
            {['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'].map(day => (
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
                  className={`min-h-24 p-2 rounded-lg border transition-colors ${isCurrentMonth
                    ? 'border-white/[0.04] bg-white/[0.04] hover:bg-white/[0.08]'
                    : 'border-transparent opacity-40'
                    } ${isToday ? 'ring-1 ring-white/20' : ''}`}
                >
                  <div className={`text-sm mb-1 ${isToday ? 'text-white font-bold' : 'text-zinc-400'}`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1 overflow-hidden">
                    {dayAppointments.slice(0, 2).map((appt) => (
                      <div key={appt.appointmentId}>
                        <div
                          onClick={() => setExpandedAppointmentId(
                            expandedAppointmentId === appt.appointmentId ? null : appt.appointmentId
                          )}
                          className="text-xs px-1.5 py-0.5 rounded bg-white/[0.08] text-zinc-300 truncate cursor-pointer hover:bg-white/[0.12] transition-colors flex items-center gap-1"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getStatusColor(appt.status)}`} />
                          {format(new Date(appt.datetime), 'HH:mm')}
                        </div>
                      </div>
                    ))}
                    {dayAppointments.length > 2 && (
                      <div className="text-xs text-zinc-500 px-1">
                        +{dayAppointments.length - 2} więcej
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Expanded appointment detail panel */}
          {expandedAppointmentId && (() => {
            const appt = filteredAppointments.find(a => a.appointmentId === expandedAppointmentId);
            if (!appt) return null;
            return (
              <div className="mt-4 p-4 bg-[#1a1a1e] rounded-xl border border-white/[0.04]">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <Clock size={18} className="text-purple-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {format(new Date(appt.datetime), 'd MMMM yyyy, HH:mm')}
                      </p>
                      <p className={`text-sm ${getStatusTextColor(appt.status)}`}>
                        {getStatusLabel(appt.status)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedAppointmentId(null)}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                  </button>
                </div>

                {/* Contact info */}
                <div className="space-y-2 mb-4">
                  <p className="text-xs text-zinc-500 uppercase tracking-wide">Dane kontaktowe</p>
                  {appt.contactInfo.name && (
                    <div className="flex items-center gap-2 text-sm">
                      <User size={14} className="text-zinc-500" />
                      <span className="text-zinc-200">{appt.contactInfo.name}</span>
                    </div>
                  )}
                  {appt.contactInfo.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail size={14} className="text-zinc-500" />
                      <span className="text-zinc-300">{appt.contactInfo.email}</span>
                    </div>
                  )}
                  {appt.contactInfo.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone size={14} className="text-zinc-500" />
                      <span className="text-zinc-300">{appt.contactInfo.phone}</span>
                    </div>
                  )}
                  {!appt.contactInfo.name && !appt.contactInfo.email && !appt.contactInfo.phone && (
                    <p className="text-sm text-zinc-500">Brak danych kontaktowych</p>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/conversations/${appt.sessionId}`)}
                  className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 gap-1.5"
                >
                  <ExternalLink size={14} />
                  Zobacz rozmowę
                </Button>
              </div>
            );
          })()}
        </Card>
      )}

      {/* Analytics Section - Now below appointments table/calendar */}
      {stats && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            <StatsCard
              title="Spotkania"
              value={stats.appointmentsCreated}
              icon={Calendar}
              iconColor="text-purple-400"
              description="Spotkania umówione w ostatnich 30 dniach"
            />
            <StatsCard
              title="CPA"
              value={`$${stats.cpaUsd?.toFixed(2) || '0.00'}`}
              icon={DollarSign}
              iconColor="text-emerald-400"
              description="Koszt za spotkanie (ostatnie 30 dni)"
            />
            <StatsCard
              title="Śr. czas konwersji"
              value={`${stats.avgTimeToConversionMin?.toFixed(1) || 0} min`}
              icon={Clock}
              iconColor="text-blue-400"
              description="Od pierwszej wiadomości do spotkania"
            />
            <StatsCard
              title="Wskaźnik Konwersji"
              value={`${stats.conversionRate}%`}
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
                    { name: 'Rozmowy', value: stats.conversationsCount },
                    { name: 'Spotkania', value: stats.appointmentsCreated },
                    { name: 'Zweryfikowane', value: stats.appointmentsVerified },
                  ]}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis type="number" stroke="#71717a" tick={{ fill: '#71717a' }} />
                  <YAxis type="category" dataKey="name" stroke="#71717a" tick={{ fill: '#a1a1aa' }} width={100} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111113',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Activity Heatmap */}
            {stats.activityHeatmap && (
              <ActivityHeatmap data={stats.activityHeatmap} />
            )}
          </div>

          {/* Advanced Analytics Toggle */}
          <div>
            <button
              onClick={() => setShowAdvancedAnalytics(!showAdvancedAnalytics)}
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors py-2"
            >
              <ChevronDown
                size={16}
                className={`transition-transform duration-200 ${showAdvancedAnalytics ? 'rotate-180' : ''}`}
              />
              Zaawansowana analityka
            </button>

            {showAdvancedAnalytics && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                {stats.dropOffByLength && Object.keys(stats.dropOffByLength).length > 0 && (
                  <DropOffChart data={stats.dropOffByLength} />
                )}
                {stats.conversationLengthHistogram && Object.keys(stats.conversationLengthHistogram).length > 0 && (
                  <ConversationLengthChart data={stats.conversationLengthHistogram} />
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
