'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Topic } from '@/lib/types';

interface WeeklyCategoryChartProps {
    topics: Topic[];
    totalQuestions: number;
    period?: 'daily' | 'weekly' | 'monthly';
}

const CATEGORY_COLORS: Record<string, string> = {
    pricing:   '#fbbf24',
    features:  '#818cf8',
    technical: '#22d3ee',
    support:   '#4ade80',
    other:     '#71717a',
};

const CATEGORY_LABELS: Record<string, string> = {
    pricing:   'Oferta / Cennik',
    features:  'Funkcje',
    technical: 'Techniczne',
    support:   'Wsparcie',
    other:     'Inne',
};

const PERIOD_SUBTITLE: Record<string, string> = {
    daily:   'Czego dotyczyły rozmowy wczoraj?',
    weekly:  'Czego dotyczyły rozmowy w tym tygodniu?',
    monthly: 'Czego dotyczyły rozmowy w tym miesiącu?',
};

export default function WeeklyCategoryChart({ topics, totalQuestions, period = 'weekly' }: WeeklyCategoryChartProps) {
    const categoryCounts: Record<string, number> = {};
    topics.forEach(t => {
        const cat = t.category || 'other';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + t.count;
    });

    const data = Object.entries(categoryCounts)
        .map(([key, value]) => ({
            key,
            name: CATEGORY_LABELS[key] || key,
            value,
            color: CATEGORY_COLORS[key] || CATEGORY_COLORS.other,
        }))
        .sort((a, b) => b.value - a.value);

    if (data.length === 0) return null;

    const total = data.reduce((s, d) => s + d.value, 0);

    return (
        <Card className="glass-card">
            <CardHeader>
                <CardTitle className="text-[15px] font-medium text-white">Kategorie pytań</CardTitle>
                <p className="text-sm text-zinc-500">{PERIOD_SUBTITLE[period]}</p>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                    {/* Donut */}
                    <div className="relative flex-shrink-0 w-[180px] h-[180px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={62}
                                    outerRadius={84}
                                    paddingAngle={3}
                                    dataKey="value"
                                    startAngle={90}
                                    endAngle={-270}
                                    strokeWidth={0}
                                >
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#111113',
                                        borderColor: 'rgba(255,255,255,0.08)',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        padding: '8px 12px',
                                    }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(value: number | undefined) => value != null ? [`${value} (${Math.round((value / total) * 100)}%)`, ''] : ['—', '']}
                                    labelFormatter={() => ''}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center label */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-2xl font-semibold text-white">{total}</span>
                            <span className="text-xs text-zinc-500 mt-0.5">pytań</span>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex-1 w-full space-y-2.5">
                        {data.map(entry => {
                            const pct = Math.round((entry.value / total) * 100);
                            return (
                                <div key={entry.key} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                                            <span className="text-zinc-300">{entry.name}</span>
                                        </div>
                                        <span className="text-zinc-400 tabular-nums">{entry.value} <span className="text-zinc-600">({pct}%)</span></span>
                                    </div>
                                    <div className="h-1 w-full bg-white/[0.05] rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{ width: `${pct}%`, backgroundColor: entry.color, opacity: 0.7 }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
