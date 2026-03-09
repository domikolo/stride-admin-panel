'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useClientId } from '@/hooks/useClientId';
import { getClientConversations, getClientContacts, getClientAppointments } from '@/lib/api';
import { Conversation, ContactProfile, Appointment } from '@/lib/types';
import {
  LayoutDashboard, MessageSquare, Calendar, Flame, Clock,
  Search, Users, Radio, BookOpen, Settings, Rocket,
  User, Phone, Mail, Loader2,
} from 'lucide-react';

// ─── Static nav items ─────────────────────────────────────────────────────────

interface NavItem {
  kind: 'nav';
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  section: string;
  keywords?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { kind: 'nav', label: 'Dashboard',           href: '/dashboard',              icon: LayoutDashboard, section: 'Nawigacja', keywords: ['panel', 'home', 'glowna'] },
  { kind: 'nav', label: 'Rozmowy',             href: '/conversations',           icon: MessageSquare,   section: 'Nawigacja', keywords: ['conversations', 'chat', 'wiadomosci'] },
  { kind: 'nav', label: 'Live',                href: '/live',                    icon: Radio,           section: 'Nawigacja', keywords: ['monitoring', 'real-time'] },
  { kind: 'nav', label: 'Spotkania',           href: '/appointments',            icon: Calendar,        section: 'Nawigacja', keywords: ['appointments', 'kalendarz'] },
  { kind: 'nav', label: 'Insights - Wczoraj', href: '/insights?period=daily',   icon: Clock,           section: 'Insights',  keywords: ['daily', 'trending', 'pytania'] },
  { kind: 'nav', label: 'Insights - 7 dni',   href: '/insights?period=weekly',  icon: Flame,           section: 'Insights',  keywords: ['weekly', 'tygodniowe'] },
  { kind: 'nav', label: 'Insights - 30 dni',  href: '/insights?period=monthly', icon: Flame,           section: 'Insights',  keywords: ['monthly', 'miesieczne'] },
  { kind: 'nav', label: 'Baza Wiedzy',         href: '/knowledge-base',          icon: BookOpen,        section: 'Nawigacja', keywords: ['kb', 'artykuly', 'knowledge'] },
  { kind: 'nav', label: 'Kontakty',            href: '/contacts',                icon: Users,           section: 'Nawigacja', keywords: ['crm', 'leady'] },
  { kind: 'nav', label: 'Ustawienia',          href: '/settings',                icon: Settings,        section: 'Nawigacja', keywords: ['konfiguracja', 'profil'] },
  { kind: 'nav', label: 'Pierwsze kroki',      href: '/getting-started',         icon: Rocket,          section: 'Nawigacja', keywords: ['help', 'guide', 'pomoc'] },
];

// ─── Data result types ────────────────────────────────────────────────────────

interface DataResult {
  kind: 'conversation' | 'contact' | 'appointment';
  id: string;
  label: string;
  sublabel?: string;
  targetId: string;
}

type AnyItem = (NavItem | DataResult) & { globalIndex: number };

interface Section {
  name: string;
  items: AnyItem[];
}

const SECTION_ORDER: Record<string, number> = {
  Nawigacja: 0, Insights: 1, Kontakty: 2, Rozmowy: 3, Spotkania: 4,
};

const KIND_ICON: Record<string, typeof User> = {
  contact: User,
  conversation: MessageSquare,
  appointment: Calendar,
};

const KIND_SECTION: Record<string, string> = {
  contact: 'Kontakty',
  conversation: 'Rozmowy',
  appointment: 'Spotkania',
};

const KIND_COLOR: Record<string, string> = {
  contact: 'text-fuchsia-400',
  conversation: 'text-sky-400',
  appointment: 'text-violet-400',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a ~60-char excerpt centred on the first match, or empty string. */
function matchSnippet(fields: (string | undefined | null)[], q: string): string {
  const ql = q.toLowerCase();
  for (const f of fields) {
    if (!f) continue;
    const idx = f.toLowerCase().indexOf(ql);
    if (idx === -1) continue;
    const s = Math.max(0, idx - 28);
    const e = Math.min(f.length, idx + q.length + 28);
    return (s > 0 ? '…' : '') + f.slice(s, e) + (e < f.length ? '…' : '');
  }
  return '';
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SearchDialog({ open, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Cached datasets — loaded once per open, cleared on close
  const [dataLoading, setDataLoading] = useState(false);
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [allContacts, setAllContacts]           = useState<ContactProfile[]>([]);
  const [allAppointments, setAllAppointments]   = useState<Appointment[]>([]);
  const dataLoadedRef = useRef(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const clientId = useClientId();

  // Reset & load data on open
  useEffect(() => {
    if (!open) {
      dataLoadedRef.current = false;
      return;
    }
    setQuery('');
    setSelectedIndex(0);
    setTimeout(() => inputRef.current?.focus(), 50);

    if (dataLoadedRef.current || !clientId) return;
    setDataLoading(true);
    Promise.all([
      getClientConversations(clientId, 500),
      getClientContacts(clientId, { limit: 500 }),
      getClientAppointments(clientId),
    ]).then(([convResp, contactResp, apptResp]) => {
      setAllConversations(convResp.conversations || []);
      setAllContacts(contactResp.contacts || []);
      setAllAppointments(apptResp.appointments || []);
      dataLoadedRef.current = true;
    }).catch(() => {
      dataLoadedRef.current = true; // don't retry
    }).finally(() => {
      setDataLoading(false);
    });
  }, [open, clientId]);

  // Reset selection on query change
  useEffect(() => { setSelectedIndex(0); }, [query]);

  // ── Build results ────────────────────────────────────────────────────────────

  const dataResults = useMemo<DataResult[]>(() => {
    const q = query.trim();
    if (q.length < 2) return [];

    const results: DataResult[] = [];

    // Conversations
    for (const conv of allConversations) {
      const fields = [
        conv.preview, conv.keywords,
        conv.adminNotes, conv.adminTags?.join(' '), conv.sessionId,
      ];
      const snippet = matchSnippet(fields, q);
      if (!snippet) continue;
      results.push({
        kind: 'conversation',
        id: conv.sessionId,
        label: (conv.preview || conv.sessionId).slice(0, 70),
        sublabel: snippet,
        targetId: conv.sessionId,
      });
    }

    // Contacts
    for (const c of allContacts) {
      const fields = [c.displayName, c.contactInfo, c.notes, c.tags?.join(' ')];
      const snippet = matchSnippet(fields, q);
      if (!snippet) continue;
      results.push({
        kind: 'contact',
        id: c.profileId,
        label: c.displayName || c.contactInfo,
        sublabel: snippet,
        targetId: c.profileId,
      });
    }

    // Appointments
    for (const a of allAppointments) {
      const fields = [
        a.contactInfo?.name, a.contactInfo?.email,
        a.contactInfo?.phone, a.notes,
      ];
      const snippet = matchSnippet(fields, q);
      if (!snippet) continue;
      results.push({
        kind: 'appointment',
        id: a.appointmentId,
        label: a.contactInfo?.name || a.contactInfo?.email || a.contactInfo?.phone || 'Wizyta',
        sublabel: snippet || a.datetime?.slice(0, 10),
        targetId: a.appointmentId,
      });
    }

    return results;
  }, [query, allConversations, allContacts, allAppointments]);

  // ── Build combined list ───────────────────────────────────────────────────────

  const allItems: AnyItem[] = useMemo(() => {
    const trimmed = query.trim().toLowerCase();

    const navFiltered: NavItem[] = trimmed.length < 2
      ? NAV_ITEMS
      : NAV_ITEMS.filter(item =>
          item.label.toLowerCase().includes(trimmed) ||
          item.section.toLowerCase().includes(trimmed) ||
          item.keywords?.some(k => k.includes(trimmed))
        );

    const combined: (NavItem | DataResult)[] = [...navFiltered, ...dataResults];
    const sectionMap = new Map<string, (NavItem | DataResult)[]>();
    for (const item of combined) {
      const sec = item.kind === 'nav' ? (item as NavItem).section : KIND_SECTION[item.kind];
      if (!sectionMap.has(sec)) sectionMap.set(sec, []);
      sectionMap.get(sec)!.push(item);
    }
    const sorted = Array.from(sectionMap.entries()).sort(
      ([a], [b]) => (SECTION_ORDER[a] ?? 99) - (SECTION_ORDER[b] ?? 99)
    );
    let idx = 0;
    return sorted.flatMap(([, items]) => items.map(item => ({ ...item, globalIndex: idx++ })));
  }, [query, dataResults]);

  const sections: Section[] = useMemo(() => {
    const map = new Map<string, AnyItem[]>();
    for (const item of allItems) {
      const sec = item.kind === 'nav' ? (item as NavItem).section : KIND_SECTION[item.kind];
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(item);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (SECTION_ORDER[a] ?? 99) - (SECTION_ORDER[b] ?? 99))
      .map(([name, items]) => ({ name, items }));
  }, [allItems]);

  // ── Navigation ────────────────────────────────────────────────────────────────

  const navigate = useCallback((item: AnyItem) => {
    onClose();
    if (item.kind === 'nav') {
      router.push((item as NavItem).href);
      return;
    }
    const q = query.trim();
    if (q.length >= 2) {
      sessionStorage.setItem('searchHighlight', JSON.stringify({
        query: q,
        targetId: (item as DataResult).targetId,
        type: item.kind,
      }));
    }
    if (item.kind === 'conversation') router.push('/conversations');
    else if (item.kind === 'contact')  router.push('/contacts');
    else if (item.kind === 'appointment') router.push('/appointments');
  }, [onClose, router, query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && allItems[selectedIndex]) {
      e.preventDefault();
      navigate(allItems[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [allItems, selectedIndex, navigate, onClose]);

  if (!open) return null;

  const loading = dataLoading;
  const hasQuery = query.trim().length >= 2;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed inset-0 z-[101] flex items-start justify-center pt-[18vh]">
        <div
          className="w-full max-w-lg bg-popover border border-border rounded-xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            {loading
              ? <Loader2 size={17} className="text-zinc-500 flex-shrink-0 animate-spin" />
              : <Search size={17} className="text-zinc-500 flex-shrink-0" />
            }
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Szukaj kontaktów, rozmów, spotkań..."
              className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">ESC</kbd>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto py-1.5">
            {loading && !hasQuery ? (
              <p className="text-sm text-muted-foreground text-center py-8">Ładowanie danych…</p>
            ) : allItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {hasQuery ? 'Brak wyników' : 'Wpisz frazę aby wyszukać'}
              </p>
            ) : (
              sections.map(section => (
                <div key={section.name}>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold px-4 py-1.5 mt-1">
                    {section.name}
                  </p>
                  {section.items.map(item => {
                    const isSelected = item.globalIndex === selectedIndex;
                    const isNav = item.kind === 'nav';
                    const Icon = isNav ? (item as NavItem).icon : KIND_ICON[item.kind] ?? Search;
                    const colorClass = isNav ? '' : KIND_COLOR[item.kind] ?? '';

                    return (
                      <button
                        key={`${item.kind}-${isNav ? (item as NavItem).href : (item as DataResult).id}`}
                        onClick={() => navigate(item)}
                        onMouseEnter={() => setSelectedIndex(item.globalIndex)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          isSelected ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                        }`}
                      >
                        <Icon size={15} className={`flex-shrink-0 ${colorClass}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate text-foreground">{item.label}</p>
                          {!isNav && (item as DataResult).sublabel && (
                            <p className="text-[11px] text-muted-foreground truncate">
                              {(item as DataResult).sublabel}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-muted-foreground">
            <span><kbd className="bg-muted px-1 py-0.5 rounded border border-border mr-1">↑↓</kbd>nawigacja</span>
            <span><kbd className="bg-muted px-1 py-0.5 rounded border border-border mr-1">↵</kbd>otwórz</span>
            {hasQuery && (
              <span className="ml-auto">
                {loading ? 'ładuję…' : dataResults.length > 0
                  ? `${dataResults.length} wynik${dataResults.length === 1 ? '' : dataResults.length < 5 ? 'i' : 'ów'}`
                  : 'brak wyników'}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
