/**
 * Sidebar Navigation Component - Improved with badges
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  MessageSquare,
  Calendar,
  Users,
  LogOut,
  Flame,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [gapsCount, setGapsCount] = useState<number>(0);

  // Fetch gaps count for badge (you can implement this API call)
  useEffect(() => {
    // Mock - in production, call API to get gaps count
    // For now, just set a static value or fetch from API
    setGapsCount(0); // Will be updated when gaps API is called
  }, []);

  const clientLinks = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/conversations', icon: MessageSquare, label: 'Conversations' },
    { href: '/appointments', icon: Calendar, label: 'Appointments' },
    { href: '/insights', icon: Flame, label: 'Insights', badge: gapsCount > 0 ? gapsCount : null },
  ];

  const ownerLinks = [
    ...clientLinks,
    { href: '/clients', icon: Users, label: 'Clients' },
  ];

  const links = user?.role === 'owner' ? ownerLinks : clientLinks;

  return (
    <aside className="w-64 border-r border-border bg-card h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Stride"
            className="h-7 w-auto"
          />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200',
                isActive
                  ? 'bg-white text-black font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon size={20} />
                <span>{link.label}</span>
              </div>
              {link.badge && (
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  isActive ? 'bg-red-500 text-white' : 'bg-red-500/20 text-red-400'
                )}>
                  {link.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-border">
        <div className="mb-3 px-4 py-2">
          <p className="font-medium text-white text-sm truncate">{user?.email}</p>
          <p className="text-xs text-zinc-500 capitalize flex items-center gap-1">
            {user?.role === 'owner' && <AlertCircle size={10} className="text-amber-500" />}
            {user?.role}
          </p>
        </div>
        <Button
          onClick={signOut}
          variant="ghost"
          className="w-full justify-start gap-3 text-zinc-400 hover:text-white hover:bg-white/5"
        >
          <LogOut size={18} />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
