/**
 * TypeScript interfaces for Trending Topics / Insights
 */

export interface TrendingTopic {
    topic_id: string;
    topic_name: string;
    count: number;
    question_examples: string[];
    trend: 'up' | 'down' | 'stable' | 'new';
    intent_breakdown: {
        buying: number;
        comparing: number;
        info_seeking: number;
    };
    is_gap: boolean;
    gap_reason: string;
    rank: number;
}

export interface TrendingTopicsResponse {
    client_id: string;
    topics: TrendingTopic[];
    summary: {
        total_topics: number;
        total_questions: number;
        gaps_count: number;
    };
    period: {
        start: string | null;
        end: string | null;
    };
    last_updated: string | null;
}

export interface GapsResponse {
    client_id: string;
    gaps: TrendingTopic[];
    count: number;
    message: string;
}
