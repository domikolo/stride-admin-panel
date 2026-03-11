/**
 * TypeScript interfaces for Admin Panel
 */

export type NotificationType =
  | 'new_contact'
  | 'new_appointment'
  | 'appointment_verified'
  | 'appointment_cancelled'
  | 'knowledge_gap'
  | 'reminder';

export interface AppNotification {
  notificationId: string;
  type: NotificationType;
  icon: string;
  priority: 'high' | 'normal' | 'low';
  title: string;
  body?: string;
  resourceType: string;
  resourceId: string;
  read: boolean;
  createdAt: string;
}

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
  feedbackPositive?: number;
  feedbackNegative?: number;
  feedbackTotal?: number;
  satisfactionRate?: number | null;
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
  keywords?: string;
  rating?: 'positive' | 'negative' | null;
  adminTags?: string[];
  adminNotes?: string;
  adminFlagged?: boolean;
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
  notes?: string;
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
  gapExamples?: string[];
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

export interface ResolvedGap {
  topicId: string;
  topicName: string;
  resolvedAt: string;
  resolvedBy: string;
}

export interface Gap {
  topicId: string;
  topicName: string;
  count: number;
  questionExamples: string[];
  gapExamples?: string[];
  questionSources?: Record<string, { sessionId: string; conversationNumber: number }>;
  gapReason: string;
  suggestion?: string;
}

// Dashboard Hub Types
export interface Activity {
  type: 'conversation' | 'appointment';
  id: string;
  conversationNumber?: number;
  preview?: string;
  keywords?: string;
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

export type LeadScoreTier = 'hot' | 'warm' | 'cold';
export interface LeadScore {
  score: number;
  tier: LeadScoreTier;
  signals: string[];
  reasoning: string;
  fetchedAt: number;
  messageCountAtScore: number;  // messageCount at time of scoring — triggers re-score on increase
}

// Contacts / CRM-lite Types
export type PipelineStage = 'new' | 'contacted' | 'proposal' | 'won' | 'lost';

export interface ContactSource {
  sourceType: 'appointment' | 'conversation';
  sourceId: string;
  sessionId: string;
  createdAt: number;
}

// API Key Types
export interface ApiKey {
  keyId: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
  callCountTotal: number;
  callCountToday: number;
  dailyLimit: number;
  status: 'active' | 'revoked';
  rawKey?: string; // present only immediately after creation
}

// Audit Log Types
export interface AuditEvent {
  clientId: string;
  sk: string;
  timestamp: string;
  userEmail: string;
  resourceType: string;
  action: string;
  resourceId: string;
  details?: Record<string, unknown>;
}

export interface ContactProfile {
  profileId: string;
  contactInfo: string;       // email or phone number
  contactType: 'email' | 'phone';
  displayName?: string;
  status: string;            // PipelineStage or custom string
  notes?: string;
  tags?: string[];
  firstSeen: number;         // Unix timestamp
  lastSeen: number;          // Unix timestamp
  sourceCount: number;
  sourceTypes?: string[];    // e.g. ['appointment', 'conversation'] — in list response
  sources?: ContactSource[]; // full list with session links — in get_detail only
  // Appointment badge (enriched in get_list)
  hasAppointment?: boolean;
  appointmentDatetime?: string | null;
  appointmentStatus?: string | null;
}

export type ReminderRepeatType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface ReminderRepeat {
  type: ReminderRepeatType;
  intervalDays?: number;    // for 'custom'
  daysOfWeek?: number[];    // for 'weekly' (0=Mon … 6=Sun)
}

export interface Reminder {
  reminderId: string;
  profileId: string;
  fireAt: number;           // Unix timestamp
  message: string;
  repeat: ReminderRepeat;
  channel: 'inapp' | 'email' | 'both';
  status: 'pending' | 'fired';
  source: string;           // 'manual' | 'rule:{id}'
  createdAt: number;
  lastFiredAt?: number | null;
}

export interface ReminderRule {
  id: string;
  trigger: 'appointment_confirmed' | 'appointment_cancelled' | 'contact_added' | 'no_activity_days';
  delayHours: number;
  messageTemplate: string;
  channel: 'inapp' | 'email' | 'both';
  enabled: boolean;
  label: string;
}

// Observability Dashboard
export interface LambdaMetricPoint { date: string; value: number; }
export interface LambdaMetrics {
  invocations: { total: number; datapoints: LambdaMetricPoint[] };
  errors:      { total: number; datapoints: LambdaMetricPoint[] };
  duration:    { total: number; datapoints: LambdaMetricPoint[] };
  throttles:   { total: number; datapoints: LambdaMetricPoint[] };
}
export interface ClientObsStats {
  clientId: string;
  companyName: string;
  status: string;
  lambdaFunctionName: string;
  costUsd: number;
  chatbotCostUsd: number;
  adminCostUsd: number;
  costByReason: Record<string, number>;
  costByUser: Record<string, number>;
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  messages: number;
  uniqueSessions: number;
  appointments: number;
  lambdaInvocations: number;
  lambdaErrors: number;
  lambdaErrorRate: number;
  lambdaAvgDurationMs: number;
  lambdaThrottles: number;
  lambdaMetrics: LambdaMetrics;
}
export interface ObservabilityTotals {
  costUsd: number;
  chatbotCostUsd: number;
  adminCostUsd: number;
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  messages: number;
  uniqueSessions: number;
  appointments: number;
  lambdaInvocations: number;
  lambdaErrors: number;
  lambdaErrorRate: number;
}
export interface ObservabilityData {
  clients: ClientObsStats[];
  totals: ObservabilityTotals;
  periodDays: number;
  generatedAt: string;
}
