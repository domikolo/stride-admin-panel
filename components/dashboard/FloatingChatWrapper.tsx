'use client';

import { useAuth } from '@/hooks/useAuth';
import FloatingChatWidget from './FloatingChatWidget';

export default function FloatingChatWrapper() {
  const { user } = useAuth();

  if (!user) return null;

  const clientId = user.role === 'owner' ? 'stride-services' : user.clientId || 'stride-services';

  return <FloatingChatWidget clientId={clientId} />;
}
