'use client';

import { useAuth } from './useAuth';

export function useClientId(): string {
  const { user } = useAuth();
  return user?.role === 'owner' ? 'stride-services' : user?.clientId || 'stride-services';
}
