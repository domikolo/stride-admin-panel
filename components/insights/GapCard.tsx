/**
 * Gap Card — knowledge base gap, consistent with TrendingTopicCard design
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Lightbulb, CheckCircle, Loader2, Wrench } from 'lucide-react';
import QuestionsModal from './QuestionsModal';

interface GapCardProps {
    topicId: string;
    topicName: string;
    count: number;
    examples: string[];
    questionSources?: Record<string, { sessionId: string; conversationNumber: number }>;
    gapReason: string;
    suggestion: string;
    onResolve?: (topicId: string) => void;
    resolving?: boolean;
}

function formatQuestionCount(count: number): string {
    if (count === 1) return '1 pytanie';
    if (count >= 2 && count <= 4) return `${count} pytania`;
    return `${count} pytań`;
}

export default function GapCard({
    topicId,
    topicName,
    count,
    examples,
    questionSources,
    gapReason,
    suggestion,
    onResolve,
    resolving,
}: GapCardProps) {
    const [modalOpen, setModalOpen] = useState(false);

    // Show only examples that have a traceable source (real questions that caused the gap)
    const linkedExamples = examples.filter(e => questionSources?.[e]);
    const displayExamples = linkedExamples.length > 0 ? linkedExamples : examples;

    return (
        <>
            <Card className="glass-card border-amber-500/20">
                <CardContent className="p-5 space-y-4">
                    {/* Top row: icon + name + resolve */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                            <div className="w-7 h-7 rounded-md bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                <AlertTriangle size={14} className="text-amber-400" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-[15px] font-semibold text-white leading-snug truncate">
                                    {topicName}
                                </h3>
                                <p className="text-xs text-zinc-500 mt-0.5">{formatQuestionCount(count)} bez dobrej odpowiedzi</p>
                            </div>
                        </div>
                        {onResolve && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onResolve(topicId)}
                                disabled={resolving}
                                className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 gap-1 shrink-0 h-7 text-xs"
                            >
                                {resolving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                Rozwiązane
                            </Button>
                        )}
                    </div>

                    {/* Examples — only linked (sourced) questions */}
                    <div className="space-y-1.5">
                        {displayExamples.slice(0, 2).map((example, idx) => {
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
                        {displayExamples.length > 2 && (
                            <button
                                onClick={() => setModalOpen(true)}
                                className="text-[11px] text-zinc-600 hover:text-blue-400 transition-colors mt-1"
                            >
                                +{displayExamples.length - 2} więcej pytań →
                            </button>
                        )}
                    </div>

                    {/* Gap reason */}
                    <div className="flex items-center gap-2 text-[11px] p-2 bg-red-500/[0.06] border border-red-500/15 rounded-lg">
                        <AlertTriangle size={12} className="text-red-400 shrink-0" />
                        <span className="text-red-400 truncate">{gapReason}</span>
                    </div>

                    {/* Suggestion + Fix */}
                    <div className="flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-2 text-[11px] p-2 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-lg min-w-0">
                            <Lightbulb size={12} className="text-emerald-400 shrink-0" />
                            <span className="text-emerald-400 truncate">{suggestion}</span>
                        </div>
                        <Link
                            href={`/knowledge-base?fix_gap=${encodeURIComponent(topicId)}&topic=${encodeURIComponent(topicName)}&examples=${encodeURIComponent(examples.slice(0, 5).join('|||'))}&reason=${encodeURIComponent(gapReason)}`}
                            className="shrink-0"
                        >
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 gap-1 h-7 text-xs"
                            >
                                <Wrench size={12} />
                                Napraw
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>

            {modalOpen && (
                <QuestionsModal
                    topicName={topicName}
                    examples={displayExamples}
                    questionSources={questionSources}
                    onClose={() => setModalOpen(false)}
                />
            )}
        </>
    );
}
