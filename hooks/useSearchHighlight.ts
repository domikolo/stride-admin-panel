import { useRef, useEffect } from 'react';

export interface SearchHighlight {
  query: string;
  targetId: string;
  type: 'conversation' | 'contact' | 'appointment';
}

/**
 * Reads searchHighlight from sessionStorage once on mount.
 * Clears storage immediately to avoid stale state.
 * Returns a ref (not state) — consumers use it in effects that depend on data.
 */
export function useSearchHighlight() {
  const ref = useRef<SearchHighlight | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('searchHighlight');
    if (raw) {
      sessionStorage.removeItem('searchHighlight');
      try { ref.current = JSON.parse(raw); } catch {}
    }
  }, []);

  return ref;
}

/** Scroll to an element and flash it with a yellow highlight. */
export function flashElement(el: Element) {
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('search-flash'); // reset if already running
  // Force reflow so re-adding the class restarts animation
  void (el as HTMLElement).offsetWidth;
  el.classList.add('search-flash');
  setTimeout(() => el.classList.remove('search-flash'), 2200);
}
