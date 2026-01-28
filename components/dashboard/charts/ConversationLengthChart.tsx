'use client';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer } from 'recharts';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ConversationLengthChartProps {
    data?: Record<string, number>;
    loading?: boolean;
}

export default function ConversationLengthChart({ data, loading }: ConversationLengthChartProps) {
    if (loading) {
        return <Skeleton className="w-full h-[300px]" />;
    }

    if (!data || Object.keys(data).length === 0) {
        return (
            <Card className="glass-card p-6 flex items-center justify-center h-[300px] text-zinc-500">
                No conversation data available
            </Card>
        );
    }

    // Convert object to array for Recharts
    // Order: 1-2, 3-5, 6-10, 11-20, 21+
    const order = ['1-2', '3-5', '6-10', '11-20', '21+'];
    const chartData = order.map(bucket => ({
        bucket,
        count: data[bucket] || 0
    }));

    return (
        <Card className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-semibold text-white">Długość Konwersacji</h3>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Info size={16} className="text-zinc-500 hover:text-white transition-colors cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[300px]">
                        <p className="font-semibold mb-1">Ile wiadomości wymieniają użytkownicy?</p>
                        <p>Ten wykres pokazuje rozkład liczby wiadomości w ramach jednej sesji.</p>
                        <ul className="list-disc pl-4 mt-2 space-y-1">
                            <li><strong>Krótkie (1-2)</strong>: Często oznaczają "odrzucenia" lub proste pytania.</li>
                            <li><strong>Długie (21+)</strong>: Mogą sugerować duże zaangażowanie lub problemy bota ze zrozumieniem intencji.</li>
                        </ul>
                    </TooltipContent>
                </Tooltip>
            </div>
            <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis
                            dataKey="bucket"
                            stroke="#71717a"
                            tick={{ fill: '#71717a', fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#71717a"
                            tick={{ fill: '#71717a', fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
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
                        <Bar
                            dataKey="count"
                            fill="#3b82f6"
                            radius={[4, 4, 0, 0]}
                            name="Sessions"
                            isAnimationActive={false}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}
