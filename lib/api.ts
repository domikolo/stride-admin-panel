/**
 * API Client with JWT Authentication
 */

import { getIdToken } from './auth';
import { Client, ClientStats, Conversation, Appointment } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

class ApiClient {
  private async getHeaders(): Promise<HeadersInit> {
    const token = await getIdToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: await this.getHeaders(),
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
