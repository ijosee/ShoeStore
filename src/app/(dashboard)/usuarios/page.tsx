'use client';

/**
 * User management page with DataTable, filters, create/edit dialog.
 * Admin only.
 *
 * Validates: Requirements 11.5, 11.7
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Users, UserCheck, UserX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { Pagination } from '@/components/shared/Pagination';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { usePermissions } from '@/hooks/usePermissions';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_PAGE_SIZE, ROLE_LABELS, SEARCH_DEBOUNCE_MS } from '@/lib/constants';
import type { UserRole } from '@/types/database';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  stores: Array<{ id: string; name: string; code: string }>;
}

interface UsersResponse {
  data: UserRow[];
  pagination: {
    page: number;
    page_size: number;
    total_count: number;
    total_pages: number;
  };
}

interface UserFormData {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  store_ids: string[];
}

const emptyForm: UserFormData = {
  email: '',
  password: '',
  full_name: '',
  role: 'seller',
  store_ids: [],
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function UsuariosPage() {
  const router = useRouter();
  const { role, hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const supabase = createClient();
  const canManage = hasPermission('user.manage');

  // Filter state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [formData, setFormData] = useState<UserFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Status toggle state
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [togglingUser, setTogglingUser] = useState<UserRow | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // Redirect non-admin
  useEffect(() => {
    if (role && !canManage) {
      router.replace('/');
    }
  }, [role, canManage, router]);

  const handleFilterChange = useCallback(
    (setter: (val: string) => void) => (val: string | null) => {
      setter(val ?? 'all');
      setPage(1);
    },
    [],
  );

  // Fetch stores for filter and form
  const { data: allStores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data } = await supabase
        .from('stores')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      return (data ?? []) as Array<{ id: string; name: string; code: string }>;
    },
  });

  // Fetch users
  const { data: response, isLoading } = useQuery<UsersResponse>({
    queryKey: ['users', page, debouncedSearch, roleFilter, storeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', String(DEFAULT_PAGE_SIZE));
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (roleFilter && roleFilter !== 'all') params.set('role', roleFilter);
      if (storeFilter && storeFilter !== 'all') params.set('store_id', storeFilter);
      if (statusFilter && statusFilter !== 'all') params.set('is_active', statusFilter);

      const res = await fetch(`/api/users?${params.toString()}`);
      if (!res.ok) throw new Error('Error al cargar usuarios');
      return res.json();
    },
    enabled: canManage,
  });

  const users = response?.data ?? [];
  const pagination = response?.pagination ?? {
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
    total_count: 0,
    total_pages: 0,
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? 'Error al crear usuario');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario creado correctamente');
      closeDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<UserFormData> & { id: string }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? 'Error al actualizar usuario');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario actualizado correctamente');
      closeDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Status toggle mutation
  const statusMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const res = await fetch(`/api/users/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? 'Error al cambiar estado');
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(variables.is_active ? 'Usuario activado' : 'Usuario desactivado');
      setStatusDialogOpen(false);
      setTogglingUser(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setStatusDialogOpen(false);
      setTogglingUser(null);
    },
  });

  const openCreateDialog = useCallback(() => {
    setEditingUser(null);
    setFormData(emptyForm);
    setFormErrors({});
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((user: UserRow) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      full_name: user.full_name,
      role: user.role,
      store_ids: user.stores.map((s) => s.id),
    });
    setFormErrors({});
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingUser(null);
    setFormData(emptyForm);
    setFormErrors({});
  }, []);

  const openStatusDialog = useCallback((user: UserRow) => {
    setTogglingUser(user);
    setStatusDialogOpen(true);
  }, []);

  const handleSubmit = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!formData.full_name.trim()) errors.full_name = 'Nombre requerido';
    if (!editingUser && !formData.email.trim()) errors.email = 'Email requerido';
    if (!editingUser && formData.password.length < 8) errors.password = 'Mínimo 8 caracteres';
    if (formData.store_ids.length === 0) errors.store_ids = 'Seleccione al menos una tienda';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    if (editingUser) {
      updateMutation.mutate({
        id: editingUser.id,
        full_name: formData.full_name,
        role: formData.role,
        store_ids: formData.store_ids,
      });
    } else {
      createMutation.mutate(formData);
    }
  }, [formData, editingUser, updateMutation, createMutation]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const toggleStoreSelection = useCallback((storeId: string) => {
    setFormData((prev) => ({
      ...prev,
      store_ids: prev.store_ids.includes(storeId)
        ? prev.store_ids.filter((id) => id !== storeId)
        : [...prev.store_ids, storeId],
    }));
  }, []);

  const columns: ColumnDef<UserRow>[] = useMemo(
    () => [
      {
        header: 'Nombre',
        accessor: 'full_name',
        sortable: true,
        cell: (row) => (
          <div>
            <p className="font-medium">{row.full_name}</p>
            <p className="text-xs text-muted-foreground">{row.email}</p>
          </div>
        ),
      },
      {
        header: 'Rol',
        accessor: 'role',
        cell: (row) => (
          <Badge variant="outline">
            {ROLE_LABELS[row.role] ?? row.role}
          </Badge>
        ),
      },
      {
        header: 'Tiendas',
        accessor: (row) => row.stores.map((s) => s.name).join(', '),
        cell: (row) => (
          <div className="flex flex-wrap gap-1">
            {row.stores.map((s) => (
              <Badge key={s.id} variant="secondary" className="text-xs">
                {s.code}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        header: 'Estado',
        accessor: 'is_active',
        cell: (row) =>
          row.is_active ? (
            <Badge variant="default">Activo</Badge>
          ) : (
            <Badge variant="secondary">Inactivo</Badge>
          ),
      },
      {
        header: 'Último acceso',
        accessor: 'last_login_at',
        cell: (row) => (
          <span className="text-sm text-muted-foreground">
            {row.last_login_at
              ? new Date(row.last_login_at).toLocaleDateString('es-MX')
              : 'Nunca'}
          </span>
        ),
      },
      {
        header: 'Acciones',
        accessor: 'id',
        cell: (row) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => openEditDialog(row)}
              title="Editar"
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => openStatusDialog(row)}
              title={row.is_active ? 'Desactivar' : 'Activar'}
            >
              {row.is_active ? (
                <UserX className="size-4 text-destructive" />
              ) : (
                <UserCheck className="size-4 text-green-600" />
              )}
            </Button>
          </div>
        ),
      },
    ],
    [openEditDialog, openStatusDialog],
  );

  if (role && !canManage) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Users className="size-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Usuarios</h1>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 size-4" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-[200px]">
          <Input
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={roleFilter} onValueChange={handleFilterChange(setRoleFilter)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            <SelectItem value="admin">Administrador</SelectItem>
            <SelectItem value="manager">Gerente</SelectItem>
            <SelectItem value="seller">Vendedor</SelectItem>
          </SelectContent>
        </Select>

        <Select value={storeFilter} onValueChange={handleFilterChange(setStoreFilter)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Tienda">
              {(value: string) => {
                if (!value || value === 'all') return 'Todas las tiendas';
                return allStores.find((s) => s.id === value)?.name ?? value;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las tiendas</SelectItem>
            {allStores.map((s) => (
              <SelectItem key={s.id} value={s.id} label={s.name}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Activos</SelectItem>
            <SelectItem value="false">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={users}
        isLoading={isLoading}
        emptyMessage="No se encontraron usuarios."
        rowKey="id"
      />

      {/* Pagination */}
      {pagination.total_pages > 0 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.total_pages}
          totalCount={pagination.total_count}
          pageSize={pagination.page_size}
          onPageChange={setPage}
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Modifica los datos del usuario.'
                : 'Completa los datos para crear un nuevo usuario.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Nombre completo *</Label>
              <Input
                id="user-name"
                value={formData.full_name}
                onChange={(e) => {
                  setFormData((p) => ({ ...p, full_name: e.target.value }));
                  if (formErrors.full_name) setFormErrors((p) => ({ ...p, full_name: '' }));
                }}
                placeholder="Nombre completo"
              />
              {formErrors.full_name && (
                <p className="text-sm text-destructive">{formErrors.full_name}</p>
              )}
            </div>

            {!editingUser && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="user-email">Email *</Label>
                  <Input
                    id="user-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData((p) => ({ ...p, email: e.target.value }));
                      if (formErrors.email) setFormErrors((p) => ({ ...p, email: '' }));
                    }}
                    placeholder="correo@ejemplo.com"
                  />
                  {formErrors.email && (
                    <p className="text-sm text-destructive">{formErrors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user-password">Contraseña *</Label>
                  <Input
                    id="user-password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => {
                      setFormData((p) => ({ ...p, password: e.target.value }));
                      if (formErrors.password) setFormErrors((p) => ({ ...p, password: '' }));
                    }}
                    placeholder="Mínimo 8 caracteres"
                  />
                  {formErrors.password && (
                    <p className="text-sm text-destructive">{formErrors.password}</p>
                  )}
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="user-role">Rol *</Label>
              <Select
                value={formData.role}
                onValueChange={(val) =>
                  setFormData((p) => ({ ...p, role: val as UserRole }))
                }
              >
                <SelectTrigger id="user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="manager">Gerente</SelectItem>
                  <SelectItem value="seller">Vendedor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tiendas asignadas *</Label>
              <div className="space-y-2 rounded-lg border p-3">
                {allStores.map((store) => (
                  <div key={store.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`store-${store.id}`}
                      checked={formData.store_ids.includes(store.id)}
                      onCheckedChange={() => toggleStoreSelection(store.id)}
                    />
                    <Label htmlFor={`store-${store.id}`} className="cursor-pointer text-sm">
                      {store.name} ({store.code})
                    </Label>
                  </div>
                ))}
              </div>
              {formErrors.store_ids && (
                <p className="text-sm text-destructive">{formErrors.store_ids}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving && (
                <LoadingSpinner size="sm" className="mr-2 border-current border-t-transparent" />
              )}
              {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Toggle Confirmation */}
      <ConfirmDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        title={togglingUser?.is_active ? 'Desactivar Usuario' : 'Activar Usuario'}
        description={
          togglingUser?.is_active
            ? `¿Estás seguro de que deseas desactivar a "${togglingUser?.full_name}"? Se cerrarán todas sus sesiones activas.`
            : `¿Deseas activar a "${togglingUser?.full_name}"?`
        }
        confirmLabel={togglingUser?.is_active ? 'Desactivar' : 'Activar'}
        variant={togglingUser?.is_active ? 'destructive' : 'default'}
        onConfirm={() => {
          if (togglingUser) {
            statusMutation.mutate({
              id: togglingUser.id,
              is_active: !togglingUser.is_active,
            });
          }
        }}
        isLoading={statusMutation.isPending}
      />
    </div>
  );
}
