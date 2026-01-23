'use client';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, Legend } from 'recharts';
import { Info } from 'lucide-react';
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
                No drop-off data available
            </Card>
        );
    }

    // Convert object to array for Recharts
    const order = ['1-2', '3-5', '6-10', '11-20', '21+'];
    const chartData = order.map(bucket => {
        const item = data[bucket] || { total: 0, dropped: 0 };
        const dropped = item.dropped;
        const converted = item.total - item.dropped;
        const dropRate = item.total > 0 ? (dropped / item.total) * 100 : 0;

        return {
            bucket,
            Total: item.total,
            Converted: converted,
            Dropped: dropped,
            Rate: parseFloat(dropRate.toFixed(1))
        };
    });

    return (
        <Card className="glass-card p-6">
            <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-white">Wskaźnik Odrzuceń (Drop-off Rate)</h3>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Info size={16} className="text-zinc-500 hover:text-white transition-colors cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[300px]">
                        <p className="font-semibold mb-1">Kiedy użytkownicy rezygnują?</p>
                        <p>Wykres pokazuje procent użytkowników, którzy zakończyli rozmowę bez umówienia spotkania, w zależności od długości tej rozmowy.</p>
                        <p className="mt-2 text-xs text-zinc-400">Linia = % Odrzuceń. Słupki = Liczba sesji.</p>
                    </TooltipContent>
                </Tooltip>
            </div>
            <p className="text-xs text-zinc-400 mb-4">Procent sesji zakończonych bez umówienia spotkania.</p>

            <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis
                            dataKey="bucket"
                            stroke="#71717a"
                            tick={{ fill: '#71717a', fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            yAxisId="left"
                            stroke="#71717a"
                            tick={{ fill: '#71717a', fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            stroke="#f43f5e"
                            tick={{ fill: '#f43f5e', fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                            unit="%"
                        />
                        <ChartTooltip
                            cursor={{ fill: '#27272a60' }}
                            contentStyle={{
                                backgroundColor: '#18181b',
                                border: '1px solid #27272a',
                                borderRadius: '8px',
                                color: '#fff',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)'
                            }}
                            labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />

                        <Bar
                            yAxisId="left"
                            dataKey="Converted"
                            stackId="a"
                            fill="#22c55e"
                            radius={[0, 0, 0, 0]}
                            name="Converted"
                        />
                        <Bar
                            yAxisId="left"
                            dataKey="Dropped"
                            stackId="a"
                            fill="#3b82f6"
                            radius={[4, 4, 0, 0]}
                            name="Start only"
                            fillOpacity={0.6}
                        />
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="Rate"
                            stroke="#f43f5e"
                            strokeWidth={2}
                            dot={{ r: 3, fill: '#f43f5e' }}
                            name="Drop-off Rate %"
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
            <div className="mt-4 text-xs text-zinc-500 text-center">
                High drop-off rate on short conversations (1-2) is normal (bounces).
                <br />High drop-off on long conversations (21+) suggests unresolved issues.
            </div>
        </Card>
    );
}
