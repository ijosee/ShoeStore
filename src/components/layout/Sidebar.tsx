'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Warehouse,
  Receipt,
  Users,
  Settings,
  FileText,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import type { Permission } from '@/types/permissions';

// ─── Navigation structure ────────────────────────────────────────────────────

type RoleFilter = Array<'admin' | 'manager' | 'seller'>;

interface NavSubItem {
  label: string;
  href: string;
  /** Permission required to see this sub-item. If omitted, inherits parent. */
  permission?: Permission;
  /** Only visible to these roles. */
  roles?: RoleFilter;
}

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Permission required to see this item. If omitted, visible to all. */
  permission?: Permission;
  /** Only visible to these roles. */
  roles?: RoleFilter;
  children?: NavSubItem[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    label: 'POS',
    href: '/pos',
    icon: ShoppingCart,
    permission: 'sale.create',
  },
  {
    label: 'Catálogo',
    href: '/catalogo/productos',
    icon: Package,
    permission: 'product.view',
    children: [
      { label: 'Productos', href: '/catalogo/productos' },
      { label: 'Categorías', href: '/catalogo/categorias', roles: ['admin'] },
      { label: 'Marcas', href: '/catalogo/marcas', roles: ['admin'] },
    ],
  },
  {
    label: 'Inventario',
    href: '/inventario/stock',
    icon: Warehouse,
    permission: 'stock.view_own_store',
    children: [
      { label: 'Stock', href: '/inventario/stock' },
      { label: 'Movimientos', href: '/inventario/movimientos' },
      {
        label: 'Ajustes',
        href: '/inventario/ajustes',
        roles: ['admin', 'manager'],
      },
      {
        label: 'Transferencias',
        href: '/inventario/transferencias',
        roles: ['admin', 'manager'],
      },
      { label: 'Alertas', href: '/inventario/alertas' },
    ],
  },
  {
    label: 'Ventas',
    href: '/ventas/historial',
    icon: Receipt,
    children: [
      { label: 'Historial', href: '/ventas/historial' },
      { label: 'Devoluciones', href: '/ventas/devoluciones' },
    ],
  },
  {
    label: 'Usuarios',
    href: '/usuarios',
    icon: Users,
    roles: ['admin'],
  },
  {
    label: 'Configuración',
    href: '/config',
    icon: Settings,
    roles: ['admin'],
  },
  {
    label: 'Auditoría',
    href: '/auditoria',
    icon: FileText,
    roles: ['admin', 'manager'],
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

interface SidebarProps {
  /** Called when a link is clicked (used to close mobile sheet). */
  onNavigate?: () => void;
}

/**
 * Sidebar navigation filtered by the current user's role and permissions.
 *
 * Validates: Requirements NF-4.1, NF-4.3
 */
export function Sidebar({ onNavigate }: Readonly<SidebarProps>) {
  const pathname = usePathname();
  const { hasPermission, role } = usePermissions();

  const isVisible = (item: { permission?: Permission; roles?: RoleFilter }) => {
    if (item.roles && role && !item.roles.includes(role)) return false;
    if (item.permission && !hasPermission(item.permission)) return false;
    return true;
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className="flex flex-col gap-1 px-3 py-4" aria-label="Navegación principal" data-tour="sidebar">
      {NAV_ITEMS.filter(isVisible).map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        const visibleChildren = item.children?.filter(isVisible);
        const hasChildren = visibleChildren && visibleChildren.length > 0;
        const childActive = visibleChildren?.some((c) => isActive(c.href));

        return (
          <div key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              data-tour={`sidebar-${item.label.toLowerCase().normalize('NFD').replaceAll(/[\u0300-\u036f]/g, '')}`}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active || childActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>

            {hasChildren && (
              <div className="ml-7 mt-1 flex flex-col gap-0.5">
                {visibleChildren.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={onNavigate}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-sm transition-colors',
                      isActive(child.href)
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                        : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                    )}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
