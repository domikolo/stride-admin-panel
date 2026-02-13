/**
 * Sidebar Navigation Component - Responsive with mobile support
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
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  onSearchOpen?: () => void;
}

export default function Sidebar({ open, onClose, onSearchOpen }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [gapsCount, setGapsCount] = useState<number>(0);

  useEffect(() => {
    setGapsCount(0);
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

  const handleLinkClick = () => {
    onClose?.();
  };

  const handleSignOut = () => {
    onClose?.();
    signOut();
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'w-64 border-r border-border bg-card h-screen flex flex-col z-50',
          // Mobile: fixed, slide in/out
          'fixed inset-y-0 left-0 transition-transform duration-300 md:transition-none',
          open ? 'translate-x-0' : '-translate-x-full',
          // Desktop: always visible, static
          'md:translate-x-0 md:static'
        )}
      >
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-3" onClick={handleLinkClick}>
            <img
              src="/logo.png"
              alt="Stride"
              className="h-7 w-auto"
            />
          </Link>
        </div>

        {/* Search trigger */}
        <div className="px-4 pt-4 pb-1">
          <button
            onClick={() => { onClose?.(); onSearchOpen?.(); }}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors border border-zinc-800 text-sm"
          >
            <div className="flex items-center gap-3">
              <Search size={16} />
              <span>Search...</span>
            </div>
            <kbd className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">
              ⌘K
            </kbd>
          </button>
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
                onClick={handleLinkClick}
                className={cn(
                  'flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200',
                  isActive
                    ? 'bg-blue-500/[0.08] text-white font-semibold border-l-2 border-blue-500'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] border-l-2 border-transparent'
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon size={20} />
                  <span>{link.label}</span>
                </div>
                {link.badge && (
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    'bg-red-500/20 text-red-400'
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
            <span className="text-[10px] text-zinc-500 capitalize border border-zinc-700 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 mt-0.5">
              {user?.role === 'owner' && <AlertCircle size={10} className="text-amber-500" />}
              {user?.role}
            </span>
          </div>
          <Button
            onClick={handleSignOut}
            variant="ghost"
            className="w-full justify-start gap-3 text-zinc-600 hover:text-zinc-400 hover:bg-transparent"
          >
            <LogOut size={18} />
            Sign Out
          </Button>
        </div>
      </aside>
    </>
  );
}
