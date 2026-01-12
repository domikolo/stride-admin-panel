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
  total_tokens: {
    input: number;
    output: number;
    total: number;
  };
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
