/**
 * TypeScript interfaces for Admin Panel
 */

export interface Client {
  clientId: string;
  companyName: string;
  status: 'active' | 'paused' | 'cancelled';
  createdAt: string;
  lambdaFunctionName: string;
  totalConversations: number;
}

export interface ClientStats {
  clientId: string;
  period: string;
  startDate: string;
  endDate: string;
  conversationsCount: number;
  messagesCount: number;
  appointmentsCreated: number;
  appointmentsVerified: number;
  conversionRate: number;
  verificationRate: number;
  totalCostUsd: number;
  cpaUsd?: number;
  avgTimeToConversionMin?: number;
  totalTokens: {
    input: number;
    output: number;
    total: number;
  };
  activityHeatmap?: Record<string, Record<string, { messages: number; appointments: number }>>;
  conversationLengthHistogram?: Record<string, number>;
  dropOffByLength?: Record<string, { total: number; dropped: number }>;
}

export interface DailyStat {
  date: string;
  conversations: number;
  appointments: number;
  messages: number;
}

export interface Conversation {
  sessionId: string;
  conversationNumber: number;
  messagesCount: number;
  firstMessage: string;
  lastMessage: string;
  preview: string;
}

export interface ConversationMessage {
  timestamp: string;
  role: 'user' | 'assistant';
  text: string;
  sentBy?: string;
}

export interface Appointment {
  appointmentId: string;
  sessionId: string;
  datetime: string;
  status: 'pending' | 'verified' | 'cancelled';
  contactInfo: {
    name?: string;
    email?: string;
    phone?: string;
  };
  createdAt: number;
  verifiedAt?: number;
  googleEventId?: string;
}

export interface AuthUser {
  email: string;
  role: 'owner' | 'client';
  clientId?: string;
  groups: string[];
}

export interface Topic {
  topicId: string;
  topicName: string;
  count: number;
  questionExamples: string[];
  questionSources?: Record<string, { sessionId: string; conversationNumber: number }>;
  trend: 'up' | 'down' | 'stable' | 'new';
  intentBreakdown: {
    buying: number;
    comparing: number;
    infoSeeking: number;
  };
  isGap: boolean;
  gapReason: string;
  category?: string;
  smartInsight?: string;
  rank: number;
}

export interface Gap {
  topicId: string;
  topicName: string;
  count: number;
  questionExamples: string[];
  questionSources?: Record<string, { sessionId: string; conversationNumber: number }>;
  gapReason: string;
  suggestion: string;
}

// Dashboard Hub Types
export interface Activity {
  type: 'conversation' | 'appointment';
  id: string;
  preview?: string;
  contactName?: string;
  timestamp: string;
  messageCount?: number;
  status?: string;
}

export interface DailyBriefing {
  briefing: string;
  generatedAt: string;
  stats: {
    conversations: number;
    conversationsChangePercent: number;
    messages: number;
    appointments: number;
    totalCostUsd: number;
    gapsCount: number;
    topQuestion: string | null;
  };
}

// AI Chatbot Types
export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatResponse {
  message: string;
  messageId: string;
  tokensUsed: number;
  costUsd: number;
}

export type ChatIntent = 'chat' | 'briefing' | 'smart_insight';

// Knowledge Base Types
export interface KBEntry {
  kbEntryId: string;
  sk: string;
  clientId: string;
  topic: string;
  content: string;
  status: 'draft' | 'published';
  sourceGapId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface KBVersion {
  kbEntryId: string;
  versionSk: string;
  versionTimestamp: string;
  topic: string;
  content: string;
  status: 'draft' | 'published';
  updatedAt: string;
}

// Live Conversations Types
export interface LiveSession {
  sessionId: string;
  lastActivity: number;
  messageCount: number;
  firstMessagePreview: string;
  conversationNumber: number;
  takenOverBy?: string;
}

export interface LiveMessage {
  role: string;
  text: string;
  timestamp: number;
  sentBy?: string;
  conversationNumber: number;
}

// Contacts / CRM-lite Types
export type PipelineStage = 'new' | 'contacted' | 'proposal' | 'won' | 'lost';

export interface ContactSource {
  sourceType: 'appointment' | 'conversation';
  sourceId: string;
  sessionId: string;
  createdAt: number;
}

export interface ContactProfile {
  profileId: string;
  contactInfo: string;       // email or phone number
  contactType: 'email' | 'phone';
  displayName?: string;
  status: string;            // PipelineStage or custom string
  notes?: string;
  firstSeen: number;         // Unix timestamp
  lastSeen: number;          // Unix timestamp
  sourceCount: number;
  sources?: ContactSource[]; // populated in get_detail only
}
