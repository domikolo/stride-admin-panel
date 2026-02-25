/**
 * Trending Topic Card — clean professional design
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Sparkles, AlertTriangle, DollarSign } from 'lucide-react';
import QuestionsModal from './QuestionsModal';

interface TrendingTopicCardProps {
    rank: number;
    topicName: string;
    count: number;
    totalQuestions: number;
    examples: string[];
    questionSources?: Record<string, { sessionId: string; conversationNumber: number }>;
    trend: 'up' | 'down' | 'stable' | 'new';
    trendPercent?: number;
    intentBreakdown: {
        buying: number;
        comparing: number;
        infoSeeking: number;
    };
    isGap: boolean;
    gapReason?: string;
}

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
    questionSources,
    trend,
    intentBreakdown,
    isGap,
    gapReason,
}: TrendingTopicCardProps) {
    const [modalOpen, setModalOpen] = useState(false);
    const percentage = totalQuestions > 0 ? (count / totalQuestions) * 100 : 0;

    const trendConfig = {
        up: { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10', bar: 'bg-emerald-500', label: '↑ Wzrost' },
        down: { icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/10', bar: 'bg-red-500', label: '↓ Spadek' },
        stable: { icon: TrendingUp, color: 'text-zinc-400', bg: 'bg-zinc-500/10', bar: 'bg-blue-500', label: '→ Stabilny' },
        new: { icon: Sparkles, color: 'text-violet-400', bg: 'bg-violet-500/10', bar: 'bg-violet-500', label: '✦ Nowy' },
    }[trend];

    const TrendIcon = trendConfig.icon;

    return (
        <>
            <Card className={`glass-card group ${isGap ? 'border-yellow-500/20' : ''}`}>
                <CardContent className="p-5 space-y-4">
                    {/* Top row: rank + name + trend */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                            <span className="text-sm font-semibold text-zinc-600 mt-0.5 shrink-0 w-5 text-right">
                                {rank}
                            </span>
                            <div className="min-w-0">
                                <h3 className="text-[15px] font-semibold text-white leading-snug flex items-center gap-2">
                                    <span className="truncate">{topicName}</span>
                                    {isGap && <AlertTriangle size={14} className="text-yellow-400 shrink-0" />}
                                </h3>
                                <p className="text-xs text-zinc-500 mt-0.5">{formatQuestionCount(count)}</p>
                            </div>
                        </div>
                        <span className={`shrink-0 text-[11px] font-medium px-2 py-1 rounded-md ${trendConfig.bg} ${trendConfig.color}`}>
                            {trendConfig.label}
                        </span>
                    </div>

                    {/* Progress bar */}
                    <div>
                        <div className="flex justify-between text-[11px] text-zinc-500 mb-1.5">
                            <span>Udział</span>
                            <span className="font-medium text-zinc-300">{percentage.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                            <div
                                className={`h-full ${trendConfig.bar} rounded-full transition-all duration-700 ease-out`}
                                style={{ width: `${Math.max(percentage, 2)}%` }}
                            />
                        </div>
                    </div>

                    {/* Examples */}
                    <div className="space-y-1.5">
                        {examples.slice(0, 2).map((example, idx) => {
                            const source = questionSources?.[example];
                            return source ? (
                                <Link
                                    key={idx}
                                    href={`/conversations/${source.sessionId}?conversation_number=${source.conversationNumber}&highlight=${encodeURIComponent(example)}`}
                                    className="block text-[13px] text-zinc-400 hover:text-blue-400 transition-colors truncate"
                                >
                                    &ldquo;{example}&rdquo;
                                </Link>
                            ) : (
                                <p key={idx} className="text-[13px] text-zinc-500 truncate">
                                    &ldquo;{example}&rdquo;
                                </p>
                            );
                        })}
                        {examples.length > 2 && (
                            <button
                                onClick={() => setModalOpen(true)}
                                className="text-[11px] text-zinc-600 hover:text-blue-400 transition-colors mt-1"
                            >
                                +{examples.length - 2} więcej pytań →
                            </button>
                        )}
                    </div>

                    {/* Buying intent */}
                    {intentBreakdown.buying > 30 && (
                        <div className="flex items-center gap-2 text-[11px] p-2 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-lg">
                            <DollarSign size={12} className="text-emerald-400 shrink-0" />
                            <span className="text-emerald-400">{intentBreakdown.buying.toFixed(0)}% zamiar zakupu</span>
                        </div>
                    )}

                    {/* Gap warning */}
                    {isGap && gapReason && (
                        <div className="flex items-center gap-2 text-[11px] p-2 bg-yellow-500/[0.06] border border-yellow-500/15 rounded-lg">
                            <AlertTriangle size={12} className="text-yellow-400 shrink-0" />
                            <span className="text-yellow-400 truncate">{gapReason}</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {modalOpen && (
                <QuestionsModal
                    topicName={topicName}
                    totalCount={count}
                    examples={examples}
                    questionSources={questionSources}
                    onClose={() => setModalOpen(false)}
                />
            )}
        </>
    );
}
