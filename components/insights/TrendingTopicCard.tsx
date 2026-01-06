/**
 * Trending Topic Card Component
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Sparkles, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface TrendingTopicCardProps {
    rank: number;
    topicName: string;
    count: number;
    examples: string[];
    trend: 'up' | 'down' | 'stable' | 'new';
    intentBreakdown: {
        buying: number;
        comparing: number;
        info_seeking: number;
    };
    isGap: boolean;
    gapReason?: string;
}

const INTENT_COLORS = {
    buying: '#22c55e',     // Green - hot leads
    comparing: '#f59e0b',  // Yellow
    info_seeking: '#3b82f6', // Blue
};

export default function TrendingTopicCard({
    rank,
    topicName,
    count,
    examples,
    trend,
    intentBreakdown,
    isGap,
    gapReason,
}: TrendingTopicCardProps) {
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-zinc-400';
    const trendLabel = trend === 'new' ? 'Nowy' : trend === 'up' ? 'Rośnie' : trend === 'down' ? 'Spada' : 'Stabilny';

    // Prepare pie chart data
    const pieData = [
        { name: 'Kupuje', value: intentBreakdown.buying, color: INTENT_COLORS.buying },
        { name: 'Porównuje', value: intentBreakdown.comparing, color: INTENT_COLORS.comparing },
        { name: 'Szuka info', value: intentBreakdown.info_seeking, color: INTENT_COLORS.info_seeking },
    ].filter(d => d.value > 0);

    return (
        <Card className={`glass-card ${isGap ? 'border-yellow-500/30' : ''}`}>
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold text-zinc-500">#{rank}</span>
                        <div>
                            <CardTitle className="text-lg text-white flex items-center gap-2">
                                {topicName}
                                {isGap && <AlertTriangle className="text-yellow-400" size={16} />}
                                {trend === 'new' && <Sparkles className="text-purple-400" size={16} />}
                            </CardTitle>
                            <p className="text-sm text-zinc-400">{count} pytań</p>
                        </div>
                    </div>
                    <div className={`flex items-center gap-1 ${trendColor}`}>
                        {trend !== 'new' && <TrendIcon size={16} />}
                        <span className="text-xs">{trendLabel}</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Examples */}
                <div>
                    <p className="text-xs text-zinc-500 mb-2">Przykładowe pytania:</p>
                    <ul className="space-y-1">
                        {examples.slice(0, 3).map((example, idx) => (
                            <li key={idx} className="text-sm text-zinc-300 italic">
                                "{example}"
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Intent breakdown mini chart */}
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    dataKey="value"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={15}
                                    outerRadius={28}
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#18181b',
                                        border: '1px solid #27272a',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                    }}
                                    formatter={(value) => typeof value === 'number' ? `${value.toFixed(0)}%` : `${value}%`}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-1">
                        {intentBreakdown.buying > 0 && (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="text-zinc-400">Kupuje: {intentBreakdown.buying.toFixed(0)}%</span>
                            </div>
                        )}
                        {intentBreakdown.comparing > 0 && (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                <span className="text-zinc-400">Porównuje: {intentBreakdown.comparing.toFixed(0)}%</span>
                            </div>
                        )}
                        {intentBreakdown.info_seeking > 0 && (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                <span className="text-zinc-400">Szuka info: {intentBreakdown.info_seeking.toFixed(0)}%</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Gap warning */}
                {isGap && gapReason && (
                    <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <p className="text-xs text-yellow-400 flex items-center gap-2">
                            <AlertTriangle size={12} />
                            Luka w KB: {gapReason}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
