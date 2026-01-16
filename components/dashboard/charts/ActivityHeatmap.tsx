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

    // Find max value for normalization
    let maxActivity = 0;
    Object.values(data).forEach((dayData) => {
        Object.values(dayData).forEach((hourData) => {
            // Weight appointments higher to make them visible
            const score = hourData.messages + (hourData.appointments * 5);
            if (score > maxActivity) maxActivity = score;
        });
    });

    const getIntensityClass = (messages: number, appointments: number) => {
        const score = messages + (appointments * 5);
        if (score === 0) return 'bg-zinc-800/30'; // Minimal activity base

        // Normalize 0-1
        const intensity = Math.min(score / (maxActivity || 1), 1);

        if (appointments > 0) {
            // Verification/Appointment focused color (Green/Purple mix)
            if (intensity < 0.3) return 'bg-emerald-900/40';
            if (intensity < 0.6) return 'bg-emerald-700/60';
            return 'bg-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.3)]';
        } else {
            // Message focused color (Blue)
            if (intensity < 0.2) return 'bg-blue-900/20';
            if (intensity < 0.4) return 'bg-blue-800/40';
            if (intensity < 0.6) return 'bg-blue-700/60';
            if (intensity < 0.8) return 'bg-blue-600/80';
            return 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]';
        }
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
                        <div className="w-3 h-3 bg-blue-600 rounded-sm"></div> Messages
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div> Appointments
                    </div>
                </div>
            </div>

            <div className="min-w-[600px]">
                {/* Header Hours */}
                <div className="flex mb-2">
                    <div className="w-12 shrink-0"></div> {/* Row label spacer */}
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
                        <div key={day} className="flex items-center h-8">
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
                                            className={`h-full rounded-sm transition-all duration-300 hover:scale-125 cursor-help ${getIntensityClass(hourData.messages, hourData.appointments)}`}
                                            title={getTooltip(dayIndex, hour)}
                                        />
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
