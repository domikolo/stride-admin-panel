/**
 * Insights Page - Trending Questions & Knowledge Gaps
 * With Daily / Weekly period tabs
 */

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getTrendingTopics, getGaps, Timeframe } from '@/lib/api';
import { Topic, Gap } from '@/lib/types';
import TrendingTopicCard from '@/components/insights/TrendingTopicCard';
import GapCard from '@/components/insights/GapCard';
import SmartInsightCard from '@/components/insights/SmartInsightCard';
import TopMoverCard from '@/components/insights/TopMoverCard';
import WeeklyCategoryChart from '@/components/insights/WeeklyCategoryChart';
import StatsCard from '@/components/dashboard/StatsCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Flame, AlertTriangle, MessageSquare, TrendingUp, Calendar, Clock } from 'lucide-react';


export default function InsightsPage() {
    const { user } = useAuth();

    const [dailyTopics, setDailyTopics] = useState<Topic[]>([]);
    const [weeklyTopics, setWeeklyTopics] = useState<Topic[]>([]);
    const [biweeklyTopics, setBiweeklyTopics] = useState<Topic[]>([]);
    const [gaps, setGaps] = useState<Gap[]>([]);
    const [resolvedGaps, setResolvedGaps] = useState<string[]>([]);

    const [dailySummary, setDailySummary] = useState({
        totalTopics: 0,
        totalQuestions: 0,
        gapsCount: 0,
    });
    const [weeklySummary, setWeeklySummary] = useState({
        totalTopics: 0,
        totalQuestions: 0,
        gapsCount: 0,
    });
    const [biweeklySummary, setBiweeklySummary] = useState({
        totalTopics: 0,
        totalQuestions: 0,
        gapsCount: 0,
    });

    const [activePeriod, setActivePeriod] = useState<'daily' | 'weekly' | 'biweekly'>('daily');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load resolved gaps from localStorage
    useEffect(() => {
        const stored = localStorage.getItem('resolvedGaps');
        if (stored) {
            try {
                setResolvedGaps(JSON.parse(stored));
            } catch { }
        }
    }, []);

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user]);

    const loadData = async () => {
        try {
            setLoading(true);
            const clientId = user?.role === 'owner' ? 'stride-services' : user?.clientId || 'stride-services';

            // Load daily (yesterday), weekly (week), biweekly (2weeks) and gaps
            const [dailyData, weeklyData, biweeklyData, gapsData] = await Promise.all([
                getTrendingTopics(clientId, 'yesterday'),
                getTrendingTopics(clientId, 'week'),
                getTrendingTopics(clientId, '2weeks'),
                getGaps(clientId, '2weeks'), // Get gaps for wider range
            ]);

            setDailyTopics(dailyData.topics);
            setDailySummary({
                totalTopics: dailyData.topics.length,
                totalQuestions: dailyData.topics.reduce((sum, t) => sum + t.count, 0),
                gapsCount: dailyData.gaps?.length || 0
            });

            setWeeklyTopics(weeklyData.topics);
            setWeeklySummary({
                totalTopics: weeklyData.topics.length,
                totalQuestions: weeklyData.topics.reduce((sum, t) => sum + t.count, 0),
                gapsCount: weeklyData.gaps?.length || 0
            });

            setBiweeklyTopics(biweeklyData.topics);
            setBiweeklySummary({
                totalTopics: biweeklyData.topics.length,
                totalQuestions: biweeklyData.topics.reduce((sum, t) => sum + t.count, 0),
                gapsCount: biweeklyData.gaps?.length || 0
            });

            setGaps(gapsData.gaps);
            setError(null);
        } catch (err) {
            console.error('Failed to load insights:', err);
            setError('Nie udało się załadować danych. Spróbuj ponownie.');
        } finally {
            setLoading(false);
        }
    };

    const handleResolveGap = (topicId: string) => {
        const updated = [...resolvedGaps, topicId];
        setResolvedGaps(updated);
        localStorage.setItem('resolvedGaps', JSON.stringify(updated));
    };

    const activeGaps = gaps.filter(gap => !resolvedGaps.includes(gap.topicId));

    // Get current period data
    const currentTopics = activePeriod === 'daily' ? dailyTopics : activePeriod === 'weekly' ? weeklyTopics : biweeklyTopics;
    const currentSummary = activePeriod === 'daily' ? dailySummary : activePeriod === 'weekly' ? weeklySummary : biweeklySummary;

    // Calculate top buying intent for current period
    const topBuyingTopic = [...currentTopics]
        .sort((a, b) => (b.intentBreakdown?.buying || 0) - (a.intentBreakdown?.buying || 0))[0];

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
            <Tabs value={activePeriod} onValueChange={(v) => setActivePeriod(v as any)} className="w-full">
                <TabsList className="bg-zinc-800/50 mb-6">
                    <TabsTrigger value="daily" className="data-[state=active]:bg-white data-[state=active]:text-black flex items-center gap-2">
                        <Clock size={16} />
                        Wczoraj (24h)
                    </TabsTrigger>
                    <TabsTrigger value="weekly" className="data-[state=active]:bg-white data-[state=active]:text-black flex items-center gap-2">
                        <Calendar size={16} />
                        Tydzień (7 dni)
                    </TabsTrigger>
                    <TabsTrigger value="biweekly" className="data-[state=active]:bg-white data-[state=active]:text-black flex items-center gap-2">
                        <Calendar size={16} />
                        2 tygodnie (14 dni)
                    </TabsTrigger>
                </TabsList>

                {/* Period info */}
                <p className="text-zinc-500 text-sm mb-4">
                    {activePeriod === 'daily'
                        ? 'Dane z wczoraj (ostatnie pełne 24h) • Trend: zmiana vs poprzedni dzień'
                        : activePeriod === 'weekly'
                            ? 'Dane z ostatnich 7 dni • Trend: zmiana vs poprzedni tydzień'
                            : 'Dane z ostatnich 14 dni • Trend: zmiana vs poprzednie 2 tygodnie'
                    }
                </p>

                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <StatsCard
                        title="Unikalne tematy"
                        value={currentSummary.totalTopics}
                        icon={MessageSquare}
                    />
                    <StatsCard
                        title="Łączne pytania"
                        value={currentSummary.totalQuestions}
                        icon={TrendingUp}
                    />
                    {activePeriod === 'daily' && (
                        <StatsCard
                            title="Luki w bazie wiedzy"
                            value={currentSummary.gapsCount}
                            icon={AlertTriangle}
                            trend={currentSummary.gapsCount > 0 ? 'down' : 'neutral'}
                        />
                    )}
                </div>

                {/* Buying Intent Highlight (only if significant) */}
                {topBuyingTopic && topBuyingTopic.intentBreakdown?.buying > 30 && (
                    <Card className="glass-card p-4 border-green-500/30 mb-6">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">💰</span>
                            <div>
                                <p className="text-white font-medium">
                                    Hot Lead Alert: "{topBuyingTopic.topicName}"
                                </p>
                                <p className="text-sm text-zinc-400">
                                    {topBuyingTopic.intentBreakdown.buying.toFixed(0)}% pytających wyraża zamiar zakupu
                                </p>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Content based on period */}
                <TabsContent value="daily" className="mt-0">
                    <Tabs defaultValue="topics" className="w-full">
                        <TabsList className="bg-zinc-800/50">
                            <TabsTrigger value="topics" className="data-[state=active]:bg-white data-[state=active]:text-black flex items-center gap-2">
                                <Flame size={16} className={activePeriod === 'daily' ? "text-orange-500" : ""} />
                                Top Pytania ({dailyTopics.length})
                            </TabsTrigger>
                            <TabsTrigger value="gaps" className="data-[state=active]:bg-white data-[state=active]:text-black flex items-center gap-2">
                                <AlertTriangle size={16} className="text-yellow-500" />
                                Luki w KB ({gaps.length})
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
                                <div className="space-y-6">
                                    {/* Smart Insight for Top Topic */}
                                    {dailyTopics.length > 0 && dailyTopics[0].smartInsight && (
                                        <SmartInsightCard
                                            insight={dailyTopics[0].smartInsight}
                                            topicName={dailyTopics[0].topicName}
                                        />
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {dailyTopics.map((topic) => (
                                            <TrendingTopicCard
                                                key={topic.topicId}
                                                rank={topic.rank}
                                                topicName={topic.topicName}
                                                count={topic.count}
                                                totalQuestions={dailySummary.totalQuestions}
                                                examples={topic.questionExamples}
                                                trend={topic.trend}
                                                intentBreakdown={topic.intentBreakdown}
                                                isGap={topic.isGap}
                                                gapReason={topic.gapReason}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="gaps" className="mt-6">
                            {activeGaps.length === 0 ? (
                                <Card className="glass-card p-8 text-center">
                                    <p className="text-zinc-400">
                                        🎉 Świetnie! Nie wykryto żadnych luk w bazie wiedzy.
                                    </p>
                                </Card>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {activeGaps.map((gap) => (
                                        <GapCard
                                            key={gap.topicId}
                                            topicId={gap.topicId}
                                            topicName={gap.topicName}
                                            count={gap.count}
                                            examples={gap.questionExamples}
                                            gapReason={gap.gapReason}
                                            suggestion={gap.suggestion}
                                            onResolve={handleResolveGap}
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
                                Brak danych. Poczekaj na więcej danych.
                            </p>
                        </Card>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Left Column: Top Mover & Category Chart */}
                                <div className="lg:col-span-1 space-y-6">
                                    {/* Find top mover (biggest trend up) */}
                                    {weeklyTopics.some(t => t.trend === 'up') && (
                                        <TopMoverCard
                                            topicName={weeklyTopics.find(t => t.trend === 'up')?.topicName || ''}
                                            count={weeklyTopics.find(t => t.trend === 'up')?.count || 0}
                                            trend="up"
                                        />
                                    )}

                                    <WeeklyCategoryChart
                                        topics={weeklyTopics}
                                        totalQuestions={weeklySummary.totalQuestions}
                                    />
                                </div>

                                {/* Right Column: List of Topics */}
                                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 content-start">
                                    {weeklyTopics.map((topic) => (
                                        <TrendingTopicCard
                                            key={topic.topicId}
                                            rank={topic.rank}
                                            topicName={topic.topicName}
                                            count={topic.count}
                                            totalQuestions={weeklySummary.totalQuestions}
                                            examples={topic.questionExamples}
                                            trend={topic.trend}
                                            intentBreakdown={topic.intentBreakdown}
                                            isGap={false}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="biweekly" className="mt-0">
                    {biweeklyTopics.length === 0 ? (
                        <Card className="glass-card p-8 text-center">
                            <p className="text-zinc-400">
                                Brak danych z 2 tygodni.
                            </p>
                        </Card>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Left Column: Top Mover & Category Chart */}
                                <div className="lg:col-span-1 space-y-6">
                                    {biweeklyTopics.some(t => t.trend === 'up') && (
                                        <TopMoverCard
                                            topicName={biweeklyTopics.find(t => t.trend === 'up')?.topicName || ''}
                                            count={biweeklyTopics.find(t => t.trend === 'up')?.count || 0}
                                            trend="up"
                                        />
                                    )}

                                    <WeeklyCategoryChart
                                        topics={biweeklyTopics}
                                        totalQuestions={biweeklySummary.totalQuestions}
                                    />
                                </div>

                                {/* Right Column: List of Topics */}
                                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 content-start">
                                    {biweeklyTopics.map((topic) => (
                                        <TrendingTopicCard
                                            key={topic.topicId}
                                            rank={topic.rank}
                                            topicName={topic.topicName}
                                            count={topic.count}
                                            totalQuestions={biweeklySummary.totalQuestions}
                                            examples={topic.questionExamples}
                                            trend={topic.trend}
                                            intentBreakdown={topic.intentBreakdown}
                                            isGap={false}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
