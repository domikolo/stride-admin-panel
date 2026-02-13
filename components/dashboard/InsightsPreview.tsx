/**
 * Insights Preview Component
 * Shows top 3 trending topics with Hot Lead alert and Smart Insight
 */

'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Topic } from '@/lib/types';
import { Flame, TrendingUp, TrendingDown, Minus, ArrowRight, Lightbulb, DollarSign, AlertTriangle } from 'lucide-react';

interface InsightsPreviewProps {
    topics: Topic[];
    gapsCount: number;
    loading?: boolean;
}

export default function InsightsPreview({ topics, gapsCount, loading }: InsightsPreviewProps) {
    const getTrendIcon = (trend: string) => {
        switch (trend) {
            case 'up': return <TrendingUp size={14} className="text-emerald-400" />;
            case 'down': return <TrendingDown size={14} className="text-red-400" />;
            default: return <Minus size={14} className="text-zinc-400" />;
        }
    };

    // Find hot lead (topic with buying intent > 30%)
    const hotLead = topics.find(t => t.intentBreakdown?.buying > 30);

    // Get smart insight from top topic
    const smartInsight = topics[0]?.smartInsight;

    // Take top 3 topics
    const topTopics = topics.slice(0, 3);

    if (loading) {
        return (
            <Card className="glass-card p-4">
                <div className="flex items-center justify-between mb-4">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-8 w-24" />
                </div>
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12" />
                    ))}
                </div>
            </Card>
        );
    }

    return (
        <Card className="glass-card p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Flame size={18} className="text-orange-500" />
                    Trending
                </h3>
                <Link href="/insights">
                    <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white gap-1">
                        Zobacz wszystkie <ArrowRight size={14} />
                    </Button>
                </Link>
            </div>

            {/* Hot Lead Alert - Von Restorff: distinctive but consistent with theme */}
            {hotLead && (
                <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center gap-2">
                        <DollarSign size={16} className="text-amber-400" />
                        <span className="text-sm text-amber-300 font-medium">
                            Hot Lead: &quot;{hotLead.topicName}&quot;
                        </span>
                    </div>
                    <p className="text-xs text-amber-400/70 mt-1">
                        {hotLead.intentBreakdown.buying.toFixed(0)}% wyraża zamiar zakupu
                    </p>
                </div>
            )}

            {/* Smart Insight */}
            {smartInsight && (
                <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-start gap-2">
                        <Lightbulb size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-blue-200">{smartInsight}</p>
                    </div>
                </div>
            )}

            {/* Top Topics List */}
            {topTopics.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-4">
                    Brak danych. Poczekaj na pierwszą analizę.
                </p>
            ) : (
                <div className="space-y-2">
                    {topTopics.map((topic, index) => (
                        <div
                            key={topic.topicId}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.04] transition-colors duration-200"
                        >
                            {/* Rank */}
                            <span className="text-lg font-bold text-zinc-500 w-6 text-center">
                                #{index + 1}
                            </span>

                            {/* Topic info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-white font-medium truncate">
                                        {topic.topicName}
                                    </span>
                                    {getTrendIcon(topic.trend)}
                                </div>
                            </div>

                            {/* Count */}
                            <span className="text-sm text-zinc-400">
                                {topic.count} pytań
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Gaps count link */}
            {gapsCount > 0 && (
                <Link href="/insights?tab=gaps">
                    <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-red-300 flex items-center gap-2">
                                <AlertTriangle size={14} />
                                {gapsCount} luk w bazie wiedzy
                            </span>
                            <ArrowRight size={14} className="text-red-400" />
                        </div>
                    </div>
                </Link>
            )}
        </Card>
    );
}
