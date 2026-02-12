'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquare,
  Calendar,
  Flame,
  Clock,
  Search,
} from 'lucide-react';

interface SearchItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  section: string;
  keywords?: string[];
}

const SEARCH_ITEMS: SearchItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, section: 'Nawigacja', keywords: ['panel', 'home', 'glowna'] },
  { label: 'Rozmowy', href: '/conversations', icon: MessageSquare, section: 'Nawigacja', keywords: ['conversations', 'chat', 'wiadomosci'] },
  { label: 'Spotkania', href: '/appointments', icon: Calendar, section: 'Nawigacja', keywords: ['appointments', 'kalendarz', 'umowione'] },
  { label: 'Insights - Wczoraj', href: '/insights?period=daily', icon: Clock, section: 'Insights', keywords: ['daily', 'dzisiaj', 'trending', 'pytania'] },
  { label: 'Insights - Tydzien', href: '/insights?period=weekly', icon: Flame, section: 'Insights', keywords: ['weekly', 'tygodniowe', 'trending'] },
  { label: 'Insights - Miesiac', href: '/insights?period=monthly', icon: Flame, section: 'Insights', keywords: ['monthly', 'miesieczne', 'trending'] },
];

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SearchDialog({ open, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const filtered = query.trim()
    ? SEARCH_ITEMS.filter(item => {
        const q = query.toLowerCase();
        return (
          item.label.toLowerCase().includes(q) ||
          item.section.toLowerCase().includes(q) ||
          item.keywords?.some(k => k.includes(q))
        );
      })
    : SEARCH_ITEMS;

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const navigate = useCallback((item: SearchItem) => {
    onClose();
    router.push(item.href);
  }, [onClose, router]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      navigate(filtered[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filtered, selectedIndex, navigate, onClose]);

  if (!open) return null;

  // Group by section
  const sections: { name: string; items: (SearchItem & { globalIndex: number })[] }[] = [];
  let globalIdx = 0;
  for (const item of filtered) {
    let section = sections.find(s => s.name === item.section);
    if (!section) {
      section = { name: item.section, items: [] };
      sections.push(section);
    }
    section.items.push({ ...item, globalIndex: globalIdx++ });
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-[101] flex items-start justify-center pt-[20vh]">
        <div
          className="w-full max-w-lg bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
            <Search size={18} className="text-zinc-500 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Szukaj stron..."
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-zinc-500"
            />
            <kbd className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-72 overflow-y-auto py-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-8">
                Brak wynikow
              </p>
            ) : (
              sections.map((section) => (
                <div key={section.name}>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold px-4 py-1.5">
                    {section.name}
                  </p>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isSelected = item.globalIndex === selectedIndex;
                    return (
                      <button
                        key={item.href}
                        onClick={() => navigate(item)}
                        onMouseEnter={() => setSelectedIndex(item.globalIndex)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          isSelected ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        <Icon size={16} className="flex-shrink-0" />
                        <span className="text-sm">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-zinc-800 flex items-center gap-4 text-[10px] text-zinc-500">
            <span><kbd className="bg-zinc-800 px-1 py-0.5 rounded border border-zinc-700 mr-1">↑↓</kbd> nawigacja</span>
            <span><kbd className="bg-zinc-800 px-1 py-0.5 rounded border border-zinc-700 mr-1">↵</kbd> otwórz</span>
          </div>
        </div>
      </div>
    </>
  );
}
