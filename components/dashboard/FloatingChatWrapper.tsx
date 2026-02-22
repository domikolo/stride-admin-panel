'use client';

import { useAuth } from '@/hooks/useAuth';
import { usePathname } from 'next/navigation';
import FloatingChatWidget from './FloatingChatWidget';

export default function FloatingChatWrapper() {
  const { user } = useAuth();
  const pathname = usePathname();

  if (!user) return null;
  if (pathname === '/live') return null;

  const clientId = user.role === 'owner' ? 'stride-services' : user.clientId || 'stride-services';

  return <FloatingChatWidget clientId={clientId} />;
}
