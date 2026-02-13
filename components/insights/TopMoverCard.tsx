import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface TopMoverCardProps {
    topicName: string;
    count: number;
    trend: 'up' | 'down' | 'stable' | 'new';
    percentageChange?: number;
}

export default function TopMoverCard({ topicName, count, trend }: TopMoverCardProps) {
    const bg = trend === 'up' ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30';
    const iconBg = trend === 'up' ? 'bg-green-500/20' : 'bg-red-500/20';

    return (
        <Card className={`glass-card p-4 flex items-center justify-between ${bg} mb-6`}>
            <div>
                <div className="flex items-center gap-2 mb-1">
                    {trend === 'up' ? <TrendingUp size={14} className="text-green-400" /> : <TrendingDown size={14} className="text-red-400" />}
                    <p className="text-xs text-zinc-400 uppercase tracking-wider">
                        {trend === 'up' ? 'Największy Wzrost' : 'Największy Spadek'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white max-w-[200px] truncate" title={topicName}>
                        {topicName}
                    </h3>
                    <span className="text-zinc-500 text-sm">({count} pytań)</span>
                </div>
            </div>

            <div className={`p-3 rounded-full ${iconBg}`}>
                {trend === 'up' ? <TrendingUp size={24} className="text-green-400" /> : <TrendingDown size={24} className="text-red-400" />}
            </div>
        </Card>
    );
}
