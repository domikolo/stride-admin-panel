'use client';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ActivityHeatmapProps {
    data?: Record<string, Record<string, { messages: number; appointments: number }>>;
    loading?: boolean;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function ActivityHeatmap({ data, loading }: ActivityHeatmapProps) {
    if (loading) {
        return <Skeleton className="w-full h-[300px]" />;
    }

    if (!data) {
        return (
            <Card className="glass-card p-6 flex items-center justify-center h-[300px] text-zinc-500">
                No activity data available
            </Card>
        );
    }

    // Find max values for normalization separately
    let maxMessages = 0;
    let maxAppointments = 0;

    Object.values(data).forEach((dayData) => {
        Object.values(dayData).forEach((hourData) => {
            if (hourData.messages > maxMessages) maxMessages = hourData.messages;
            if (hourData.appointments > maxAppointments) maxAppointments = hourData.appointments;
        });
    });

    // Ensure we don't divide by zero
    maxMessages = maxMessages || 1;
    maxAppointments = maxAppointments || 1;

    const getMessageColor = (count: number) => {
        if (count === 0) return 'bg-zinc-800/30';
        const intensity = count / maxMessages;

        if (intensity < 0.2) return 'bg-blue-900/30';
        if (intensity < 0.4) return 'bg-blue-800/50';
        if (intensity < 0.6) return 'bg-blue-700/70';
        if (intensity < 0.8) return 'bg-blue-600/90';
        return 'bg-blue-500';
    };

    const getAppointmentColor = (count: number) => {
        if (count === 0) return 'bg-zinc-800/30';
        const intensity = count / maxAppointments;

        if (intensity < 0.2) return 'bg-emerald-900/30';
        if (intensity < 0.4) return 'bg-emerald-800/50';
        if (intensity < 0.6) return 'bg-emerald-700/70';
        if (intensity < 0.8) return 'bg-emerald-600/90';
        return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]';
    };

    const getTooltip = (dayIndex: number, hour: number) => {
        const dayData = data[dayIndex.toString()] || {};
        const hourData = dayData[hour.toString()] || { messages: 0, appointments: 0 };
        return `${DAYS[dayIndex]} ${hour}:00 - ${hourData.messages} msgs, ${hourData.appointments} appts`;
    };

    return (
        <Card className="glass-card p-6 overflow-x-auto">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Activity Heatmap</h3>
                <div className="flex gap-4 text-xs text-zinc-400">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-sm"></div> Messages (Top)
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div> Appointments (Bottom)
                    </div>
                </div>
            </div>

            <div className="min-w-[600px]">
                {/* Header Hours */}
                <div className="flex mb-2">
                    <div className="w-12 shrink-0"></div>
                    <div className="flex-1 grid grid-cols-24 gap-1">
                        {HOURS.map((h) => (
                            <div key={h} className="text-[10px] text-zinc-500 text-center">
                                {h % 3 === 0 ? h : ''}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Rows */}
                <div className="space-y-1">
                    {DAYS.map((day, dayIndex) => (
                        <div key={day} className="flex items-center h-10"> {/* Increased row height for split view */}
                            <div className="w-12 shrink-0 text-xs text-zinc-400 font-medium">
                                {day}
                            </div>
                            <div className="flex-1 grid grid-cols-24 gap-1 h-full">
                                {HOURS.map((hour) => {
                                    const dayData = data[dayIndex.toString()] || {};
                                    const hourData = dayData[hour.toString()] || { messages: 0, appointments: 0 };

                                    return (
                                        <div
                                            key={hour}
                                            className="h-full flex flex-col gap-[1px] rounded-sm overflow-hidden hover:scale-110 transition-transform duration-200 cursor-help ring-1 ring-zinc-800/50"
                                            title={getTooltip(dayIndex, hour)}
                                        >
                                            {/* Messages (Top Half) */}
                                            <div className={`flex-1 w-full ${getMessageColor(hourData.messages)}`} />

                                            {/* Appointments (Bottom Half) */}
                                            <div className={`flex-1 w-full ${getAppointmentColor(hourData.appointments)}`} />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    );
}
