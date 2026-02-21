import { Lightbulb, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface SmartInsightCardProps {
    insight: string;
    topicName: string;
}

export default function SmartInsightCard({ insight, topicName }: SmartInsightCardProps) {
    if (!insight) return null;

    return (
        <Card className="glass-card p-5 border-violet-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-[0.04]">
                <Sparkles size={64} />
            </div>

            <div className="flex items-start gap-4 relative z-10">
                <div className="p-2 bg-violet-500/15 rounded-lg shrink-0">
                    <Lightbulb className="text-violet-400" size={20} />
                </div>
                <div>
                    <h3 className="text-xs font-medium text-violet-400 mb-1 flex items-center gap-1.5">
                        <Sparkles size={12} />
                        AI Insight — {topicName}
                    </h3>
                    <p className="text-sm text-zinc-200 leading-relaxed">
                        {insight}
                    </p>
                </div>
            </div>
        </Card>
    );
}
