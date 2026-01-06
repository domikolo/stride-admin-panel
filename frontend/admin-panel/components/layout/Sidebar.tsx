/**
 * Sidebar Navigation Component
 */

'use client';

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
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const clientLinks = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/conversations', icon: MessageSquare, label: 'Conversations' },
    { href: '/appointments', icon: Calendar, label: 'Appointments' },
    { href: '/insights', icon: Flame, label: 'Insights' },
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
        <h1 className="text-2xl font-bold bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-transparent">
          Stride Admin
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                isActive
                  ? 'bg-white text-black font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              )}
            >
              <Icon size={20} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-border">
        <div className="mb-3 px-4 py-2 text-sm text-zinc-400">
          <p className="font-medium text-white">{user?.email}</p>
          <p className="text-xs capitalize">{user?.role}</p>
        </div>
        <Button
          onClick={signOut}
          variant="ghost"
          className="w-full justify-start gap-3 text-zinc-400 hover:text-white"
        >
          <LogOut size={20} />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
