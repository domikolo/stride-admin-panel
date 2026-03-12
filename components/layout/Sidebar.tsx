/**
 * Sidebar Navigation — grouped nav, manual collapse toggle, settings pinned to bottom
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
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
  Settings,
  Rocket,
  Building2,
  PanelLeft,
  PanelLeftClose,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import NotificationBell from '@/components/layout/NotificationBell';

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  onSearchOpen?: () => void;
}

// ─── Nav groups ──────────────────────────────────────────────────────────────

const mainGroup = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/live',       icon: Radio,            label: 'Live'      },
];

const clientGroup = {
  label: 'Klienci',
  items: [
    { href: '/conversations', icon: MessageSquare, label: 'Rozmowy'   },
    { href: '/appointments',  icon: Calendar,      label: 'Spotkania' },
    { href: '/contacts',      icon: Users,         label: 'Kontakty'  },
  ],
};

const contentGroup = {
  label: 'Treści',
  items: [
    { href: '/insights',        icon: Flame,    label: 'Insights'    },
    { href: '/knowledge-base',  icon: BookOpen, label: 'Baza Wiedzy' },
  ],
};

// owner-only
const ownerGroup = {
  label: 'Platforma',
  items: [
    { href: '/clients', icon: Building2, label: 'Klienci' },
  ],
};

// always at the bottom
const bottomLinks = [
  { href: '/getting-started', icon: Rocket,   label: 'Pierwsze kroki' },
  { href: '/settings',        icon: Settings, label: 'Ustawienia'     },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

interface NavLinkProps {
  href: string;
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
}

function NavLink({ href, icon: Icon, label, isActive, collapsed, onClick }: NavLinkProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          onClick={onClick}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-150 relative group text-[13px]',
            collapsed && 'justify-center px-0',
            isActive
              ? 'text-white font-medium'
              : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]'
          )}
        >
          {isActive && (
            <motion.span
              layoutId="sidebar-active"
              className="absolute inset-0 bg-white/[0.08] rounded-lg"
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            />
          )}
          <Icon
            size={17}
            className={cn(
              'relative flex-shrink-0',
              isActive ? 'text-blue-400' : 'text-zinc-500 group-hover:text-zinc-300'
            )}
          />
          {!collapsed && <span className="relative truncate">{label}</span>}
          {isActive && collapsed && (
            <span className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500" />
          )}
        </Link>
      </TooltipTrigger>
      {collapsed && (
        <TooltipContent side="right">{label}</TooltipContent>
      )}
    </Tooltip>
  );
}

interface SectionProps {
  label: string;
  collapsed: boolean;
}

function SectionDivider({ label, collapsed }: SectionProps) {
  return (
    <div className={cn('pt-3 pb-1', collapsed ? 'px-2' : 'px-3')}>
      {collapsed
        ? <div className="h-px bg-white/[0.06]" />
        : <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 select-none">{label}</p>
      }
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

const LOGO_EXPANDED_W = 90; // approximate px width of /logo.png at h-6

export default function Sidebar({ open, onClose, onSearchOpen }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const logoFilter    = mounted && resolvedTheme === 'light' ? 'brightness(0)' : undefined;
  const iconLogoSrc   = mounted && resolvedTheme === 'light'
    ? '/icon-logo-czarne.png'
    : '/icon-logo-biale.png';

  // ── Viewport awareness ──────────────────────────────────────────────────────
  const [autoCollapsed, setAutoCollapsed] = useState(false);
  const [isMobile, setIsMobile]           = useState(false);

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setAutoCollapsed(w >= 768 && w < 1024);
      setIsMobile(w < 768);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ── Manual toggle with localStorage ────────────────────────────────────────
  const [userCollapsed, setUserCollapsed] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored !== null) setUserCollapsed(stored === 'true');
  }, []);

  const isCollapsed = userCollapsed !== null ? userCollapsed : autoCollapsed;

  const toggle = () => {
    const next = !isCollapsed;
    setUserCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
  };

  // Width driven by framer-motion; mobile is always full-width overlay
  const sidebarWidth = isMobile ? 256 : (isCollapsed ? 56 : 224);

  const close    = () => onClose?.();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const getInitials = (email?: string) => {
    if (!email) return '?';
    const parts = email.split('@')[0].split(/[._-]/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return email[0].toUpperCase();
  };

  const isOwner = user?.role === 'owner';

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <motion.aside
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className={cn(
          'bg-card flex flex-col z-50 border-r border-border',
          'h-screen overflow-hidden flex-shrink-0',
          // Mobile: fixed slide-in overlay; desktop: static in flex row
          'fixed inset-y-0 left-0 transition-transform duration-300 md:static md:transition-none',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {/* ── Logo + Bell + Toggle ─────────────────────────────── */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] flex-shrink-0 px-3 py-3">

          {/* Logo area — crossfade between wordmark and icon logo */}
          <Link
            href="/dashboard"
            onClick={close}
            className="relative h-6 flex-shrink-0 overflow-hidden"
            style={{
              width: isCollapsed ? '24px' : `${LOGO_EXPANDED_W}px`,
              transition: 'width 250ms ease-in-out',
            }}
          >
            {/* Full wordmark */}
            <motion.img
              src="/logo.png"
              alt="Stride"
              className="absolute left-0 top-0 h-6 w-auto pointer-events-none"
              style={logoFilter ? { filter: logoFilter } : undefined}
              animate={{ opacity: isCollapsed ? 0 : 1 }}
              transition={{ duration: 0.15 }}
            />
            {/* Icon logo */}
            <motion.img
              src={iconLogoSrc}
              alt="Stride"
              className="absolute left-0 top-0 h-6 w-6 object-contain pointer-events-none"
              animate={{ opacity: isCollapsed ? 1 : 0 }}
              transition={{ duration: 0.15, delay: isCollapsed ? 0.06 : 0 }}
            />
          </Link>

          {/* Bell + collapse toggle */}
          <div className="ml-auto flex items-center gap-0.5">
            <NotificationBell clientId={user?.clientId || 'stride-services'} />

            {/* Toggle button — desktop only */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggle}
                  className="hidden md:flex items-center justify-center p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors"
                >
                  {isCollapsed
                    ? <PanelLeft size={14} />
                    : <PanelLeftClose size={14} />
                  }
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {isCollapsed ? 'Rozwiń panel' : 'Zwiń panel'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* ── Search ──────────────────────────────────────────────── */}
        <div className={cn('flex-shrink-0 pt-3 pb-1', isCollapsed ? 'px-2' : 'px-3')}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => { close(); onSearchOpen?.(); }}
                className={cn(
                  'w-full flex items-center py-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-all border border-white/[0.06] text-[13px]',
                  isCollapsed ? 'justify-center px-0' : 'justify-between px-3'
                )}
              >
                <div className={cn('flex items-center', isCollapsed ? 'gap-0' : 'gap-2.5')}>
                  <Search size={15} className="flex-shrink-0" />
                  {!isCollapsed && <span className="text-zinc-500">Szukaj...</span>}
                </div>
                {!isCollapsed && (
                  <kbd className="text-[10px] bg-white/[0.04] text-zinc-600 px-1.5 py-0.5 rounded border border-white/[0.06] font-mono">
                    ⌘K
                  </kbd>
                )}
              </button>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">Szukaj (⌘K)</TooltipContent>}
          </Tooltip>
        </div>

        {/* ── Navigation (scrollable) ──────────────────────────────── */}
        <nav className={cn('flex-1 overflow-y-auto py-2', isCollapsed ? 'px-2' : 'px-3')}>

          <div className="space-y-0.5">
            {mainGroup.map(link => (
              <NavLink key={link.href} {...link} isActive={isActive(link.href)} collapsed={isCollapsed} onClick={close} />
            ))}
          </div>

          <SectionDivider label={clientGroup.label} collapsed={isCollapsed} />
          <div className="space-y-0.5">
            {clientGroup.items.map(link => (
              <NavLink key={link.href} {...link} isActive={isActive(link.href)} collapsed={isCollapsed} onClick={close} />
            ))}
          </div>

          <SectionDivider label={contentGroup.label} collapsed={isCollapsed} />
          <div className="space-y-0.5">
            {contentGroup.items.map(link => (
              <NavLink key={link.href} {...link} isActive={isActive(link.href)} collapsed={isCollapsed} onClick={close} />
            ))}
          </div>

          {isOwner && (
            <>
              <SectionDivider label={ownerGroup.label} collapsed={isCollapsed} />
              <div className="space-y-0.5">
                {ownerGroup.items.map(link => (
                  <NavLink key={link.href} {...link} isActive={isActive(link.href)} collapsed={isCollapsed} onClick={close} />
                ))}
              </div>
            </>
          )}

          <div className="flex-1" />

          <SectionDivider label="Konfiguracja" collapsed={isCollapsed} />
          <div className="space-y-0.5">
            {bottomLinks.map(link => (
              <NavLink key={link.href} {...link} isActive={isActive(link.href)} collapsed={isCollapsed} onClick={close} />
            ))}
          </div>
        </nav>

        {/* ── User section ─────────────────────────────────────────── */}
        <div className={cn('border-t border-white/[0.06] flex-shrink-0 py-2', isCollapsed ? 'px-2' : 'px-3')}>
          <div className={cn('flex items-center gap-3 px-2 py-2 rounded-lg', isCollapsed && 'justify-center px-0')}>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-white/[0.08] flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-semibold text-blue-400">{getInitials(user?.email)}</span>
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <p className="font-medium text-white text-[12px] truncate leading-tight">{user?.email}</p>
                <span className="text-[10px] text-zinc-600 capitalize">{user?.role}</span>
              </div>
            )}
          </div>

          <div className={cn('flex mt-1', isCollapsed ? 'flex-col gap-0.5 items-center' : 'items-center gap-1')}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={isCollapsed ? '' : 'flex-1'}>
                  <ThemeToggle />
                </div>
              </TooltipTrigger>
              {isCollapsed && <TooltipContent side="right">Zmień motyw</TooltipContent>}
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => { close(); signOut(); }}
                  variant="ghost"
                  className={cn(
                    'text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] h-8 text-[12px]',
                    isCollapsed ? 'w-8 px-0 justify-center' : 'flex-1 justify-start gap-2.5 px-2'
                  )}
                >
                  <LogOut size={15} />
                  {!isCollapsed && <span>Wyloguj się</span>}
                </Button>
              </TooltipTrigger>
              {isCollapsed && <TooltipContent side="right">Wyloguj się</TooltipContent>}
            </Tooltip>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
