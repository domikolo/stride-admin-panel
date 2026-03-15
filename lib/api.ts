/**
 * API Client with JWT Authentication
 */

import { getIdToken } from './token';
import { Client, ClientStats, DailyStat, Conversation, ConversationMessage, Appointment, Topic, Gap, Activity, DailyBriefing, ChatHistoryMessage, ChatResponse, ChatIntent, KBEntry, KBVersion, LiveSession, ContactProfile, ContactTimelineEvent, AuditEvent, ApiKey, ObservabilityData, AppNotification, Report } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
if (!API_BASE_URL && typeof window !== 'undefined') {
  console.warn('[api] NEXT_PUBLIC_API_URL is not set — requests may fail');
}

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

// Helper to convert snake_case keys to camelCase recursively
function camelCaseKeys<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(camelCaseKeys) as T;
  }
  if (obj && typeof obj === 'object') {
    const newObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const parts = k.split('_');
      const camel = parts[0] + parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
      newObj[camel] = camelCaseKeys(v);
    }
    return newObj as T;
  }
  return obj;
}

class ApiClient {
  private getHeaders(): HeadersInit {
    const token = getIdToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  private async _handleError(response: Response): Promise<never> {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.error || `API error: ${response.statusText}`,
      response.status
    );
  }

  async get<T>(endpoint: string): Promise<T> {
    const headers = this.getHeaders();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) return this._handleError(response);

    const data = await response.json();
    return camelCaseKeys(data) as T;
  }

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) return this._handleError(response);

    const responseData = await response.json();
    return camelCaseKeys(responseData) as T;
  }

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) return this._handleError(response);

    const responseData = await response.json();
    return camelCaseKeys(responseData) as T;
  }

  async patch<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) return this._handleError(response);

    const responseData = await response.json();
    return camelCaseKeys(responseData) as T;
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) return this._handleError(response);

    const responseData = await response.json();
    return camelCaseKeys(responseData) as T;
  }
}

export { ApiError };
export const api = new ApiClient();

// API functions

/**
 * Get all clients (owner only)
 */
export const getClients = () =>
  api.get<{ clients: Client[]; count: number }>('/clients');

/**
 * Get client stats
 */
export const getClientStats = (
  clientId: string,
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' = 'MONTHLY'
) =>
  api.get<ClientStats>(`/clients/${clientId}/stats?period=${period}`);

/**
 * Get client conversations
 */
export const getClientConversations = (clientId: string, limit = 50) =>
  api.get<{ conversations: Conversation[]; count: number }>(
    `/clients/${clientId}/conversations?limit=${limit}`
  );

/**
 * Get client appointments
 */
export const getClientAppointments = (clientId: string, status?: string) => {
  const query = status ? `?status=${status}` : '';
  return api.get<{ appointments: Appointment[]; count: number }>(
    `/clients/${clientId}/appointments${query}`
  );
};

/**
 * Get conversation details (all messages)
 */
export const getConversationDetails = (
  clientId: string,
  sessionId: string,
  conversationNumber?: number
) => {
  const query = conversationNumber ? `?conversation_number=${conversationNumber}` : '';
  return api.get<{ sessionId: string; messages: ConversationMessage[]; count: number; conversationNumber?: number }>(
    `/clients/${clientId}/conversations/${sessionId}${query}`
  );
};

/**
 * Get daily stats for charts
 */
export const getClientDailyStats = (clientId: string, days = 30) =>
  api.get<{ clientId: string; dailyStats: DailyStat[]; count: number }>(
    `/clients/${clientId}/stats/daily?days=${days}`
  );

/**
 * Timeframe for trending topics analysis
 */
export type Timeframe = 'yesterday' | 'week' | '2weeks' | 'month';

/**
 * Get trending topics
 * @param includeGaps - if true, response will include gaps array
 */
export const getTrendingTopics = (clientId: string, timeframe: Timeframe = 'yesterday', includeGaps = false) =>
  api.get<{
    clientId: string;
    timeframe: Timeframe;
    topics: Topic[];
    dateRange: {
      start: string;
      end: string;
    };
    gaps?: Gap[];
  }>(`/clients/${clientId}/trending-topics?timeframe=${timeframe}${includeGaps ? '&include_gaps=true' : ''}`);

/**
 * Get knowledge base gaps (using unified trending-topics endpoint)
 */
export const getGaps = (clientId: string, timeframe: Timeframe = 'yesterday') =>
  api.get<{
    clientId: string;
    timeframe: Timeframe;
    topics: Topic[];
    gaps: Gap[];
  }>(`/clients/${clientId}/trending-topics?timeframe=${timeframe}&include_gaps=true`);

/**
 * Get recent activity (conversations + appointments)
 */
export const getRecentActivity = (clientId: string, limit = 10) =>
  api.get<{
    activities: Activity[];
    count: number;
  }>(`/clients/${clientId}/recent-activity?limit=${limit}`);

/**
 * Get daily briefing (AI summary)
 * Cached in sessionStorage for 1 hour to avoid re-generation on tab switches
 */
const BRIEFING_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export const getDailyBriefing = async (clientId: string, refresh = false): Promise<DailyBriefing> => {
  const cacheKey = `briefing_${clientId}`;

  if (!refresh && typeof window !== 'undefined') {
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < BRIEFING_CACHE_TTL) {
          return data as DailyBriefing;
        }
        sessionStorage.removeItem(cacheKey);
      }
    } catch { /* ignore parse errors */ }
  }

  const data = await api.get<DailyBriefing>(
    `/clients/${clientId}/daily-briefing${refresh ? '?refresh=true' : ''}`
  );

  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
    } catch { /* storage full, ignore */ }
  }

  return data;
};

/**
 * Send chat message to AI assistant
 */
export const sendChatMessage = (
  clientId: string,
  message: string,
  intent: ChatIntent = 'chat'
) =>
  api.post<ChatResponse>(`/clients/${clientId}/chat`, { message, intent });

/**
 * Get chat history
 */
export const getChatHistory = (clientId: string, limit = 50) =>
  api.get<{ messages: ChatHistoryMessage[]; count: number }>(
    `/clients/${clientId}/chat/history?limit=${limit}`
  );

/**
 * Resolve a knowledge base gap
 */
export const resolveGap = (clientId: string, topicId: string, topicName: string) =>
  api.post<{ status: string; topicId: string }>(
    `/clients/${clientId}/gaps/resolve`,
    { topic_id: topicId, topic_name: topicName }
  );

/**
 * Unresolve a knowledge base gap
 */
export const unresolveGap = (clientId: string, topicId: string) =>
  api.delete<{ status: string; topicId: string }>(
    `/clients/${clientId}/gaps/resolve?topic_id=${encodeURIComponent(topicId)}`
  );

/**
 * Get all resolved gap IDs
 */
export const getResolvedGaps = (clientId: string) =>
  api.get<{ resolvedGapIds: string[]; count: number }>(
    `/clients/${clientId}/gaps/resolved`
  );

// ─── Knowledge Base ──────────────────────────────────────────────

export const getKBEntries = (clientId: string) =>
  api.get<{ entries: KBEntry[]; count: number }>(
    `/clients/${clientId}/knowledge-base`
  );

export const getKBEntry = (clientId: string, entryId: string) =>
  api.get<KBEntry>(
    `/clients/${clientId}/knowledge-base/${entryId}`
  );

export const createKBEntry = (
  clientId: string,
  data: { topic: string; content: string; source_gap_id?: string }
) =>
  api.post<KBEntry>(
    `/clients/${clientId}/knowledge-base`,
    data
  );

export const updateKBEntry = (
  clientId: string,
  entryId: string,
  data: { topic?: string; content?: string; expected_updated_at?: string; }
) =>
  api.put<KBEntry>(
    `/clients/${clientId}/knowledge-base/${entryId}`,
    data
  );

export const deleteKBEntry = (clientId: string, entryId: string) =>
  api.delete<{ status: string; entryId: string }>(
    `/clients/${clientId}/knowledge-base/${entryId}`
  );

export const generateKBDraft = (
  clientId: string,
  data: {
    topic: string;
    question_examples?: string[];
    gap_reason?: string;
    existing_content?: string;
    file_content?: string;
    instruction?: string;
  }
) =>
  api.post<{ content: string; suggestedTopic?: string; tokensUsed: number; costUsd: number }>(
    `/clients/${clientId}/knowledge-base/ai-generate`,
    data
  );

export const inlineEditKB = (
  clientId: string,
  data: {
    topic: string;
    full_content: string;
    selected_text: string;
    instruction: string;
  }
) =>
  api.post<{ content: string; tokensUsed: number; costUsd: number }>(
    `/clients/${clientId}/knowledge-base/ai-inline-edit`,
    data
  );

export const publishKBEntry = (clientId: string, entryId: string) =>
  api.post<KBEntry>(
    `/clients/${clientId}/knowledge-base/${entryId}/publish`,
    {}
  );

export const unpublishKBEntry = (clientId: string, entryId: string) =>
  api.post<KBEntry>(
    `/clients/${clientId}/knowledge-base/${entryId}/unpublish`,
    {}
  );

export const importKBFromS3 = (clientId: string) =>
  api.post<{ importedCount: number; entries: KBEntry[] }>(
    `/clients/${clientId}/knowledge-base/import-s3`,
    {}
  );

export const getKBVersions = (clientId: string, entryId: string) =>
  api.get<{ versions: KBVersion[]; count: number }>(
    `/clients/${clientId}/knowledge-base/${entryId}/history`
  );

export const revertKBEntry = (clientId: string, entryId: string, versionSk: string) =>
  api.post<KBEntry>(
    `/clients/${clientId}/knowledge-base/${entryId}/revert`,
    { version_sk: versionSk }
  );

// ─── Live Conversations ─────────────────────────────────────────

export const getLiveSessions = (clientId: string) =>
  api.get<{ sessions: LiveSession[]; count: number }>(
    `/clients/${clientId}/live/sessions`
  );

export const getLiveAiSuggestion = (
  clientId: string,
  sessionId: string,
  conversationNumber: number
) =>
  api.post<{ suggestion: string; sessionId: string }>(
    `/clients/${clientId}/live/suggest`,
    { session_id: sessionId, conversation_number: conversationNumber }
  );

export const getLeadScore = (clientId: string, sessionId: string, conversationNumber: number) =>
  api.post<{ sessionId: string; score: number; tier: 'hot' | 'warm' | 'cold'; signals: string[]; reasoning: string }>(
    `/clients/${clientId}/live/score`,
    { session_id: sessionId, conversation_number: conversationNumber }
  );

// ─── Contacts (CRM-lite) ────────────────────────────────────────

export const getContactStages = (clientId: string) =>
  api.get<{ stages: { id: string; label: string; hex: string }[] }>(
    `/clients/${clientId}/contacts/stages`
  );

export const updateContactStages = (
  clientId: string,
  stages: { id: string; label: string; hex: string }[]
) =>
  api.put<{ status: string; stages: { id: string; label: string; hex: string }[] }>(
    `/clients/${clientId}/contacts/stages`,
    { stages }
  );

export const getClientContacts = (
  clientId: string,
  params?: {
    status?: string;
    source_type?: string;
    contact_type?: string;
    date_from?: number;
    date_to?: number;
    limit?: number;
  }
) => {
  const query = params
    ? '?' + Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  return api.get<{ contacts: ContactProfile[]; count: number }>(
    `/clients/${clientId}/contacts${query}`
  );
};

export const getContact = (clientId: string, profileId: string) =>
  api.get<ContactProfile>(`/clients/${clientId}/contacts/${profileId}`);

export const updateContact = (
  clientId: string,
  profileId: string,
  data: { status?: string; notes?: string; display_name?: string; tags?: string[] }
) =>
  api.put<{ status: string; profileId: string }>(
    `/clients/${clientId}/contacts/${profileId}`,
    data
  );

export const deleteContact = (clientId: string, profileId: string) =>
  api.delete<{ status: string; profileId: string }>(
    `/clients/${clientId}/contacts/${profileId}`
  );

export const getContactTimeline = (clientId: string, profileId: string) =>
  api.get<{ timeline: ContactTimelineEvent[] }>(
    `/clients/${clientId}/contacts/${profileId}/timeline`
  );

export const updateConversationAnnotations = (
  clientId: string,
  sessionId: string,
  data: { tags?: string[]; notes?: string; flagged?: boolean }
) =>
  api.patch<{ status: string; sessionId: string }>(
    `/clients/${clientId}/conversations/${sessionId}/annotations`,
    data
  );

export const updateAppointment = (
  clientId: string,
  appointmentId: string,
  data: { datetime?: string; notes?: string }
) =>
  api.patch<{ status: string; appointmentId: string }>(
    `/clients/${clientId}/appointments/${appointmentId}`,
    data
  );

export const cancelAppointment = (clientId: string, appointmentId: string, message: string) =>
  api.post<{ status: string; appointment_id: string; notification_sent: string }>(
    `/clients/${clientId}/appointments/${appointmentId}/cancel`,
    { message }
  );

// ─── Appointment Availability ───────────────────────────────────

export interface AppointmentAvailability {
  days: number[];       // 0=Sun, 1=Mon, ..., 6=Sat
  hourFrom: string;     // "09:00"
  hourTo: string;       // "17:00"
  slotDuration: number; // 15 | 30 | 45 | 60 | 90
}

export const getAppointmentAvailability = (clientId: string) =>
  api.get<AppointmentAvailability>(`/clients/${clientId}/appointments/availability`);

export const updateAppointmentAvailability = (clientId: string, data: AppointmentAvailability) =>
  api.put<{ status: string } & AppointmentAvailability>(
    `/clients/${clientId}/appointments/availability`,
    { days: data.days, hour_from: data.hourFrom, hour_to: data.hourTo, slot_duration: data.slotDuration }
  );

// ─── Search ─────────────────────────────────────────────────────

export interface SearchResult {
  type: 'contact' | 'conversation' | 'appointment';
  id: string;
  label: string;
  sublabel?: string | null;
  profileId?: string;
  sessionId?: string;
  appointmentId?: string;
}

export const searchGlobal = (clientId: string, q: string) =>
  api.get<{ results: SearchResult[]; query: string }>(
    `/clients/${clientId}/search?q=${encodeURIComponent(q)}`
  );

// ─── API Keys ───────────────────────────────────────────────────

export const getApiKeys = (clientId: string) =>
  api.get<{ keys: ApiKey[]; count: number }>(`/clients/${clientId}/api-keys`);

export const createApiKey = (clientId: string, name: string) =>
  api.post<ApiKey>(`/clients/${clientId}/api-keys`, { name });

export const revokeApiKey = (clientId: string, keyId: string) =>
  api.delete<{ status: string; keyId: string }>(`/clients/${clientId}/api-keys/${keyId}`);

// ─── Audit Log ──────────────────────────────────────────────────

export const getObservability = (days = 30) =>
  api.get<ObservabilityData>(`/clients/observability?days=${days}`);

export const getAuditLog = (
  clientId: string,
  params?: { limit?: number; action?: string; resource_type?: string }
) => {
  const query = params
    ? '?' + Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  return api.get<{ events: AuditEvent[]; count: number }>(
    `/clients/${clientId}/audit-log${query}`
  );
};

// ─── Client Settings ─────────────────────────────────────────────

export interface ChatbotHours {
  enabled: boolean;
  days: string[];
  hoursFrom: string;
  hoursTo: string;
  timezone: string;
  offlineMessage: string;
}

export const getChatbotSettings = (clientId: string) =>
  api.get<{ chatbotHours: ChatbotHours }>(`/clients/${clientId}/settings`);

export const updateChatbotSettings = (clientId: string, chatbot_hours: ChatbotHours) =>
  api.put<{ chatbotHours: ChatbotHours }>(`/clients/${clientId}/settings`, {
    chatbot_hours: {
      enabled: chatbot_hours.enabled,
      days: chatbot_hours.days,
      hours_from: chatbot_hours.hoursFrom,
      hours_to: chatbot_hours.hoursTo,
      timezone: chatbot_hours.timezone,
      offline_message: chatbot_hours.offlineMessage,
    },
  });

// ─── Notifications ───────────────────────────────────────────────

export const getNotifications = (clientId: string, unreadOnly = false) =>
  api.get<{ notifications: AppNotification[]; unreadCount: number }>(
    `/clients/${clientId}/notifications${unreadOnly ? '?unread_only=true' : ''}`
  );

export const getUnreadCount = (clientId: string) =>
  api.get<{ unreadCount: number }>(`/clients/${clientId}/notifications/unread-count`);

export const markNotificationRead = (clientId: string, notificationId: string) =>
  api.patch<{ status: string }>(`/clients/${clientId}/notifications/${notificationId}/read`, {});

export const markAllNotificationsRead = (clientId: string) =>
  api.post<{ status: string; updated: number }>(`/clients/${clientId}/notifications/mark-all-read`, {});


// ─── Appointments (manual creation) ─────────────────────────────

export const createAppointment = (
  clientId: string,
  data: { contact_info: string; contact_type: 'email' | 'phone'; datetime: string; notes?: string; contact_name?: string }
) => api.post<{ status: string; appointment_id: string; datetime: string }>(
  `/clients/${clientId}/appointments`, data
);

// ─── Reminders ──────────────────────────────────────────────────

export const getReminders = (clientId: string, contactId?: string, status?: string) => {
  const params = new URLSearchParams();
  if (contactId) params.set('contact_id', contactId);
  if (status) params.set('status', status);
  const qs = params.toString();
  return api.get<{ reminders: import('./types').Reminder[]; count: number }>(
    `/clients/${clientId}/reminders${qs ? '?' + qs : ''}`
  );
};

export const createReminder = (
  clientId: string,
  data: {
    profile_id: string;
    fire_at: number;
    message: string;
    channel?: string;
    repeat?: { type: string; interval_days?: number; days_of_week?: number[] };
    contact_info?: string;
    contact_type?: string;
  }
) => api.post<{ status: string; reminder_id: string; fire_at: number }>(
  `/clients/${clientId}/reminders`, data
);

export const deleteReminder = (clientId: string, reminderId: string) =>
  api.delete<{ status: string; reminder_id: string }>(
    `/clients/${clientId}/reminders/${reminderId}`
  );

export const getReminderRules = (clientId: string) =>
  api.get<{ rules: import('./types').ReminderRule[]; validTriggers: string[]; triggerLabels: Record<string, string> }>(
    `/clients/${clientId}/reminder-rules`
  );

export const updateReminderRules = (clientId: string, rules: import('./types').ReminderRule[]) =>
  api.put<{ status: string; rules: import('./types').ReminderRule[] }>(
    `/clients/${clientId}/reminder-rules`,
    {
      rules: rules.map(r => ({
        id: r.id,
        trigger: r.trigger,
        delay_hours: r.delayHours,
        message_template: r.messageTemplate,
        channel: r.channel,
        enabled: r.enabled,
        label: r.label,
      })),
    }
  );

// ─── Reports ─────────────────────────────────────────────────────

export const getReports = (clientId: string) =>
  api.get<{ reports: Report[]; count: number }>(`/clients/${clientId}/reports`);

export const getReport = (clientId: string, reportId: string) =>
  api.get<Report>(`/clients/${clientId}/reports/${reportId}`);

export const generateReport = (
  clientId: string,
  reportType: 'weekly' | 'monthly' | 'custom',
  periodStart?: string,
  periodEnd?: string,
) =>
  api.post<Report>(`/clients/${clientId}/reports/generate`, {
    report_type: reportType,
    ...(periodStart && { period_start: periodStart }),
    ...(periodEnd && { period_end: periodEnd }),
  });

export const deleteReport = (clientId: string, reportId: string) =>
  api.delete<{ deleted: boolean }>(`/clients/${clientId}/reports/${reportId}`);
