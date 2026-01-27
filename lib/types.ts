/**
 * TypeScript interfaces for Admin Panel
 */

export interface Client {
  client_id: string;
  company_name: string;
  status: 'active' | 'paused' | 'cancelled';
  created_at: string;
  lambda_function_name: string;
  total_conversations: number;
}

export interface ClientStats {
  client_id: string;
  period: string;
  start_date: string;
  end_date: string;
  conversations_count: number;
  messages_count: number;
  appointments_created: number;
  appointments_verified: number;
  conversion_rate: number;
  verification_rate: number;
  total_cost_usd: number;
  cpa_usd?: number;
  avg_time_to_conversion_min?: number;
  total_tokens: {
    input: number;
    output: number;
    total: number;
  };
  activity_heatmap?: Record<string, Record<string, { messages: number; appointments: number }>>;
  conversation_length_histogram?: Record<string, number>;
  drop_off_by_length?: Record<string, { total: number; dropped: number }>;
}

export interface DailyStat {
  date: string;
  conversations: number;
  appointments: number;
  messages: number;
}

export interface Conversation {
  session_id: string;
  conversation_number: number;
  messages_count: number;
  first_message: string;
  last_message: string;
  preview: string;
}

export interface ConversationMessage {
  timestamp: string;
  role: 'user' | 'assistant';
  text: string;
}

export interface Appointment {
  appointment_id: string;
  session_id: string;
  datetime: string;
  status: 'pending' | 'verified' | 'cancelled';
  contact_info: {
    name?: string;
    email?: string;
    phone?: string;
  };
  created_at: number;
  verified_at?: number;
  google_event_id?: string;
}

export interface AuthUser {
  email: string;
  role: 'owner' | 'client';
  clientId?: string;
  groups: string[];
}

export interface Topic {
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
  category?: string;
  smart_insight?: string;
  rank: number;
}

export interface Gap {
  topic_id: string;
  topic_name: string;
  count: number;
  question_examples: string[];
  gap_reason: string;
  suggestion: string;
}

// Dashboard Hub Types
export interface Activity {
  type: 'conversation' | 'appointment';
  id: string;
  preview?: string;
  contact_name?: string;
  timestamp: string;
  message_count?: number;
  status?: string;
}

export interface DailyBriefing {
  briefing: string;
  generated_at: string;
  stats: {
    conversations: number;
    conversations_change_percent: number;
    messages: number;
    appointments: number;
    total_cost_usd: number;
    gaps_count: number;
    top_question: string | null;
  };
}
