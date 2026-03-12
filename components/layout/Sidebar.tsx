/**
 * Sidebar Navigation — collapsible, grouped nav, settings pinned to bottom
 *
 * Layout rules:
 *  - Expanded (224px): header = logo + bell, nav = labels + icons, toggle at bottom of nav
 *  - Collapsed (56px): header = icon logo only (centered), nav = icons only, toggle at bottom
 *  - Mobile: fixed slide-in overlay, always expanded, no toggle
 */

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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

const ownerGroup = {
  label: 'Platforma',
  items: [
    { href: '/clients', icon: Building2, label: 'Klienci' },
  ],
};

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
            'flex items-center gap-3 px-2 py-2 rounded-lg transition-colors duration-150 relative group text-[13px]',
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
          {!collapsed && <span className="relative truncate leading-none">{label}</span>}
          {isActive && collapsed && (
            <span className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500" />
          )}
        </Link>
      </TooltipTrigger>
      {collapsed && <TooltipContent side="right">{label}</TooltipContent>}
    </Tooltip>
  );
}

function SectionDivider({ label, collapsed }: { label: string; collapsed: boolean }) {
  return (
    <div className="relative pt-3 pb-1 px-2">
      <p
        className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 select-none transition-opacity duration-200"
        style={{ opacity: collapsed ? 0 : 1 }}
      >
        {label}
      </p>
      <div
        className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-px bg-white/[0.08] transition-opacity duration-200"
        style={{ opacity: collapsed ? 1 : 0 }}
      />
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function Sidebar({ open, onClose, onSearchOpen }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, signOut } = useAuth();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const logoFilter  = mounted && resolvedTheme === 'light' ? 'brightness(0)' : undefined;
  const iconLogoSrc = mounted && resolvedTheme === 'light'
    ? '/icon-logo-czarne.png'
    : '/icon-logo-biale.png';

  // ── Viewport ────────────────────────────────────────────────────────────────
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

  // ── Manual toggle + localStorage ────────────────────────────────────────────
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

  // Width animated by framer-motion; mobile always 256
  const sidebarWidth = isMobile ? 256 : (isCollapsed ? 56 : 224);

  const close    = () => onClose?.();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

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
          'fixed inset-y-0 left-0 transition-transform duration-300 md:static md:transition-none',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {/* ── Header: stable layout, bell fades in/out via opacity ── */}
        <div className="flex items-center justify-between px-3 py-[11px] border-b border-white/[0.06] flex-shrink-0">

          {/* Logo button — wordmark in normal flow gives button its natural width.
              Icon is absolute overlay. Sidebar overflow-hidden clips naturally. */}
          <button
            onClick={() => { if (isMobile) { close(); router.push('/dashboard'); } else { toggle(); } }}
            className="relative flex items-center h-8 flex-shrink-0 focus:outline-none"
            title={isMobile ? undefined : (isCollapsed ? 'Rozwiń panel' : 'Zwiń panel')}
          >
            {/* Full wordmark — in flow, sets button width */}
            <motion.img
              src="/logo.png"
              alt="Stride"
              className="h-5 w-auto pointer-events-none"
              style={logoFilter ? { filter: logoFilter } : undefined}
              animate={{ opacity: isCollapsed ? 0 : 1 }}
              transition={{ duration: 0.2 }}
            />
            {/* Icon logo — absolute overlay, same anchor */}
            <motion.img
              src={iconLogoSrc}
              alt="Stride"
              className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8 object-contain pointer-events-none"
              animate={{ opacity: isCollapsed ? 1 : 0 }}
              transition={{ duration: 0.2, delay: isCollapsed ? 0.1 : 0 }}
            />
          </button>

          {/* Bell — always in DOM, fades with opacity so header layout stays stable */}
          <motion.div
            animate={{ opacity: isCollapsed ? 0 : 1 }}
            transition={{ duration: 0.2 }}
            style={{ pointerEvents: isCollapsed ? 'none' : 'auto' }}
          >
            <NotificationBell clientId={user?.clientId || 'stride-services'} />
          </motion.div>
        </div>

        {/* ── Search ──────────────────────────────────────────────── */}
        <div className="flex-shrink-0 pt-3 pb-1 px-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => { close(); onSearchOpen?.(); }}
                className={cn(
                  'w-full flex items-center py-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-all border border-white/[0.06] text-[13px] px-2',
                  !isCollapsed && 'justify-between'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Search size={15} className="flex-shrink-0" />
                  {!isCollapsed && <span className="text-zinc-500 leading-none">Szukaj...</span>}
                </div>
                {!isCollapsed && (
                  <kbd className="text-[10px] bg-white/[0.04] text-zinc-600 px-1.5 py-0.5 rounded border border-white/[0.06] font-mono leading-none">
                    ⌘K
                  </kbd>
                )}
              </button>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">Szukaj (⌘K)</TooltipContent>}
          </Tooltip>
        </div>

        {/* ── Navigation (scrollable) ──────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2">

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
        <div className="border-t border-white/[0.06] flex-shrink-0 py-2 px-2">
          <div className={cn(
            'h-[38px] flex px-2 min-w-0',
            isCollapsed ? 'items-center justify-center' : 'flex-col justify-center'
          )}>
            {isCollapsed ? (
              <span className="text-zinc-500 text-[13px] leading-none">@</span>
            ) : (
              <>
                <p className="font-medium text-white text-[12px] truncate leading-none">{user?.email}</p>
                <span className="text-[10px] text-zinc-600 capitalize leading-none mt-1 block">{user?.role}</span>
              </>
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => { close(); signOut(); }}
                variant="ghost"
                className={cn(
                  'text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] h-8 text-[12px] w-full',
                  isCollapsed ? 'px-0 justify-center' : 'justify-start gap-2.5 px-2'
                )}
              >
                <LogOut size={15} />
                {!isCollapsed && <span className="leading-none">Wyloguj się</span>}
              </Button>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">Wyloguj się</TooltipContent>}
          </Tooltip>
        </div>
      </motion.aside>
    </>
  );
}
