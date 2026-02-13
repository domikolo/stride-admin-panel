/**
 * Trending Topic Card Component
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Sparkles, AlertTriangle, DollarSign } from 'lucide-react';

interface TrendingTopicCardProps {
    rank: number;
    topicName: string;
    count: number;
    totalQuestions: number;  // New prop for progress bar
    examples: string[];
    trend: 'up' | 'down' | 'stable' | 'new';
    trendPercent?: number;   // Optional trend percentage
    intentBreakdown: {
        buying: number;
        comparing: number;
        infoSeeking: number;
    };
    isGap: boolean;
    gapReason?: string;
}

// Polish grammar helper for "pytanie"
function formatQuestionCount(count: number): string {
    if (count === 1) return '1 pytanie';
    if (count >= 2 && count <= 4) return `${count} pytania`;
    return `${count} pytań`;
}

export default function TrendingTopicCard({
    rank,
    topicName,
    count,
    totalQuestions,
    examples,
    trend,
    trendPercent,
    intentBreakdown,
    isGap,
    gapReason,
}: TrendingTopicCardProps) {
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-zinc-400';
    const trendBgColor = trend === 'up' ? 'bg-green-500' : trend === 'down' ? 'bg-red-500' : 'bg-blue-500';

    // Calculate percentage of total questions
    const percentage = totalQuestions > 0 ? (count / totalQuestions) * 100 : 0;

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
                            <p className="text-sm text-zinc-400">{formatQuestionCount(count)}</p>
                        </div>
                    </div>
                    {/* Trend indicator with percentage */}
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${trend === 'up' ? 'bg-green-500/20' : trend === 'down' ? 'bg-red-500/20' : trend === 'new' ? 'bg-purple-500/20' : 'bg-zinc-500/20'}`}>
                        {trend === 'new' ? (
                            <Sparkles size={14} className="text-purple-400" />
                        ) : (
                            <TrendIcon size={14} className={trendColor} />
                        )}
                        <span className={`text-xs font-medium ${trend === 'new' ? 'text-purple-400' : trendColor}`}>
                            {trend === 'new' ? 'Nowy!' : trend === 'up' ? '+↑' : trend === 'down' ? '-↓' : '→'}
                        </span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Progress bar - % całości */}
                <div>
                    <div className="flex justify-between text-xs text-zinc-400 mb-1">
                        <span>Udział w pytaniach</span>
                        <span className="font-medium text-white">{percentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-[#1e1e1e] rounded-full overflow-hidden">
                        <div
                            className={`h-full ${trendBgColor} rounded-full transition-all duration-500`}
                            style={{ width: `${percentage}%` }}
                        />
                    </div>
                </div>

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

                {/* Buying intent highlight if significant */}
                {intentBreakdown.buying > 30 && (
                    <div className="flex items-center gap-2 text-xs p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <DollarSign size={14} className="text-green-400 flex-shrink-0" />
                        <span className="text-green-400">{intentBreakdown.buying.toFixed(0)}% wyraża zamiar zakupu</span>
                    </div>
                )}

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
