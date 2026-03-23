'use client';

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Bell, BellRing, X, CalendarPlus, CalendarCheck, CalendarX,
  UserPlus, Lightbulb, CheckCheck, AlertTriangle,
} from 'lucide-react';
import { AppNotification } from '@/lib/types';
import { getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead } from '@/lib/api';
import { useBadges } from '@/hooks/useBadges';

// ── Icon map ────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ReactNode> = {
  UserPlus:       <UserPlus size={15} />,
  CalendarPlus:   <CalendarPlus size={15} />,
  CalendarCheck:  <CalendarCheck size={15} />,
  CalendarX:      <CalendarX size={15} />,
  Lightbulb:      <Lightbulb size={15} />,
  Bell:           <Bell size={15} />,
  BellRing:       <BellRing size={15} />,
  AlertTriangle:  <AlertTriangle size={15} />,
};

const ICON_COLOR: Record<string, string> = {
  high:      'text-blue-400 bg-blue-500/10',
  normal:    'text-zinc-400 bg-white/[0.06]',
  low:       'text-zinc-500 bg-white/[0.04]',
  escalation:'text-orange-400 bg-orange-500/10',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getLink(n: AppNotification): string | null {
  if (n.resourceType === 'appointment') return n.resourceId ? `/appointments?hl=${n.resourceId}` : '/appointments';
  if (n.resourceType === 'contact')     return n.resourceId ? `/contacts?hl=${n.resourceId}` : '/contacts';
  if (n.resourceType === 'insights')    return '/insights';
  if (n.resourceType === 'session')     return '/live';
  if (n.type === 'escalation')          return '/live';
  return null;
}

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const min  = Math.floor(diff / 60000);
    const hr   = Math.floor(diff / 3600000);
    const day  = Math.floor(diff / 86400000);
    if (min < 1)  return 'przed chwilą';
    if (min < 60) return `${min} min temu`;
    if (hr  < 24) return `${hr} godz. temu`;
    if (day < 7)  return `${day} dni temu`;
    return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  } catch { return ''; }
}

function groupByDate(notifications: AppNotification[]) {
  const today     = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const groups: { label: string; items: AppNotification[] }[] = [];
  const map: Record<string, AppNotification[]> = {};
  for (const n of notifications) {
    const d = new Date(n.createdAt); d.setHours(0, 0, 0, 0);
    let label: string;
    if (d.getTime() === today.getTime())          label = 'Dzisiaj';
    else if (d.getTime() === yesterday.getTime()) label = 'Wczoraj';
    else label = d.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
    if (!map[label]) { map[label] = []; groups.push({ label, items: map[label] }); }
    map[label].push(n);
  }
  return groups;
}

// ── Position calculation ─────────────────────────────────────────────────────

const PANEL_W = 360;
const PANEL_H = 480;
const GAP     = 8;

function calcPosition(btn: HTMLButtonElement) {
  const r = btn.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Prefer opening to the right (sidebar on the left)
  if (r.right + GAP + PANEL_W <= vw) {
    return {
      left:   r.right + GAP,
      top:    Math.max(GAP, Math.min(r.top, vh - PANEL_H - GAP)),
      origin: 'left top',
    };
  }
  // Open to the left
  if (r.left - GAP - PANEL_W >= 0) {
    return {
      left:   r.left - PANEL_W - GAP,
      top:    Math.max(GAP, Math.min(r.top, vh - PANEL_H - GAP)),
      origin: 'right top',
    };
  }
  // Fallback: below or above, horizontally aligned with button
  const left = Math.max(GAP, Math.min(r.left, vw - PANEL_W - GAP));
  if (r.bottom + GAP + PANEL_H <= vh) {
    return { left, top: r.bottom + GAP, origin: 'top left' };
  }
  return { left, top: Math.max(GAP, r.top - PANEL_H - GAP), origin: 'bottom left' };
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props { clientId: string; }

export default function NotificationBell({ clientId }: Props) {
  const router = useRouter();
  const { setUnreadNotifCount } = useBadges();
  const [open, setOpen]               = useState(false);
  const [notifications, setNotif]     = useState<AppNotification[]>([]);
  const [unreadCount, setUnread]      = useState(0);
  const [loading, setLoading]         = useState(false);
  const [hasHighPriority, setHighPri] = useState(false);
  const [pos, setPos]                 = useState<{ top: number; left: number; origin: string } | null>(null);
  const [mounted, setMounted]         = useState(false);
  const btnRef      = useRef<HTMLButtonElement>(null);
  const panelRef    = useRef<HTMLDivElement>(null);
  const seenIdsRef  = useRef<Set<string> | null>(null); // null = first fetch not done yet
  const bellAnim    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ringing, setRinging] = useState(false);

  useEffect(() => setMounted(true), []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function ringBell() {
    setRinging(true);
    if (bellAnim.current) clearTimeout(bellAnim.current);
    bellAnim.current = setTimeout(() => setRinging(false), 2000);
  }

  function showBrowserPush(n: AppNotification) {
    if (typeof window === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    try {
      new Notification(n.title, {
        body: n.body ?? undefined,
        icon: '/favicon.ico',
        tag:  n.notificationId,
      });
    } catch { /* ignore */ }
  }

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchNotif = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getNotifications(clientId);
      const incoming: AppNotification[] = data.notifications;

      // First fetch: populate seen set silently (no alerts on page load)
      if (seenIdsRef.current === null) {
        seenIdsRef.current = new Set(incoming.map(n => n.notificationId));
      } else {
        // Detect newly arrived unread notifications
        const newOnes = incoming.filter(
          n => !n.read && !seenIdsRef.current!.has(n.notificationId)
        );
        if (newOnes.length > 0) {
          ringBell();
          const first = newOnes[0];
          toast(first.title + (first.body ? `\n${first.body}` : ''), {
            icon: '🔔',
            duration: 6000,
          });
          // Browser push when tab is hidden
          if (document.visibilityState === 'hidden') {
            showBrowserPush(first);
          }
        }
        // Add all incoming to seen (even if read — prevents re-alerting on mark-read)
        for (const n of incoming) seenIdsRef.current!.add(n.notificationId);
      }

      setNotif(incoming);
      setUnread(data.unreadCount);
      setUnreadNotifCount(data.unreadCount);
      setHighPri(incoming.some(n => !n.read && n.priority === 'high'));
    } catch { /* ignore */ } finally {
      if (!silent) setLoading(false);
    }
  }, [clientId]);

  // Lightweight poll — only fetches unread count; triggers full fetch on new notifications
  const pollCount = useCallback(async () => {
    try {
      const data = await getUnreadCount(clientId);
      const newCount = data.unreadCount;
      setUnread(prev => {
        if (newCount > prev) {
          // New notifications arrived — full fetch for toast + data
          fetchNotif(true);
        }
        setUnreadNotifCount(newCount);
        return newCount;
      });
    } catch { /* ignore */ }
  }, [clientId, fetchNotif]);

  useEffect(() => {
    fetchNotif();
    // Lightweight poll (just count); full fetch triggered only when count increases
    const id = setInterval(pollCount, 10000);
    // Re-fetch immediately when tab becomes visible again
    const onVisible = () => { if (document.visibilityState === 'visible') fetchNotif(true); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchNotif, pollCount]);

  // ── Position — synchronous, before paint ───────────────────────────────────
  // useLayoutEffect fires after DOM mutation but before the browser paints,
  // so the panel is never visible at position (0,0).

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    setPos(calcPosition(btnRef.current));
  }, [open]);

  // Re-fetch on open (separate from positioning)
  useEffect(() => {
    if (open) fetchNotif();
  }, [open, fetchNotif]);

  // ── Close on outside click / ESC ───────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        panelRef.current  && !panelRef.current.contains(t) &&
        btnRef.current    && !btnRef.current.contains(t)
      ) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleClick = async (n: AppNotification) => {
    if (!n.read) {
      await markNotificationRead(clientId, n.notificationId).catch(() => {});
      setNotif(prev => prev.map(x => x.notificationId === n.notificationId ? { ...x, read: true } : x));
      setUnread(prev => { const next = Math.max(0, prev - 1); setUnreadNotifCount(next); return next; });
    }
    const link = getLink(n);
    if (link) { setOpen(false); router.push(link); }
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead(clientId).catch(() => {});
    setNotif(prev => prev.map(x => ({ ...x, read: true })));
    setUnread(0);
    setUnreadNotifCount(0);
    setHighPri(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const groups = groupByDate(notifications);

  const panel = open && pos && (
    <div
      ref={panelRef}
      style={{
        position:        'fixed',
        zIndex:          200,
        top:             pos.top,
        left:            pos.left,
        width:           PANEL_W,
        transformOrigin: pos.origin,
      }}
      className="
        bg-card border border-border rounded-xl shadow-2xl
        flex flex-col overflow-hidden
        animate-in fade-in zoom-in-95 duration-150 ease-out
      "
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-zinc-400" />
          <span className="text-sm font-semibold text-white">Powiadomienia</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors"
              title="Oznacz wszystkie jako przeczytane"
            >
              <CheckCheck size={14} />
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto max-h-[420px]">
        {loading && notifications.length === 0 && (
          <div className="flex items-center justify-center py-12 text-zinc-600 text-sm">
            Ładowanie…
          </div>
        )}
        {!loading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <div className="w-10 h-10 rounded-full bg-white/[0.04] flex items-center justify-center">
              <Bell size={18} className="text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-500">Wszystko pod kontrolą</p>
            <p className="text-xs text-zinc-600">Brak nowych powiadomień</p>
          </div>
        )}
        {groups.map(({ label, items }) => (
          <div key={label}>
            <div className="px-4 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider bg-white/[0.02]">
              {label}
            </div>
            {items.map(n => (
              <button
                key={n.notificationId}
                onClick={() => handleClick(n)}
                className={`
                  w-full text-left px-4 py-3 flex items-start gap-3
                  border-b border-white/[0.04] last:border-0
                  transition-colors hover:bg-white/[0.04]
                  ${!n.read ? 'bg-blue-500/[0.03]' : ''}
                `}
              >
                <div className={`
                  w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5
                  ${n.type === 'escalation' ? ICON_COLOR.escalation : (ICON_COLOR[n.priority] || ICON_COLOR.normal)}
                `}>
                  {ICON_MAP[n.icon] || ICON_MAP.Bell}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] leading-snug ${n.read ? 'text-zinc-400' : 'text-white font-medium'}`}>
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">{n.body}</p>
                  )}
                  <p className="text-[10px] text-zinc-600 mt-1">{relativeTime(n.createdAt)}</p>
                </div>
                {!n.read && (
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                )}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-2.5 border-t border-border text-[11px] text-zinc-600 text-center">
          Powiadomienia przechowywane przez 30 dni
        </div>
      )}
    </div>
  );

  // ── Push permission ────────────────────────────────────────────────────────

  function handleBellClick() {
    // Ask for browser push permission on first open (if not yet decided)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    setOpen(prev => !prev);
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleBellClick}
        className="relative p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
        aria-label="Powiadomienia"
      >
        {ringing ? (
          <BellRing size={20} className="text-blue-400 bell-ringing" />
        ) : (
          <Bell size={20} />
        )}
        {unreadCount > 0 && (
          <span className={`
            absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1
            rounded-full text-[10px] font-bold leading-4 text-center
            bg-blue-500 text-white
            ${hasHighPriority ? 'animate-pulse' : ''}
          `}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Portal — renders directly in <body>, escapes any overflow/stacking context */}
      {mounted && createPortal(panel, document.body)}
    </div>
  );
}
