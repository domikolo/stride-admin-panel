/**
 * Insights Page - Trending Questions & Knowledge Gaps
 * With Daily / Weekly period tabs
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
import { Flame, AlertTriangle, MessageSquare, TrendingUp, Calendar, Clock } from 'lucide-react';

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

type PeriodType = 'daily' | 'weekly';

export default function InsightsPage() {
    const { user } = useAuth();

    // Separate state for daily and weekly
    const [dailyTopics, setDailyTopics] = useState<Topic[]>([]);
    const [weeklyTopics, setWeeklyTopics] = useState<Topic[]>([]);
    const [gaps, setGaps] = useState<Gap[]>([]);

    const [dailySummary, setDailySummary] = useState({
        total_topics: 0,
        total_questions: 0,
        gaps_count: 0,
    });
    const [weeklySummary, setWeeklySummary] = useState({
        total_topics: 0,
        total_questions: 0,
        gaps_count: 0,
    });

    const [dailyLastUpdated, setDailyLastUpdated] = useState<string | null>(null);
    const [weeklyLastUpdated, setWeeklyLastUpdated] = useState<string | null>(null);

    const [activePeriod, setActivePeriod] = useState<PeriodType>('daily');
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

            // Load both daily and weekly in parallel
            const [dailyData, weeklyData, gapsData] = await Promise.all([
                getTrendingTopics(clientId, 'daily'),
                getTrendingTopics(clientId, 'weekly'),
                getGaps(clientId),
            ]);

            setDailyTopics(dailyData.topics);
            setDailySummary(dailyData.summary);
            setDailyLastUpdated(dailyData.last_updated);

            setWeeklyTopics(weeklyData.topics);
            setWeeklySummary(weeklyData.summary);
            setWeeklyLastUpdated(weeklyData.last_updated);

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

    // Get current period data
    const currentTopics = activePeriod === 'daily' ? dailyTopics : weeklyTopics;
    const currentSummary = activePeriod === 'daily' ? dailySummary : weeklySummary;
    const currentLastUpdated = activePeriod === 'daily' ? dailyLastUpdated : weeklyLastUpdated;

    // Calculate top buying intent for current period
    const topBuyingTopic = [...currentTopics]
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
                    Analiza pytań użytkowników chatbota
                </p>
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                    {error}
                </div>
            )}

            {/* Period Tabs - Main Navigation */}
            <Tabs value={activePeriod} onValueChange={(v) => setActivePeriod(v as PeriodType)} className="w-full">
                <TabsList className="bg-zinc-800/50 mb-6">
                    <TabsTrigger value="daily" className="data-[state=active]:bg-white data-[state=active]:text-black flex items-center gap-2">
                        <Clock size={16} />
                        Dzisiaj (24h)
                    </TabsTrigger>
                    <TabsTrigger value="weekly" className="data-[state=active]:bg-white data-[state=active]:text-black flex items-center gap-2">
                        <Calendar size={16} />
                        Tydzień (7 dni)
                    </TabsTrigger>
                </TabsList>

                {/* Period info */}
                <p className="text-zinc-500 text-sm mb-4">
                    {activePeriod === 'daily'
                        ? 'Dane z ostatnich 24 godzin • Trend: zmiana vs wczoraj'
                        : 'Dane z ostatnich 7 dni • Trend: zmiana vs poprzedni tydzień'
                    }
                    {currentLastUpdated && ` • Ostatnia aktualizacja: ${formatDate(currentLastUpdated)}`}
                </p>

                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <StatsCard
                        title="Unikalne tematy"
                        value={currentSummary.total_topics}
                        icon={MessageSquare}
                    />
                    <StatsCard
                        title="Łączne pytania"
                        value={currentSummary.total_questions}
                        icon={TrendingUp}
                    />
                    <StatsCard
                        title="Luki w bazie wiedzy"
                        value={activePeriod === 'daily' ? currentSummary.gaps_count : '-'}
                        icon={AlertTriangle}
                        trend={activePeriod === 'daily' && currentSummary.gaps_count > 0 ? 'down' : 'neutral'}
                    />
                </div>

                {/* Buying Intent Highlight (only if significant) */}
                {topBuyingTopic && topBuyingTopic.intent_breakdown.buying > 30 && (
                    <Card className="glass-card p-4 border-green-500/30 mb-6">
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

                {/* Content based on period */}
                <TabsContent value="daily" className="mt-0">
                    <Tabs defaultValue="topics" className="w-full">
                        <TabsList className="bg-zinc-800/50">
                            <TabsTrigger value="topics" className="data-[state=active]:bg-white data-[state=active]:text-black">
                                🔥 Top Pytania ({dailyTopics.length})
                            </TabsTrigger>
                            <TabsTrigger value="gaps" className="data-[state=active]:bg-white data-[state=active]:text-black">
                                ⚠️ Luki w KB ({gaps.length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="topics" className="mt-6">
                            {dailyTopics.length === 0 ? (
                                <Card className="glass-card p-8 text-center">
                                    <p className="text-zinc-400">
                                        Brak danych. Poczekaj na pierwszą analizę (codziennie o 2:00 w nocy).
                                    </p>
                                </Card>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {dailyTopics.map((topic) => (
                                        <TrendingTopicCard
                                            key={topic.topic_id}
                                            rank={topic.rank}
                                            topicName={topic.topic_name}
                                            count={topic.count}
                                            totalQuestions={dailySummary.total_questions}
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
                </TabsContent>

                <TabsContent value="weekly" className="mt-0">
                    {weeklyTopics.length === 0 ? (
                        <Card className="glass-card p-8 text-center">
                            <p className="text-zinc-400">
                                Brak danych tygodniowych. Poczekaj na pierwszą analizę (co niedzielę o 3:00 w nocy).
                            </p>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {weeklyTopics.map((topic) => (
                                <TrendingTopicCard
                                    key={topic.topic_id}
                                    rank={topic.rank}
                                    topicName={topic.topic_name}
                                    count={topic.count}
                                    totalQuestions={weeklySummary.total_questions}
                                    examples={topic.question_examples}
                                    trend={topic.trend}
                                    intentBreakdown={topic.intent_breakdown}
                                    isGap={false}
                                />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
