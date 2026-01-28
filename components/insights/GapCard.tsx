/**
 * Gap Card Component - shows knowledge base gaps
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Lightbulb, CheckCircle } from 'lucide-react';

interface GapCardProps {
    topicId: string;
    topicName: string;
    count: number;
    examples: string[];
    gapReason: string;
    suggestion: string;
    onResolve?: (topicId: string) => void;
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
    gapReason,
    suggestion,
    onResolve,
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
                            className="text-green-400 hover:text-green-300 hover:bg-green-500/10 gap-1"
                        >
                            <CheckCircle size={14} />
                            Rozwiązane
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Examples */}
                <div>
                    <p className="text-xs text-zinc-500 mb-2">Przykładowe pytania:</p>
                    <ul className="space-y-1">
                        {examples.slice(0, 2).map((example, idx) => (
                            <li key={idx} className="text-sm text-zinc-300 italic">
                                "{example}"
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Gap reason */}
                <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-xs text-red-400">
                        Problem: {gapReason}
                    </p>
                </div>

                {/* Suggestion */}
                <div className="p-2 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-2">
                    <Lightbulb className="text-green-400 mt-0.5" size={14} />
                    <p className="text-xs text-green-400">
                        {suggestion}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

