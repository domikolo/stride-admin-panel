import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface TopMoverCardProps {
    topicName: string;
    count: number;
    trend: 'up' | 'down' | 'stable' | 'new';
    percentageChange?: number;
}

export default function TopMoverCard({ topicName, count, trend, percentageChange }: TopMoverCardProps) {
    const isUp = trend === 'up';
    const bg = isUp ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30';
    const iconBg = isUp ? 'bg-green-500/20' : 'bg-red-500/20';
    const color = isUp ? 'text-green-400' : 'text-red-400';

    return (
        <Card className={`glass-card p-4 flex items-center justify-between ${bg}`}>
            <div>
                <div className="flex items-center gap-2 mb-1">
                    {isUp ? <TrendingUp size={14} className={color} /> : <TrendingDown size={14} className={color} />}
                    <p className="text-xs text-zinc-400 uppercase tracking-wider">
                        {isUp ? 'Największy Wzrost' : 'Największy Spadek'}
                    </p>
                </div>
                <h3 className="text-lg font-bold text-white max-w-[200px] truncate" title={topicName}>
                    {topicName}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-zinc-500 text-sm">{count} pytań</span>
                    {percentageChange !== undefined && (
                        <span className={`text-xs font-medium ${color}`}>
                            {isUp ? '+' : ''}{percentageChange.toFixed(0)}%
                        </span>
                    )}
                </div>
            </div>

            <div className={`p-3 rounded-full ${iconBg}`}>
                {isUp ? <TrendingUp size={24} className={color} /> : <TrendingDown size={24} className={color} />}
            </div>
        </Card>
    );
}
