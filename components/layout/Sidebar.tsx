/**
 * Sidebar Navigation Component - Responsive with mobile support + collapsed mode on tablets
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
  Search,
  BookOpen,
  Radio,
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

  const clientLinks = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/conversations', icon: MessageSquare, label: 'Rozmowy' },
    { href: '/live', icon: Radio, label: 'Live' },
    { href: '/appointments', icon: Calendar, label: 'Spotkania' },
    { href: '/insights', icon: Flame, label: 'Insights' },
    { href: '/knowledge-base', icon: BookOpen, label: 'Baza Wiedzy' },
  ];

  const ownerLinks = [
    ...clientLinks,
    { href: '/clients', icon: Users, label: 'Klienci' },
  ];

  const links = user?.role === 'owner' ? ownerLinks : clientLinks;

  const handleLinkClick = () => {
    onClose?.();
  };

  const handleSignOut = () => {
    onClose?.();
    signOut();
  };

  // Get user initials for avatar
  const getInitials = (email?: string) => {
    if (!email) return '?';
    const parts = email.split('@')[0].split(/[._-]/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return email[0].toUpperCase();
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'bg-[#0c0c0e] h-screen flex flex-col z-50',
          // Width: collapsed on md, full on lg
          'w-64 md:w-16 lg:w-64',
          // Mobile: fixed, slide in/out
          'fixed inset-y-0 left-0 transition-transform duration-300 md:transition-none',
          open ? 'translate-x-0' : '-translate-x-full',
          // Desktop: always visible, static
          'md:translate-x-0 md:static'
        )}
        style={{
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Logo */}
        <div className="p-6 md:p-3 lg:p-6 border-b border-white/[0.06]">
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
                className="w-full flex items-center justify-between md:justify-center lg:justify-between px-3 md:px-0 lg:px-3 py-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-all duration-150 border border-white/[0.06] text-sm"
              >
                <div className="flex items-center gap-3 md:gap-0 lg:gap-3">
                  <Search size={15} />
                  <span className="md:hidden lg:inline text-zinc-500">Szukaj...</span>
                </div>
                <kbd className="text-[10px] bg-white/[0.04] text-zinc-500 px-1.5 py-0.5 rounded border border-white/[0.06] md:hidden lg:inline-block font-mono">
                  ⌘K
                </kbd>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="md:block lg:hidden hidden">
              Szukaj (⌘K)
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 md:px-2 lg:px-3 space-y-0.5">
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
                      'flex items-center justify-between md:justify-center lg:justify-between px-3 md:px-0 lg:px-3 py-2.5 rounded-lg transition-all duration-150 relative group',
                      isActive
                        ? 'bg-white/[0.08] text-white font-medium'
                        : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]'
                    )}
                  >
                    <div className="flex items-center gap-3 md:gap-0 lg:gap-3">
                      <Icon size={18} className={isActive ? 'text-blue-400' : 'text-zinc-500 group-hover:text-zinc-300'} />
                      <span className="md:hidden lg:inline text-[13px]">{link.label}</span>
                    </div>
                    {/* Active indicator dot for collapsed sidebar */}
                    {isActive && (
                      <span className="hidden md:block lg:hidden absolute -right-0.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500" />
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
        <div className="p-3 md:p-2 lg:p-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 px-3 py-2.5 md:justify-center lg:justify-start rounded-lg">
            {/* Avatar with initials */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-white/[0.08] flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-semibold text-blue-400">{getInitials(user?.email)}</span>
            </div>
            <div className="md:hidden lg:block min-w-0">
              <p className="font-medium text-white text-[13px] truncate">{user?.email}</p>
              <span className="text-[10px] text-zinc-600 capitalize">{user?.role}</span>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleSignOut}
                variant="ghost"
                className="w-full justify-start md:justify-center lg:justify-start gap-3 md:gap-0 lg:gap-3 text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] h-9 px-3 text-[13px]"
              >
                <LogOut size={16} />
                <span className="md:hidden lg:inline">Wyloguj się</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="md:block lg:hidden hidden">
              Wyloguj się
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </>
  );
}
