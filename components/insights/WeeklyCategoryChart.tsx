'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Topic } from '@/lib/types';

interface WeeklyCategoryChartProps {
    topics: Topic[];
    totalQuestions: number;
}

const CATEGORY_COLORS: Record<string, string> = {
    pricing: '#fbbf24',   // Amber 400
    features: '#818cf8',  // Indigo 400
    technical: '#22d3ee', // Cyan 400
    support: '#4ade80',   // Green 400
    other: '#9ca3af',     // Gray 400
};

const CATEGORY_LABELS: Record<string, string> = {
    pricing: 'Oferta / Cennik',
    features: 'Funkcje',
    technical: 'Techniczne',
    support: 'Wsparcie',
    other: 'Inne',
};

export default function WeeklyCategoryChart({ topics, totalQuestions }: WeeklyCategoryChartProps) {
    // Aggregate data by category
    const categoryCounts: Record<string, number> = {};

    topics.forEach(t => {
        const cat = t.category || 'other';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + t.count;
    });

    const data = Object.entries(categoryCounts)
        .map(([key, value]) => ({
            name: CATEGORY_LABELS[key] || key,
            value: value,
            color: CATEGORY_COLORS[key] || CATEGORY_COLORS.other
        }))
        .sort((a, b) => b.value - a.value);

    if (data.length === 0) return null;

    return (
        <Card className="glass-card">
            <CardHeader>
                <CardTitle className="text-lg text-white">Kategorie Pytań</CardTitle>
                <p className="text-sm text-zinc-400">Czego dotyczyły rozmowy w tym tygodniu?</p>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: '#111113', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '13px' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Legend
                                verticalAlign="bottom"
                                height={36}
                                iconType="circle"
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
