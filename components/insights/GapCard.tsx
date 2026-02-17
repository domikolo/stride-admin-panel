/**
 * Gap Card Component - shows knowledge base gaps
 */

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Lightbulb, CheckCircle, Loader2, Wrench } from 'lucide-react';

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

// Polish grammar helper for "pytanie"
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
    return (
        <Card className="glass-card border-yellow-500/30">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="text-yellow-400" size={20} />
                        <div>
                            <CardTitle className="text-lg text-white">{topicName}</CardTitle>
                            <p className="text-sm text-zinc-400">{formatQuestionCount(count)} bez dobrej odpowiedzi</p>
                        </div>
                    </div>
                    {onResolve && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onResolve(topicId)}
                            disabled={resolving}
                            className="text-green-400 hover:text-green-300 hover:bg-green-500/10 gap-1"
                        >
                            {resolving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                            Rozwiazane
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Examples */}
                <div>
                    <p className="text-xs text-zinc-500 mb-2">Przykładowe pytania:</p>
                    <ul className="space-y-1">
                        {examples.slice(0, 2).map((example, idx) => {
                            const source = questionSources?.[example];
                            return source ? (
                                <li key={idx}>
                                    <Link
                                        href={`/conversations/${source.sessionId}?conversation_number=${source.conversationNumber}&highlight=${encodeURIComponent(example)}`}
                                        className="text-sm text-blue-400/80 italic hover:text-blue-300 hover:underline transition-colors"
                                    >
                                        &ldquo;{example}&rdquo;
                                    </Link>
                                </li>
                            ) : (
                                <li key={idx} className="text-sm text-zinc-300 italic">
                                    &ldquo;{example}&rdquo;
                                </li>
                            );
                        })}
                    </ul>
                </div>

                {/* Gap reason */}
                <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-xs text-red-400">
                        Problem: {gapReason}
                    </p>
                </div>

                {/* Suggestion + Fix button */}
                <div className="flex items-center gap-2">
                    <div className="flex-1 p-2 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-2">
                        <Lightbulb className="text-green-400 mt-0.5" size={14} />
                        <p className="text-xs text-green-400">
                            {suggestion}
                        </p>
                    </div>
                    <Link
                        href={`/knowledge-base?fix_gap=${encodeURIComponent(topicId)}&topic=${encodeURIComponent(topicName)}&examples=${encodeURIComponent(examples.slice(0, 5).join('|||'))}&reason=${encodeURIComponent(gapReason)}`}
                        className="shrink-0"
                    >
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 gap-1 h-8"
                        >
                            <Wrench size={14} />
                            Napraw
                        </Button>
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}

