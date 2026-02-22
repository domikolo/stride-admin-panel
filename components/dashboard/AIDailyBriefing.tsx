/**
 * AI Daily Briefing Component
 * Hero section with AI-generated summary of recent activity
 */

'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DailyBriefing } from '@/lib/types';
import TypewriterText from '@/components/ui/TypewriterText';
import { RefreshCw, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

interface AIDailyBriefingProps {
    briefing: DailyBriefing | null;
    loading?: boolean;
    onRefresh?: () => void;
    refreshing?: boolean;
    isNew?: boolean; // true = właśnie wygenerowany, odtwórz typewriter
}

export default function AIDailyBriefing({ briefing, loading, onRefresh, refreshing, isNew = false }: AIDailyBriefingProps) {
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
            <Card className="glass-card p-6 md:p-8">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center">
                        <img src="/icon-logo-biale.png" alt="Stride" className="w-9 h-9 object-contain animate-pulse" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">AI Daily Briefing</h2>
                        <p className="text-xs text-zinc-500">Generowanie briefingu...</p>
                    </div>
                </div>
                <div className="inset-panel p-5">
                    <div className="space-y-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-[90%]" />
                        <Skeleton className="h-4 w-3/4" />
                    </div>
                </div>
            </Card>
        );
    }

    if (!briefing) {
        return (
            <Card className="glass-card p-6 md:p-8 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center">
                    <img src="/icon-logo-biale.png" alt="Stride" className="w-9 h-9 object-contain" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-white">AI Daily Briefing</h2>
                    <p className="text-sm text-zinc-400 mt-1">Brak danych do wyświetlenia na ten moment.</p>
                </div>
            </Card>
        );
    }

    return (
        <Card
            className="glass-card p-6 md:p-8 relative overflow-hidden"
            style={{
                background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(139, 92, 246, 0.07) 0%, transparent 70%), #111113',
            }}
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center">
                        <img src="/icon-logo-biale.png" alt="Stride" className="w-9 h-9 object-contain" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Daily Briefing</h2>
                        <p className="text-xs text-zinc-500">
                            Wygenerowano: {formatDate(briefing.generatedAt)}
                        </p>
                    </div>
                </div>
                {onRefresh && (
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
                )}
            </div>

            <div className="inset-panel p-5">
                <p className="text-zinc-200 leading-relaxed">
                    {isNew
                        ? <TypewriterText text={briefing.briefing} speed={12} />
                        : briefing.briefing
                    }
                </p>
            </div>

            {/* Top Question */}
            {briefing.stats.topQuestion && (
                <div
                    className="mt-4 pt-3 border-t border-white/[0.04] flex items-start gap-3 px-1"
                    style={{ animation: 'fadeIn 300ms ease-out 500ms both' }}
                >
                    <HelpCircle className="text-zinc-500 mt-0.5 flex-shrink-0" size={16} />
                    <div>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Top Pytanie</span>
                        <p className="text-sm text-zinc-300 italic">&quot;{briefing.stats.topQuestion}&quot;</p>
                    </div>
                </div>
            )}
        </Card>
    );
}
