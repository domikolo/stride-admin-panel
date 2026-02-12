/**
 * API Client with JWT Authentication
 */

import { getIdToken } from './auth';
import { Client, ClientStats, DailyStat, Conversation, ConversationMessage, Appointment, Topic, Gap, Activity, DailyBriefing, ChatHistoryMessage, ChatResponse, ChatIntent } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Helper to convert snake_case keys to camelCase recursively
function camelCaseKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(camelCaseKeys);
  }
  if (obj && typeof obj === 'object') {
    const newObj: any = {};
    for (const [k, v] of Object.entries(obj)) {
      const parts = k.split('_');
      const camel = parts[0] + parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
      newObj[camel] = camelCaseKeys(v);
    }
    return newObj;
  }
  return obj;
}

class ApiClient {
  private async getHeaders(): Promise<HeadersInit> {
    const token = await getIdToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
    console.log('[API] Request headers:', {
      hasToken: !!token,
      hasAuthHeader: !!headers.Authorization,
      authHeaderPreview: headers.Authorization ? `${headers.Authorization.substring(0, 30)}...` : 'none',
    });
    return headers;
  }

  async get<T>(endpoint: string): Promise<T> {
    console.log('[API] GET request to:', `${API_BASE_URL}${endpoint}`);
    const headers = await this.getHeaders();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.statusText}`);
    }

    const data = await response.json();
    return camelCaseKeys(data) as T;
  }

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.statusText}`);
    }

    const responseData = await response.json();
    return camelCaseKeys(responseData) as T;
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.statusText}`);
    }

    const responseData = await response.json();
    return camelCaseKeys(responseData) as T;
  }
}

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
 */
export const getDailyBriefing = (clientId: string, refresh = false) =>
  api.get<DailyBriefing>(
    `/clients/${clientId}/daily-briefing${refresh ? '?refresh=true' : ''}`
  );

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
