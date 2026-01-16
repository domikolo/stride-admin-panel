'use client';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
            <h3 className="text-lg font-semibold text-white mb-4">Conversation Length (Messages)</h3>
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
                        <Tooltip
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
                            animationDuration={1000}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="mt-4 text-xs text-zinc-500 text-center">
                Shows how many messages are exchanged in typical sessions.
                <br />
                <span className="text-zinc-400">Trend:</span> More messages usually indicates deeper engagement or complex queries.
            </div>
        </Card>
    );
}
