'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useClientId } from '@/hooks/useClientId';
import { getClientContacts, getClientAppointments, searchGlobal, SearchResult } from '@/lib/api';
import { ContactProfile, Appointment } from '@/lib/types';
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
  convNum?: number; // for conversations: specific conversation number
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

  // Contacts + appointments — loaded once per open, filtered client-side
  const [staticLoading, setStaticLoading] = useState(false);
  const [allContacts, setAllContacts]         = useState<ContactProfile[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const staticLoadedRef = useRef(false);

  // Conversations — backend full-text search, debounced per query
  const [convResults, setConvResults]   = useState<DataResult[]>([]);
  const [convLoading, setConvLoading]   = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const clientId = useClientId();

  // Global Escape listener — closes dialog regardless of which element has focus
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Reset & load static data on open
  useEffect(() => {
    if (!open) {
      staticLoadedRef.current = false;
      setConvResults([]);
      return;
    }
    setQuery('');
    setSelectedIndex(0);
    setConvResults([]);
    setTimeout(() => inputRef.current?.focus(), 50);

    if (staticLoadedRef.current || !clientId) return;
    setStaticLoading(true);
    Promise.all([
      getClientContacts(clientId, { limit: 500 }),
      getClientAppointments(clientId),
    ]).then(([contactResp, apptResp]) => {
      setAllContacts(contactResp.contacts || []);
      setAllAppointments(apptResp.appointments || []);
      staticLoadedRef.current = true;
    }).catch(() => {
      staticLoadedRef.current = true;
    }).finally(() => setStaticLoading(false));
  }, [open, clientId]);

  // Debounced backend search for conversations (full message text)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2 || !clientId) {
      setConvResults([]);
      setConvLoading(false);
      return;
    }
    setConvLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchGlobal(clientId, q);
        const convs = (data.results || [])
          .filter((r: SearchResult) => r.type === 'conversation')
          .map((r: SearchResult) => ({
            kind: 'conversation' as const,
            id: r.id,
            label: r.label,
            sublabel: r.sublabel ?? undefined,
            targetId: r.sessionId ?? r.id,
            convNum: (r as SearchResult & { conversationNumber?: number }).conversationNumber ?? 1,
          }));
        setConvResults(convs);
      } catch {
        setConvResults([]);
      } finally {
        setConvLoading(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, clientId]);

  // Reset selection on query change
  useEffect(() => { setSelectedIndex(0); }, [query]);

  // ── Build client-side results (contacts + appointments only) ─────────────────

  const staticResults = useMemo<DataResult[]>(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    const results: DataResult[] = [];

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
  }, [query, allContacts, allAppointments]);

  const dataResults = useMemo(
    () => [...convResults, ...staticResults],
    [convResults, staticResults]
  );

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
    const q = encodeURIComponent(query.trim());
    const d = item as DataResult;
    if (item.kind === 'conversation') {
      // Open conversation detail — detail page already handles ?highlight= natively
      router.push(`/conversations/${d.targetId}?conversation_number=${d.convNum ?? 1}&highlight=${q}`);
    } else if (item.kind === 'contact') {
      // URL param triggers useSearchParams effect even when already on the page
      router.push(`/contacts?hl=${encodeURIComponent(d.targetId)}&q=${q}`);
    } else if (item.kind === 'appointment') {
      router.push(`/appointments?hl=${encodeURIComponent(d.targetId)}&q=${q}`);
    }
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

  const loading = staticLoading || convLoading;
  const hasQuery = query.trim().length >= 2;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed inset-0 z-[101] flex items-start justify-center pt-[18vh]" onClick={onClose}>
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
                {convLoading ? 'szukam w rozmowach…' : dataResults.length > 0
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
