'use client';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface ActivityHeatmapProps {
    data?: Record<string, Record<string, { messages: number; appointments: number }>>;
    loading?: boolean;
}

const DAYS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function ActivityHeatmap({ data, loading }: ActivityHeatmapProps) {
    if (loading) {
        return <Skeleton className="w-full h-[300px]" />;
    }

    if (!data) {
        return (
            <Card className="glass-card p-6 flex items-center justify-center h-[300px] text-zinc-500">
                Brak danych o aktywności
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
        if (count === 0) return 'bg-zinc-800/20';
        const intensity = count / maxMessages;

        if (intensity < 0.2) return 'bg-blue-600/30';
        if (intensity < 0.4) return 'bg-blue-600/50';
        if (intensity < 0.6) return 'bg-blue-500/70';
        if (intensity < 0.8) return 'bg-blue-500/90';
        return 'bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.6)]';
    };

    const getAppointmentColor = (count: number) => {
        if (count === 0) return 'bg-zinc-800/20';
        const intensity = count / maxAppointments;

        if (intensity < 0.2) return 'bg-emerald-600/30';
        if (intensity < 0.4) return 'bg-emerald-600/50';
        if (intensity < 0.6) return 'bg-emerald-500/70';
        if (intensity < 0.8) return 'bg-emerald-500/90';
        return 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]';
    };

    const getTooltipContent = (dayIndex: number, hour: number) => {
        const dayData = data[dayIndex.toString()] || {};
        const hourData = dayData[hour.toString()] || { messages: 0, appointments: 0 };
        return (
            <div className="text-xs">
                <p className="font-bold mb-1 text-white">{DAYS[dayIndex]}, {hour}:00 - {hour + 1}:00</p>
                <div className="flex items-center gap-2 mb-0.5">
                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                    <span className="text-blue-200">{hourData.messages} wiadomości</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                    <span className="text-emerald-200">{hourData.appointments} spotkań</span>
                </div>
            </div>
        );
    };

    return (
        <Card className="glass-card p-6 overflow-x-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">Mapa Aktywności</h3>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Info size={14} className="text-zinc-500 hover:text-zinc-400 transition-colors cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[280px] z-50">
                            <p className="font-medium mb-1">Kiedy Twoi klienci są najbardziej aktywni?</p>
                            <ul className="list-disc pl-4 space-y-1 text-zinc-400">
                                <li><strong className="text-zinc-300">Ciemniejszy kolor</strong> = większa aktywność</li>
                                <li><span className="text-blue-400">Górna połówka</span> — wiadomości</li>
                                <li><span className="text-emerald-400">Dolna połówka</span> — spotkania</li>
                            </ul>
                        </TooltipContent>
                    </Tooltip>
                </div>
                <div className="flex gap-4 text-xs font-medium text-zinc-400">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-sm"></div> Wiadomości
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div> Spotkania
                    </div>
                </div>
            </div>

            <div className="min-w-[700px]">
                {/* Header Hours */}
                <div className="flex mb-2">
                    <div className="w-10 shrink-0"></div>
                    <div className="flex-1 grid grid-cols-24 gap-[2px]">
                        {HOURS.map((h) => (
                            <div key={h} className="text-[10px] text-zinc-500 text-center font-mono">
                                {h % 2 === 0 ? h : ''}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Rows */}
                <div className="space-y-[2px]">
                    {DAYS.map((day, dayIndex) => (
                        <div key={day} className="flex items-center h-10 group">
                            <div className="w-10 shrink-0 text-xs text-zinc-400 font-medium group-hover:text-white transition-colors">
                                {day}
                            </div>
                            <div className="flex-1 grid grid-cols-24 gap-[2px] h-full">
                                {HOURS.map((hour) => {
                                    return (
                                        <TooltipProvider key={hour} delayDuration={0}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div
                                                        className="h-full flex flex-col gap-[1px] rounded-[2px] overflow-hidden hover:scale-110 hover:z-10 hover:shadow-lg transition-all duration-200 cursor-crosshair ring-0 hover:ring-1 hover:ring-white/50"
                                                    >
                                                        {/* Messages (Top Half) */}
                                                        <div className={`flex-1 w-full transition-colors duration-300 ${getMessageColor(data?.[dayIndex.toString()]?.[hour.toString()]?.messages || 0)}`} />

                                                        {/* Appointments (Bottom Half) */}
                                                        <div className={`flex-1 w-full transition-colors duration-300 ${getAppointmentColor(data?.[dayIndex.toString()]?.[hour.toString()]?.appointments || 0)}`} />
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent
                                                    sideOffset={5}
                                                >
                                                    {getTooltipContent(dayIndex, hour)}
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Card >
    );
}

