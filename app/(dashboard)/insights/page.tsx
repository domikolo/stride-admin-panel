/**
 * Insights Page - Trending Questions & Knowledge Gaps
 */

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getTrendingTopics, getGaps } from '@/lib/api';
import TrendingTopicCard from '@/components/insights/TrendingTopicCard';
import GapCard from '@/components/insights/GapCard';
import StatsCard from '@/components/dashboard/StatsCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Flame, AlertTriangle, MessageSquare, TrendingUp } from 'lucide-react';

interface Topic {
    topic_id: string;
    topic_name: string;
    count: number;
    question_examples: string[];
    trend: 'up' | 'down' | 'stable' | 'new';
    intent_breakdown: {
        buying: number;
        comparing: number;
        info_seeking: number;
    };
    is_gap: boolean;
    gap_reason: string;
    rank: number;
}

interface Gap {
    topic_id: string;
    topic_name: string;
    count: number;
    question_examples: string[];
    gap_reason: string;
    suggestion: string;
}

export default function InsightsPage() {
    const { user } = useAuth();
    const [topics, setTopics] = useState<Topic[]>([]);
    const [gaps, setGaps] = useState<Gap[]>([]);
    const [summary, setSummary] = useState({
        total_topics: 0,
        total_questions: 0,
        gaps_count: 0,
    });
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user]);

    const loadData = async () => {
        try {
            setLoading(true);
            const clientId = user?.role === 'owner' ? 'stride-services' : user?.clientId || 'stride-services';

            const [topicsData, gapsData] = await Promise.all([
                getTrendingTopics(clientId),
                getGaps(clientId),
            ]);

            setTopics(topicsData.topics);
            setSummary(topicsData.summary);
            setLastUpdated(topicsData.last_updated);
            setGaps(gapsData.gaps);
            setError(null);
        } catch (err) {
            console.error('Failed to load insights:', err);
            setError('Nie udało się załadować danych. Spróbuj ponownie.');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'Brak danych';
        return new Date(dateStr).toLocaleDateString('pl-PL', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Calculate top buying intent
    const topBuyingTopic = [...topics]
        .sort((a, b) => b.intent_breakdown.buying - a.intent_breakdown.buying)[0];

    if (loading) {
        return (
            <div className="space-y-8">
                <h1 className="text-4xl font-bold text-white">Insights</h1>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-32" />
                    ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Skeleton key={i} className="h-64" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-bold bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-transparent flex items-center gap-3">
                    <Flame className="text-orange-500" />
                    Trending Questions
                </h1>
                <p className="text-zinc-400 mt-2">
                    Najczęstsze pytania użytkowników chatbota (ostatnie 14 dni)
                </p>
                {lastUpdated && (
                    <p className="text-zinc-500 text-sm mt-1">
                        Ostatnia aktualizacja: {formatDate(lastUpdated)}
                    </p>
                )}
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                    {error}
                </div>
            )}

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatsCard
                    title="Unikalne tematy"
                    value={summary.total_topics}
                    icon={MessageSquare}
                />
                <StatsCard
                    title="Łączne pytania"
                    value={summary.total_questions}
                    icon={TrendingUp}
                />
                <StatsCard
                    title="Luki w bazie wiedzy"
                    value={summary.gaps_count}
                    icon={AlertTriangle}
                    trend={summary.gaps_count > 0 ? 'down' : 'neutral'}
                />
            </div>

            {/* Buying Intent Highlight */}
            {topBuyingTopic && topBuyingTopic.intent_breakdown.buying > 30 && (
                <Card className="glass-card p-4 border-green-500/30">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">💰</span>
                        <div>
                            <p className="text-white font-medium">
                                Hot Lead Alert: "{topBuyingTopic.topic_name}"
                            </p>
                            <p className="text-sm text-zinc-400">
                                {topBuyingTopic.intent_breakdown.buying.toFixed(0)}% pytających wyraża zamiar zakupu
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            {/* Tabs for Topics and Gaps */}
            <Tabs defaultValue="topics" className="w-full">
                <TabsList className="bg-zinc-800/50">
                    <TabsTrigger value="topics" className="data-[state=active]:bg-white data-[state=active]:text-black">
                        🔥 Top Pytania ({topics.length})
                    </TabsTrigger>
                    <TabsTrigger value="gaps" className="data-[state=active]:bg-white data-[state=active]:text-black">
                        ⚠️ Luki w KB ({gaps.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="topics" className="mt-6">
                    {topics.length === 0 ? (
                        <Card className="glass-card p-8 text-center">
                            <p className="text-zinc-400">
                                Brak danych. Poczekaj na pierwszą analizę (codziennie o 2:00 w nocy).
                            </p>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {topics.map((topic) => (
                                <TrendingTopicCard
                                    key={topic.topic_id}
                                    rank={topic.rank}
                                    topicName={topic.topic_name}
                                    count={topic.count}
                                    examples={topic.question_examples}
                                    trend={topic.trend}
                                    intentBreakdown={topic.intent_breakdown}
                                    isGap={topic.is_gap}
                                    gapReason={topic.gap_reason}
                                />
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="gaps" className="mt-6">
                    {gaps.length === 0 ? (
                        <Card className="glass-card p-8 text-center">
                            <p className="text-zinc-400">
                                🎉 Świetnie! Nie wykryto żadnych luk w bazie wiedzy.
                            </p>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {gaps.map((gap) => (
                                <GapCard
                                    key={gap.topic_id}
                                    topicName={gap.topic_name}
                                    count={gap.count}
                                    examples={gap.question_examples}
                                    gapReason={gap.gap_reason}
                                    suggestion={gap.suggestion}
                                />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
