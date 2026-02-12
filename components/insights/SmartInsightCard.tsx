import { Lightbulb, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface SmartInsightCardProps {
    insight: string;
    topicName: string;
}

export default function SmartInsightCard({ insight, topicName }: SmartInsightCardProps) {
    if (!insight) return null;

    return (
        <Card className="glass-card p-5 border-purple-500/30 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <Sparkles size={80} />
            </div>

            <div className="flex items-start gap-4 relative z-10">
                <div className="p-2 bg-purple-500/20 rounded-lg shrink-0">
                    <Lightbulb className="text-purple-400" size={24} />
                </div>
                <div>
                    <h3 className="text-sm font-medium text-purple-300 mb-1 flex items-center gap-2">
                        <Sparkles size={14} />
                        AI Insight dla tematu "{topicName}"
                    </h3>
                    <p className="text-white text-lg leading-snug">
                        {insight}
                    </p>
                </div>
            </div>
        </Card>
    );
}
