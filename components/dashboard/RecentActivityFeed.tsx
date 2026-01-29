/**
 * Recent Activity Feed Component
 * Shows recent conversations and appointments in a unified timeline
 */

'use client';

import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity } from '@/lib/types';
import { MessageSquare, Calendar, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';

interface RecentActivityFeedProps {
    activities: Activity[];
    loading?: boolean;
}

export default function RecentActivityFeed({ activities, loading }: RecentActivityFeedProps) {
    const router = useRouter();

    const formatTimestamp = (timestamp: string | null) => {
        if (!timestamp) return 'Brak danych';
        try {
            return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: pl });
        } catch {
            return 'Brak danych';
        }
    };

    const handleClick = (activity: Activity) => {
        if (activity.type === 'conversation') {
            router.push(`/conversations/${activity.id}`);
        } else {
            router.push(`/appointments`);
        }
    };

    if (loading) {
        return (
            <Card className="glass-card p-5">
                <h3 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
                    <Clock size={18} className="text-zinc-400" />
                    Ostatnia aktywność
                </h3>
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02]">
                            <Skeleton className="w-10 h-10 rounded-lg" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-3 w-32" />
                            </div>
                            <Skeleton className="h-3 w-16" />
                        </div>
                    ))}
                </div>
            </Card>
        );
    }

    if (activities.length === 0) {
        return (
            <Card className="glass-card p-4">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Clock size={18} className="text-zinc-400" />
                    Ostatnia aktywność
                </h3>
                <p className="text-zinc-500 text-sm text-center py-8">
                    Brak aktywności
                </p>
            </Card>
        );
    }

    return (
        <Card className="glass-card p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Clock size={18} className="text-zinc-400" />
                Ostatnia aktywność
            </h3>
            <div className="space-y-2">
                {activities.map((activity, index) => (
                    <div
                        key={`${activity.type}-${activity.id}-${index}`}
                        onClick={() => handleClick(activity)}
                        className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/10"
                    >
                        {/* Icon */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${activity.type === 'conversation'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-purple-500/20 text-purple-400'
                            }`}>
                            {activity.type === 'conversation' ? (
                                <MessageSquare size={16} />
                            ) : (
                                <Calendar size={16} />
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-sm text-white font-medium truncate">
                                    {activity.type === 'conversation' ? (
                                        <>Rozmowa</>
                                    ) : (
                                        <>{activity.contactName || 'Spotkanie'}</>
                                    )}
                                </span>
                                <span className="text-xs text-zinc-500 flex-shrink-0">
                                    {formatTimestamp(activity.timestamp)}
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400 truncate mt-0.5">
                                {activity.type === 'conversation' ? (
                                    activity.preview || `${activity.messageCount || 0} wiadomości`
                                ) : (
                                    <span className={`inline-flex items-center gap-1 ${activity.status === 'verified' ? 'text-emerald-400' :
                                        activity.status === 'pending' ? 'text-amber-400' : 'text-zinc-400'
                                        }`}>
                                        {activity.status === 'verified' ? '✓ Zweryfikowane' :
                                            activity.status === 'pending' ? '⏳ Oczekuje' : activity.status}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
}
