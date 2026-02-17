/**
 * Sidebar Navigation Component - Responsive with mobile support + collapsed mode on tablets
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
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
    { href: '/knowledge-base', icon: BookOpen, label: 'Baza Wiedzy' },
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
          'border-r border-border bg-card h-screen flex flex-col z-50',
          // Width: collapsed on md, full on lg
          'w-64 md:w-16 lg:w-64',
          // Mobile: fixed, slide in/out
          'fixed inset-y-0 left-0 transition-transform duration-300 md:transition-none',
          open ? 'translate-x-0' : '-translate-x-full',
          // Desktop: always visible, static
          'md:translate-x-0 md:static'
        )}
        style={{
          boxShadow: '1px 0 0 rgba(255,255,255,0.03)',
          borderRight: 'none',
        }}
      >
        {/* Logo */}
        <div className="p-6 md:p-3 lg:p-6 border-b border-white/[0.04]">
          <Link href="/dashboard" className="flex items-center gap-3 md:justify-center lg:justify-start" onClick={handleLinkClick}>
            <img
              src="/logo.png"
              alt="Stride"
              className="h-7 w-auto md:h-6 lg:h-7"
            />
          </Link>
        </div>

        {/* Search trigger */}
        <div className="px-4 pt-4 pb-1 md:px-2 lg:px-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => { onClose?.(); onSearchOpen?.(); }}
                className="w-full flex items-center justify-between md:justify-center lg:justify-between px-4 md:px-0 lg:px-4 py-2.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.04] transition-colors border border-white/[0.08] text-sm"
              >
                <div className="flex items-center gap-3 md:gap-0 lg:gap-3">
                  <Search size={16} />
                  <span className="md:hidden lg:inline">Search...</span>
                </div>
                <kbd className="text-[10px] bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.08] md:hidden lg:inline-block">
                  ⌘K
                </kbd>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="md:block lg:hidden hidden">
              Search (⌘K)
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 md:p-2 lg:p-4 space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/');

            return (
              <Tooltip key={link.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={link.href}
                    onClick={handleLinkClick}
                    className={cn(
                      'flex items-center justify-between md:justify-center lg:justify-between px-4 md:px-0 lg:px-4 py-3 rounded-lg transition-all duration-200 relative',
                      isActive
                        ? 'bg-blue-500/[0.08] text-blue-400 md:text-blue-400 lg:text-white font-semibold border-l-2 md:border-l-0 lg:border-l-2 border-blue-500'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border-l-2 md:border-l-0 lg:border-l-2 border-transparent'
                    )}
                  >
                    <div className="flex items-center gap-3 md:gap-0 lg:gap-3">
                      <Icon size={20} />
                      <span className="md:hidden lg:inline">{link.label}</span>
                    </div>
                    {/* Active indicator dot for collapsed sidebar */}
                    {isActive && (
                      <span className="hidden md:block lg:hidden absolute -right-0.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500" />
                    )}
                    {link.badge && (
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full md:hidden lg:inline-block',
                        'bg-orange-500/20 text-orange-400'
                      )}>
                        {link.badge}
                      </span>
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="md:block lg:hidden hidden">
                  {link.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 md:p-2 lg:p-4 border-t border-white/[0.04]">
          <div className="mb-3 px-4 py-2 md:px-0 md:text-center lg:px-4 lg:text-left">
            <p className="font-medium text-white text-sm truncate md:hidden lg:block">{user?.email}</p>
            <span className="text-[10px] text-zinc-500 capitalize border border-white/[0.08] px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 mt-0.5 md:hidden lg:inline-flex">
              {user?.role === 'owner' && <AlertCircle size={10} className="text-amber-500" />}
              {user?.role}
            </span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleSignOut}
                variant="ghost"
                className="w-full justify-start md:justify-center lg:justify-start gap-3 md:gap-0 lg:gap-3 text-zinc-600 hover:text-zinc-400 hover:bg-transparent"
              >
                <LogOut size={18} />
                <span className="md:hidden lg:inline">Sign Out</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="md:block lg:hidden hidden">
              Sign Out
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </>
  );
}
