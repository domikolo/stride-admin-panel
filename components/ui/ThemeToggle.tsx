'use client';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`w-full flex items-center h-9 text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] rounded-lg transition-colors text-[13px] ${
        collapsed ? 'justify-center px-0' : 'justify-start gap-3 px-3'
      }`}
      title={isDark ? 'Włącz tryb jasny' : 'Włącz tryb ciemny'}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
      {!collapsed && <span>{isDark ? 'Tryb jasny' : 'Tryb ciemny'}</span>}
    </button>
  );
}
