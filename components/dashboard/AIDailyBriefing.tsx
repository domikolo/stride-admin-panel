/**
 * AI Daily Briefing Component
 * Hero section with AI-generated summary of recent activity
 */

'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DailyBriefing } from '@/lib/types';
import { Bot, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

interface AIDailyBriefingProps {
    briefing: DailyBriefing | null;
    loading?: boolean;
    onRefresh?: () => void;
    refreshing?: boolean;
}

export default function AIDailyBriefing({ briefing, loading, onRefresh, refreshing }: AIDailyBriefingProps) {
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '';
        try {
            return format(new Date(dateStr), "d MMMM yyyy, HH:mm", { locale: pl });
        } catch {
            return '';
        }
    };

    const getTrendIcon = (percent: number) => {
        if (percent > 0) return <TrendingUp className="text-emerald-400" size={18} />;
        if (percent < 0) return <TrendingDown className="text-red-400" size={18} />;
        return <Minus className="text-zinc-400" size={18} />;
    };

    if (loading) {
        return (
            <Card className="glass-card p-6 border-2 border-white/10">
                <div className="flex items-start gap-4">
                    <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
                    <div className="flex-1 space-y-3">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                    </div>
                </div>
            </Card>
        );
    }

    if (!briefing) {
        return (
            <Card className="glass-card p-6 border-2 border-white/10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center">
                        <Bot size={24} className="text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">AI Daily Briefing</h2>
                        <p className="text-zinc-400 text-sm">Brak danych do wyświetlenia</p>
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <Card className="glass-card p-6 border-2 border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent">
            <div className="flex items-start justify-between gap-4">
                {/* Main content */}
                <div className="flex items-start gap-4 flex-1">
                    {/* AI Icon */}
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center flex-shrink-0">
                        <Bot size={24} className="text-blue-400" />
                    </div>

                    {/* Briefing text */}
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <h2 className="text-xl font-bold text-white">AI Daily Briefing</h2>
                            {getTrendIcon(briefing.stats.conversations_change_percent)}
                        </div>
                        <p className="text-zinc-300 leading-relaxed">
                            {briefing.briefing}
                        </p>
                        <p className="text-xs text-zinc-500 mt-3">
                            Wygenerowano: {formatDate(briefing.generated_at)}
                        </p>
                    </div>
                </div>

                {/* Refresh button */}
                {onRefresh && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onRefresh}
                        disabled={refreshing}
                        className="text-zinc-400 hover:text-white flex-shrink-0"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        <span className="ml-2 hidden sm:inline">Odśwież</span>
                    </Button>
                )}
            </div>

            {/* Quick stats row */}
            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-white">{briefing.stats.conversations}</span>
                    <span className="text-xs text-zinc-400">rozmów (24h)</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-white">${briefing.stats.total_cost_usd.toFixed(2)}</span>
                    <span className="text-xs text-zinc-400">koszt (24h)</span>
                </div>
                {briefing.stats.gaps_count > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-amber-400">{briefing.stats.gaps_count}</span>
                        <span className="text-xs text-zinc-400">luki KB (aktualnie)</span>
                    </div>
                )}
                {briefing.stats.top_question && (
                    <div className="flex items-center gap-2 ml-auto">
                        <span className="text-xs text-zinc-400">Top pytanie:</span>
                        <span className="text-sm text-white font-medium bg-white/10 px-2 py-1 rounded">
                            {briefing.stats.top_question}
                        </span>
                    </div>
                )}
            </div>
        </Card>
    );
}
