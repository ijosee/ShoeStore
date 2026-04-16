'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, LogOut, User, Footprints, HelpCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABELS } from '@/lib/constants';
import { AlertBadge } from './AlertBadge';
import { StoreSelector } from './StoreSelector';
import { Sidebar } from './Sidebar';

/**
 * Top navigation bar with logo, store selector, alerts, and user menu.
 * Includes a hamburger menu for mobile that opens the sidebar in a Sheet.
 *
 * Validates: Requirements NF-4.1, NF-4.3, 13.2
 */
export function TopBar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, clearUser } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Continue with local cleanup even if remote sign-out fails
    }
    clearUser();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4">
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú"
      >
        <Menu className="size-5" />
      </Button>

      {/* Logo */}
      <div className="flex items-center gap-2">
        <Footprints className="size-5 text-primary" />
        <span className="hidden font-heading text-base font-semibold sm:inline">
          Zapatería Rocío
        </span>
      </div>

      {/* Store selector — centered */}
      <div className="flex flex-1 items-center justify-center" data-tour="store-selector">
        <StoreSelector />
      </div>

      {/* Right side: alerts + user menu */}
      <div className="flex items-center gap-1">
        <AlertBadge count={0} />

        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted"
          >
            <div className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <User className="size-4" />
            </div>
            <span className="hidden md:inline truncate max-w-[120px]">
              {user?.full_name ?? 'Usuario'}
            </span>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" sideOffset={8}>
            <div className="flex flex-col gap-0.5 px-2 py-1.5">
              <span className="text-sm font-medium">
                {user?.full_name ?? 'Usuario'}
              </span>
              <span className="text-xs text-muted-foreground">
                {user?.role ? ROLE_LABELS[user.role] : ''}
              </span>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {
              globalThis.dispatchEvent(new CustomEvent('start-tour'));
            }}>
              <HelpCircle className="size-4" />
              Repetir tour
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="size-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile sidebar sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
          <div className="flex h-14 items-center gap-2 border-b px-4">
            <Footprints className="size-5 text-primary" />
            <span className="font-heading text-base font-semibold">
              Zapatería Rocío
            </span>
          </div>
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
