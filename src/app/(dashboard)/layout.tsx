'use client';

import { useEffect } from 'react';

import { useAuthStore } from '@/stores/auth-store';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { TourProvider } from '@/components/tour/TourProvider';

/**
 * Dashboard layout with collapsible sidebar and top bar.
 *
 * - Desktop: sidebar visible on the left, topbar on top, content fills remaining space.
 * - Mobile: sidebar hidden (accessible via hamburger in TopBar), topbar on top.
 *
 * Validates: Requirements NF-4.1, NF-4.3
 */
export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialize = useAuthStore((s) => s.initialize);
  const isLoading = useAuthStore((s) => s.is_loading);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Show a minimal loading state while auth initializes
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[oklch(0.16_0.02_220)]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
          <span className="text-sm text-muted-foreground">Cargando...</span>
        </div>
      </div>
    );
  }

  // If no user after loading, the middleware should redirect to /login.
  // This is a fallback in case the middleware hasn't kicked in yet.
  if (!user) {
    return null;
  }

  return (
    <QueryProvider>
      <TourProvider />
      <div className="flex h-screen flex-col">
        <TopBar />
        <div className="flex flex-1 overflow-hidden">
          {/* Desktop sidebar */}
          <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-white/[0.06] bg-[oklch(0.13_0.025_220)] lg:block">
            <Sidebar />
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto bg-gradient-to-br from-background via-background to-[oklch(0.18_0.03_200)] p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </QueryProvider>
  );
}
