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
import { Sparkles, RefreshCw, MessageSquare, DollarSign, AlertTriangle, HelpCircle } from 'lucide-react';
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
            return format(new Date(dateStr), "d MMMM, HH:mm", { locale: pl });
        } catch {
            return '';
        }
    };

    if (loading) {
        return (
            <Card className="glass-card p-6 border-2 border-white/10 relative overflow-hidden">
                <div className="flex items-start gap-6">
                    <Skeleton className="w-16 h-16 rounded-2xl flex-shrink-0" />
                    <div className="flex-1 space-y-4">
                        <Skeleton className="h-8 w-64" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                    </div>
                </div>
            </Card>
        );
    }

    if (!briefing) {
        return (
            <Card className="glass-card p-8 border-2 border-white/10 flex items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-white/5">
                    <Sparkles size={32} className="text-blue-400" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                        AI Daily Briefing
                    </h2>
                    <p className="text-zinc-400 mt-1">Brak danych do wyświetlenia na ten moment.</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="glass-card p-0 border-2 border-white/10 overflow-hidden relative group">
            {/* Background decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

            <div className="p-6 md:p-8 relative z-10 flex flex-col md:flex-row gap-8">
                {/* Left Column: Icon + Summary */}
                <div className="flex-1">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center shadow-inner border border-white/10">
                            <Sparkles size={24} className="text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-white bg-clip-text text-transparent">
                                AI Daily Briefing
                            </h2>
                            <p className="text-xs text-zinc-500">
                                Wygenerowano: {formatDate(briefing.generated_at)}
                            </p>
                        </div>
                    </div>

                    <div className="bg-white/5 rounded-2xl p-5 border border-white/5 shadow-sm backdrop-blur-sm">
                        <p className="text-zinc-200 leading-relaxed text-base">
                            {briefing.briefing}
                        </p>
                    </div>

                    {/* Quick Action / Top Question */}
                    {briefing.stats.top_question && (
                        <div className="mt-4 flex items-start gap-3 px-2">
                            <HelpCircle className="text-zinc-500 mt-1 flex-shrink-0" size={16} />
                            <div>
                                <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Top Pytanie</span>
                                <p className="text-sm text-zinc-300 italic">"{briefing.stats.top_question}"</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: Stats Cards */}
                <div className="md:w-64 flex flex-col gap-3">
                    {onRefresh && (
                        <div className="flex justify-end mb-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onRefresh}
                                disabled={refreshing}
                                className="text-zinc-500 hover:text-white h-8 text-xs gap-1.5"
                            >
                                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                                Odśwież
                            </Button>
                        </div>
                    )}

                    <div className="bg-white/5 hover:bg-white/10 transition-colors p-4 rounded-xl border border-white/5 flex items-center gap-4 group/card">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center group-hover/card:scale-110 transition-transform">
                            <MessageSquare size={20} className="text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{briefing.stats.conversations}</p>
                            <p className="text-xs text-zinc-400">rozmów (24h)</p>
                        </div>
                    </div>

                    <div className="bg-white/5 hover:bg-white/10 transition-colors p-4 rounded-xl border border-white/5 flex items-center gap-4 group/card">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center group-hover/card:scale-110 transition-transform">
                            <DollarSign size={20} className="text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">${briefing.stats.total_cost_usd.toFixed(2)}</p>
                            <p className="text-xs text-zinc-400">koszt (24h)</p>
                        </div>
                    </div>

                    <div className={`bg-white/5 hover:bg-white/10 transition-colors p-4 rounded-xl border border-white/5 flex items-center gap-4 group/card ${briefing.stats.gaps_count > 0 ? 'bg-amber-500/5 border-amber-500/20' : ''}`}>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover/card:scale-110 transition-transform ${briefing.stats.gaps_count > 0 ? 'bg-amber-500/20' : 'bg-zinc-500/20'}`}>
                            <AlertTriangle size={20} className={briefing.stats.gaps_count > 0 ? 'text-amber-400' : 'text-zinc-400'} />
                        </div>
                        <div>
                            <p className={`text-2xl font-bold ${briefing.stats.gaps_count > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>{briefing.stats.gaps_count}</p>
                            <p className="text-xs text-zinc-400">luki KB</p>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}
