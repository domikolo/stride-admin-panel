'use client';

import { useAuth } from '@/hooks/useAuth';
import { useClientId } from '@/hooks/useClientId';
import { usePathname } from 'next/navigation';
import FloatingChatWidget from './FloatingChatWidget';

export default function FloatingChatWrapper() {
  const { user } = useAuth();
  const clientId = useClientId();
  const pathname = usePathname();

  if (!user || !clientId) return null;
  if (pathname === '/live') return null;

  return <FloatingChatWidget clientId={clientId} />;
}
