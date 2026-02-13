/**
 * AI Daily Briefing Component
 * Hero section with AI-generated summary of recent activity
 */

'use client';

import Link from 'next/link';
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
            <Card className="glass-card p-0 border border-white/[0.03] overflow-hidden">
                <div className="p-6 md:p-8">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-[#1a1a1a] flex items-center justify-center border border-white/[0.03]">
                            <Sparkles size={24} className="text-blue-400 animate-pulse" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">
                                AI Daily Briefing
                            </h2>
                            <p className="text-xs text-zinc-500">Generowanie briefingu...</p>
                        </div>
                    </div>
                    <div className="bg-[#1a1a1a] rounded-2xl p-5 border border-white/[0.03]">
                        <div className="space-y-3">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-[90%]" />
                            <Skeleton className="h-4 w-3/4" />
                        </div>
                    </div>
                </div>
            </Card>
        );
    }

    if (!briefing) {
        return (
            <Card className="glass-card p-8 border border-white/[0.03] flex items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-[#1a1a1a] flex items-center justify-center border border-white/[0.03]">
                    <Sparkles size={32} className="text-blue-400" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white">
                        AI Daily Briefing
                    </h2>
                    <p className="text-zinc-400 mt-1">Brak danych do wyswietlenia na ten moment.</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="glass-card p-0 border border-white/[0.03] overflow-hidden group">
            <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8">
                {/* Left Column: Icon + Summary */}
                <div className="flex-1">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-[#1a1a1a] flex items-center justify-center border border-white/[0.03]">
                            <Sparkles size={24} className="text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">
                                AI Daily Briefing
                            </h2>
                            <p className="text-xs text-zinc-500">
                                Wygenerowano: {formatDate(briefing.generatedAt)}
                            </p>
                        </div>
                    </div>

                    <div className="bg-[#1a1a1a] rounded-2xl p-5 border border-white/[0.03]">
                        <p className="text-zinc-200 leading-relaxed text-base">
                            {briefing.briefing}
                        </p>
                    </div>

                    {/* Top Question */}
                    {briefing.stats.topQuestion && (
                        <div className="mt-4 pt-3 border-t border-white/5 flex items-start gap-3 px-2">
                            <HelpCircle className="text-zinc-500 mt-1 flex-shrink-0" size={16} />
                            <div>
                                <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold">Top Pytanie</span>
                                <p className="text-sm text-zinc-300 italic">&quot;{briefing.stats.topQuestion}&quot;</p>
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
                                className="text-zinc-500 hover:text-zinc-300 h-8 text-xs gap-1.5"
                            >
                                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                                Odswiez
                            </Button>
                        </div>
                    )}

                    {/* Conversations - value links to /conversations */}
                    <div className="bg-[#1a1a1a] p-4 rounded-xl border border-white/[0.03] flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                            <MessageSquare size={20} className="text-blue-400" />
                        </div>
                        <div>
                            <Link href="/conversations">
                                <p className="text-2xl font-bold text-white hover:text-blue-400 transition-colors cursor-pointer">
                                    {briefing.stats.conversations}
                                </p>
                            </Link>
                            <p className="text-xs text-zinc-500 uppercase tracking-wide">rozmow (24h)</p>
                        </div>
                    </div>

                    {/* Cost - no link */}
                    <div className="bg-[#1a1a1a] p-4 rounded-xl border border-white/[0.03] flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                            <DollarSign size={20} className="text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">${briefing.stats.totalCostUsd.toFixed(2)}</p>
                            <p className="text-xs text-zinc-500 uppercase tracking-wide">koszt (24h)</p>
                        </div>
                    </div>

                    {/* Gaps - value links to /insights?period=daily&tab=gaps */}
                    <div className={`bg-[#1a1a1a] p-4 rounded-xl border flex items-center gap-4 ${briefing.stats.gapsCount > 0 ? 'border-amber-500/20' : 'border-white/[0.03]'}`}>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${briefing.stats.gapsCount > 0 ? 'bg-amber-500/20' : 'bg-zinc-500/20'}`}>
                            <AlertTriangle size={20} className={briefing.stats.gapsCount > 0 ? 'text-amber-400' : 'text-zinc-400'} />
                        </div>
                        <div>
                            <Link href="/insights?period=daily">
                                <p className={`text-2xl font-bold hover:text-blue-400 transition-colors cursor-pointer ${briefing.stats.gapsCount > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
                                    {briefing.stats.gapsCount}
                                </p>
                            </Link>
                            <p className="text-xs text-zinc-500 uppercase tracking-wide">luki KB</p>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}
