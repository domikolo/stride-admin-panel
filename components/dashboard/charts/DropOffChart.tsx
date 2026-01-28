'use client';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Info, TrendingDown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface DropOffChartProps {
    data?: Record<string, { total: number; dropped: number }>;
    loading?: boolean;
}

export default function DropOffChart({ data, loading }: DropOffChartProps) {
    if (loading) {
        return <Skeleton className="w-full h-[300px]" />;
    }

    if (!data || Object.keys(data).length === 0) {
        return (
            <Card className="glass-card p-6 flex items-center justify-center h-[300px] text-zinc-500">
                Brak danych o odrzuceniach
            </Card>
        );
    }

    // Convert object to array for Recharts - show drop-off rate per bucket
    const order = ['1-2', '3-5', '6-10', '11-20', '21+'];
    const bucketLabels: Record<string, string> = {
        '1-2': '1-2 wiad.',
        '3-5': '3-5 wiad.',
        '6-10': '6-10 wiad.',
        '11-20': '11-20 wiad.',
        '21+': '21+ wiad.'
    };

    const chartData = order.map(bucket => {
        const item = data[bucket] || { total: 0, dropped: 0 };
        const dropRate = item.total > 0 ? (item.dropped / item.total) * 100 : 0;
        const conversionRate = 100 - dropRate;

        return {
            bucket,
            label: bucketLabels[bucket],
            sessions: item.total,
            dropRate: parseFloat(dropRate.toFixed(0)),
            conversionRate: parseFloat(conversionRate.toFixed(0)),
        };
    }).filter(item => item.sessions > 0); // Only show buckets with data

    // Color scale - higher drop rate = more red
    const getBarColor = (dropRate: number) => {
        if (dropRate >= 80) return '#ef4444'; // red
        if (dropRate >= 60) return '#f97316'; // orange
        if (dropRate >= 40) return '#eab308'; // yellow
        if (dropRate >= 20) return '#22c55e'; // green
        return '#10b981'; // emerald
    };

    return (
        <Card className="glass-card p-6">
            <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="text-red-400" size={20} />
                <h3 className="text-lg font-semibold text-white">Gdzie użytkownicy rezygnują?</h3>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Info size={16} className="text-zinc-500 hover:text-white transition-colors cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[300px]">
                        <p className="font-semibold mb-1">Wskaźnik odrzuceń</p>
                        <p>Procent rozmów zakończonych BEZ umówienia spotkania, według długości rozmowy (liczby wiadomości).</p>
                        <p className="mt-2 text-xs text-zinc-400">🟢 Zielony = niska utrata, 🔴 Czerwony = wysoka utrata</p>
                    </TooltipContent>
                </Tooltip>
            </div>
            <p className="text-xs text-zinc-400 mb-4">% rozmów bez konwersji według długości</p>

            <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ left: 0, right: 30 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={true} vertical={false} />
                        <XAxis
                            type="number"
                            domain={[0, 100]}
                            stroke="#71717a"
                            tick={{ fill: '#71717a', fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            unit="%"
                        />
                        <YAxis
                            type="category"
                            dataKey="label"
                            stroke="#71717a"
                            tick={{ fill: '#a1a1aa', fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            width={70}
                        />
                        <ChartTooltip
                            cursor={{ fill: '#27272a60' }}
                            contentStyle={{
                                backgroundColor: '#18181b',
                                border: '1px solid #27272a',
                                borderRadius: '8px',
                                color: '#fff',
                            }}
                            formatter={(value: number, name: string, props: any) => [
                                `${value}% (${props.payload.sessions} sesji)`,
                                'Odrzucenia'
                            ]}
                            labelFormatter={(label) => `Długość: ${label}`}
                        />
                        <Bar
                            dataKey="dropRate"
                            radius={[0, 4, 4, 0]}
                            isAnimationActive={false}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getBarColor(entry.dropRate)} />
                            ))}
                            <LabelList
                                dataKey="dropRate"
                                position="right"
                                fill="#a1a1aa"
                                fontSize={11}
                                formatter={(value: number) => `${value}%`}
                            />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Summary insight */}
            {chartData.length > 0 && (
                <div className="mt-4 pt-3 border-t border-zinc-800">
                    <p className="text-xs text-zinc-400">
                        {chartData[0]?.dropRate >= 70
                            ? '⚠️ Wysoki drop-off na początku — rozważ ulepszenie pierwszych odpowiedzi chatbota'
                            : chartData[chartData.length - 1]?.dropRate >= 70
                                ? '💡 Długie rozmowy kończą się bez konwersji — chatbot może potrzebować wcześniejszego CTA'
                                : '✅ Rozkład odrzuceń wygląda zdrowo'}
                    </p>
                </div>
            )}
        </Card>
    );
}

