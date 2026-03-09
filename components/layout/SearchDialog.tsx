'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useClientId } from '@/hooks/useClientId';
import { searchGlobal, SearchResult } from '@/lib/api';
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

// ─── API result types ─────────────────────────────────────────────────────────

type ApiResult = SearchResult & { kind: SearchResult['type'] };

type AnyItem = (NavItem | ApiResult) & { globalIndex: number };

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

// ─── Component ────────────────────────────────────────────────────────────────

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SearchDialog({ open, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const [apiResults, setApiResults] = useState<ApiResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const clientId = useClientId();

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setApiResults([]);
      setSelectedIndex(0);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selection on query change
  useEffect(() => { setSelectedIndex(0); }, [query]);

  // Debounced API search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 2 || !clientId) {
      setApiResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchGlobal(clientId, trimmed);
        setApiResults((data.results || []).map(r => ({ ...r, kind: r.type })));
      } catch {
        // silently ignore — nav items always work
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, clientId]);

  // Build combined list
  const allItems: AnyItem[] = (() => {
    const trimmed = query.trim().toLowerCase();

    // Nav items — always shown, filtered by query when query exists
    const navFiltered: NavItem[] = trimmed.length < 2
      ? NAV_ITEMS
      : NAV_ITEMS.filter(item =>
          item.label.toLowerCase().includes(trimmed) ||
          item.section.toLowerCase().includes(trimmed) ||
          item.keywords?.some(k => k.includes(trimmed))
        );

    const combined: (NavItem | ApiResult)[] = [...navFiltered, ...apiResults];

    // Group by section and assign global index
    const sectionMap = new Map<string, (NavItem | ApiResult)[]>();
    for (const item of combined) {
      const sec = item.kind === 'nav' ? (item as NavItem).section : KIND_SECTION[item.kind];
      if (!sectionMap.has(sec)) sectionMap.set(sec, []);
      sectionMap.get(sec)!.push(item);
    }

    // Sort sections and flatten
    const sorted = Array.from(sectionMap.entries()).sort(
      ([a], [b]) => (SECTION_ORDER[a] ?? 99) - (SECTION_ORDER[b] ?? 99)
    );

    let idx = 0;
    return sorted.flatMap(([, items]) => items.map(item => ({ ...item, globalIndex: idx++ })));
  })();

  // Build section groups for rendering
  const sections: Section[] = (() => {
    const map = new Map<string, AnyItem[]>();
    for (const item of allItems) {
      const sec = item.kind === 'nav' ? (item as NavItem).section : KIND_SECTION[item.kind];
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(item);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (SECTION_ORDER[a] ?? 99) - (SECTION_ORDER[b] ?? 99))
      .map(([name, items]) => ({ name, items }));
  })();

  const navigate = useCallback((item: AnyItem) => {
    onClose();
    if (item.kind === 'nav') {
      router.push((item as NavItem).href);
    } else if (item.kind === 'conversation') {
      router.push(`/conversations/${(item as ApiResult).sessionId}`);
    } else if (item.kind === 'contact') {
      router.push(`/contacts`);
    } else if (item.kind === 'appointment') {
      router.push(`/appointments`);
    }
  }, [onClose, router]);

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
            {allItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {loading ? 'Szukam...' : 'Brak wyników'}
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
                        key={`${item.kind}-${isNav ? (item as NavItem).href : (item as ApiResult).id}`}
                        onClick={() => navigate(item)}
                        onMouseEnter={() => setSelectedIndex(item.globalIndex)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          isSelected ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                        }`}
                      >
                        <Icon size={15} className={`flex-shrink-0 ${colorClass}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{item.label}</p>
                          {!isNav && (item as ApiResult).sublabel && (
                            <p className="text-[11px] text-muted-foreground truncate font-mono">
                              {(item as ApiResult).sublabel}
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
            {query.trim().length >= 2 && (
              <span className="ml-auto">{apiResults.length > 0 ? `${apiResults.length} wyników z bazy` : loading ? 'szukam...' : 'brak wyników z bazy'}</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
