'use client';

/**
 * Payment methods CRUD configuration page. Admin only.
 *
 * Validates: Requirements 7.4, 8.4
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, CreditCard } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { usePermissions } from '@/hooks/usePermissions';
import type { PaymentMethod } from '@/types/database';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PaymentMethodFormData {
  name: string;
  icon: string;
  is_active: boolean;
  sort_order: number;
}

const emptyForm: PaymentMethodFormData = {
  name: '',
  icon: '',
  is_active: true,
  sort_order: 0,
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MetodosPagoConfigPage() {
  const router = useRouter();
  const { role, hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const canManage = hasPermission('config.manage');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [formData, setFormData] = useState<PaymentMethodFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<{ name?: string }>({});

  useEffect(() => {
    if (role && !canManage) {
      router.replace('/');
    }
  }, [role, canManage, router]);

  // Fetch payment methods
  const { data: methods = [], isLoading } = useQuery({
    queryKey: ['config-payment-methods'],
    queryFn: async () => {
      const res = await fetch('/api/config/payment-methods');
      if (!res.ok) throw new Error('Error al cargar métodos de pago');
      const json = await res.json();
      return json.data as PaymentMethod[];
    },
    enabled: canManage,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: PaymentMethodFormData) => {
      const res = await fetch('/api/config/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? 'Error al crear método de pago');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-payment-methods'] });
      toast.success('Método de pago creado correctamente');
      closeDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: PaymentMethodFormData & { id: string }) => {
      const res = await fetch('/api/config/payment-methods', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? 'Error al actualizar método de pago');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-payment-methods'] });
      toast.success('Método de pago actualizado correctamente');
      closeDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Toggle active mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const method = methods.find((m) => m.id === id);
      if (!method) throw new Error('Método no encontrado');
      const res = await fetch('/api/config/payment-methods', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...method, is_active }),
      });
      if (!res.ok) throw new Error('Error al cambiar estado');
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['config-payment-methods'] });
      toast.success(variables.is_active ? 'Método activado' : 'Método desactivado');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const openCreateDialog = useCallback(() => {
    setEditingMethod(null);
    setFormData(emptyForm);
    setFormErrors({});
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((method: PaymentMethod) => {
    setEditingMethod(method);
    setFormData({
      name: method.name,
      icon: method.icon ?? '',
      is_active: method.is_active,
      sort_order: method.sort_order,
    });
    setFormErrors({});
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingMethod(null);
    setFormData(emptyForm);
    setFormErrors({});
  }, []);

  const handleSubmit = useCallback(() => {
    const errors: { name?: string } = {};
    if (!formData.name.trim()) {
      errors.name = 'El nombre es obligatorio';
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    if (editingMethod) {
      updateMutation.mutate({ id: editingMethod.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  }, [formData, editingMethod, updateMutation, createMutation]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const columns: ColumnDef<PaymentMethod>[] = useMemo(
    () => [
      {
        header: 'Nombre',
        accessor: 'name',
        sortable: true,
        cell: (row) => <span className="font-medium">{row.name}</span>,
      },
      {
        header: 'Icono',
        accessor: 'icon',
        cell: (row) => (
          <span className="text-sm text-muted-foreground">{row.icon || '—'}</span>
        ),
      },
      {
        header: 'Orden',
        accessor: 'sort_order',
        sortable: true,
      },
      {
        header: 'Estado',
        accessor: 'is_active',
        cell: (row) => (
          <div className="flex items-center gap-2">
            <Switch
              checked={row.is_active}
              onCheckedChange={(checked: boolean) =>
                toggleMutation.mutate({ id: row.id, is_active: checked })
              }
              size="sm"
            />
            {row.is_active ? (
              <Badge variant="default">Activo</Badge>
            ) : (
              <Badge variant="secondary">Inactivo</Badge>
            )}
          </div>
        ),
      },
      {
        header: 'Acciones',
        accessor: 'id',
        cell: (row) => (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => openEditDialog(row)}
            title="Editar"
          >
            <Pencil className="size-4" />
          </Button>
        ),
      },
    ],
    [toggleMutation, openEditDialog],
  );

  if (role && !canManage) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <CreditCard className="size-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold">Métodos de Pago</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona los métodos de pago disponibles en el POS.
            </p>
          </div>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 size-4" />
          Nuevo Método
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={methods}
        isLoading={isLoading}
        emptyMessage="No se encontraron métodos de pago."
        rowKey="id"
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMethod ? 'Editar Método de Pago' : 'Nuevo Método de Pago'}
            </DialogTitle>
            <DialogDescription>
              {editingMethod
                ? 'Modifica los datos del método de pago.'
                : 'Completa los datos para crear un nuevo método de pago.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pm-name">Nombre *</Label>
              <Input
                id="pm-name"
                value={formData.name}
                onChange={(e) => {
                  setFormData((p) => ({ ...p, name: e.target.value }));
                  if (formErrors.name) setFormErrors((p) => ({ ...p, name: undefined }));
                }}
                placeholder="Ej: Efectivo, Tarjeta de Crédito..."
              />
              {formErrors.name && (
                <p className="text-sm text-destructive">{formErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pm-icon">Icono</Label>
              <Input
                id="pm-icon"
                value={formData.icon}
                onChange={(e) => setFormData((p) => ({ ...p, icon: e.target.value }))}
                placeholder="Ej: cash, credit-card, bank..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pm-order">Orden de visualización</Label>
              <Input
                id="pm-order"
                type="number"
                value={formData.sort_order}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, sort_order: Number(e.target.value) || 0 }))
                }
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="pm-active"
                checked={formData.is_active}
                onCheckedChange={(checked: boolean) =>
                  setFormData((p) => ({ ...p, is_active: checked }))
                }
              />
              <Label htmlFor="pm-active">Activo</Label>
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
              {editingMethod ? 'Guardar Cambios' : 'Crear Método'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
