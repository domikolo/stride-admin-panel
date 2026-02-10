/**
 * Dashboard Layout with Sidebar + Floating Chat
 */

import Sidebar from '@/components/layout/Sidebar';
import FloatingChatWrapper from '@/components/dashboard/FloatingChatWrapper';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="p-8">
          {children}
        </div>
      </main>
      <FloatingChatWrapper />
    </div>
  );
}
