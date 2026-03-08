'use client';

import { useAuth } from './useAuth';

/**
 * Returns the effective client_id for API calls.
 * Owners default to 'stride-services'; regular clients use their own clientId.
 * Returns null when user is not yet loaded (prevents premature API calls).
 */
export function useClientId(): string | null {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === 'owner' ? 'stride-services' : (user.clientId ?? null);
}
