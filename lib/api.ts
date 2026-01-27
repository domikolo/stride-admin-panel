/**
 * API Client with JWT Authentication
 */

import { getIdToken } from './auth';
import { Client, ClientStats, DailyStat, Conversation, ConversationMessage, Appointment, Topic, Gap, Activity, DailyBriefing } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

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

    return response.json();
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

    return response.json();
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
  return api.get<{ session_id: string; messages: ConversationMessage[]; count: number; conversation_number?: number }>(
    `/clients/${clientId}/conversations/${sessionId}${query}`
  );
};

/**
 * Get daily stats for charts
 */
export const getClientDailyStats = (clientId: string, days = 30) =>
  api.get<{ client_id: string; daily_stats: DailyStat[]; count: number }>(
    `/clients/${clientId}/stats/daily?days=${days}`
  );

/**
 * Get trending topics
 */
export const getTrendingTopics = (clientId: string, period: 'daily' | 'weekly' = 'daily') =>
  api.get<{
    client_id: string;
    period_type: 'daily' | 'weekly';
    topics: Topic[];
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
  }>(`/clients/${clientId}/trending-topics?period=${period}`);

/**
 * Get knowledge base gaps
 */
export const getGaps = (clientId: string) =>
  api.get<{
    client_id: string;
    gaps: Gap[];
    count: number;
    message: string;
  }>(`/clients/${clientId}/trending-topics/gaps`);

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
