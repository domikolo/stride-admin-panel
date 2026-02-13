/**
 * Dashboard Layout with Sidebar + Floating Chat + Cmd+K Search
 * Client component for mobile sidebar toggle
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import FloatingChatWrapper from '@/components/dashboard/FloatingChatWrapper';
import SearchDialog from '@/components/layout/SearchDialog';
import { Menu, Search } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setSearchOpen(prev => !prev);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onSearchOpen={() => setSearchOpen(true)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-card border-b border-border">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <Menu size={22} />
          </button>
          <img src="/logo.png" alt="Stride" className="h-6 w-auto" />
          <button
            onClick={() => setSearchOpen(true)}
            className="ml-auto p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <Search size={20} />
          </button>
        </div>

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="p-4 md:p-8">
            {children}
          </div>
        </main>
      </div>

      <FloatingChatWrapper />
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
