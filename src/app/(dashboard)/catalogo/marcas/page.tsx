'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { usePermissions } from '@/hooks/usePermissions';
import { createClient } from '@/lib/supabase/client';
import type { Brand } from '@/types/database';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BrandFormData {
  name: string;
  is_active: boolean;
}

const emptyForm: BrandFormData = {
  name: '',
  is_active: true,
};

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * Brands CRUD page. Admin-only access.
 *
 * Validates: Requirements 1.1, 2.1
 */
export default function MarcasPage() {
  const router = useRouter();
  const { role } = usePermissions();
  const queryClient = useQueryClient();
  const supabase = createClient();

  // ─── Dialog state ────────────────────────────────────────────────────────

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [formData, setFormData] = useState<BrandFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<{ name?: string }>({});

  // ─── Delete state ────────────────────────────────────────────────────────

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingBrand, setDeletingBrand] = useState<Brand | null>(null);

  // ─── Redirect non-admin users ────────────────────────────────────────────

  useEffect(() => {
    if (role && role !== 'admin') {
      router.replace('/catalogo/productos');
    }
  }, [role, router]);

  // ─── Queries ─────────────────────────────────────────────────────────────

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ['brands-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data ?? []) as Brand[];
    },
    enabled: role === 'admin',
  });

  // ─── Mutations ───────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (data: BrandFormData) => {
      const { error } = await supabase.from('brands').insert({
        name: data.name.trim(),
        is_active: data.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands-admin'] });
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast.success('Marca creada correctamente');
      closeDialog();
    },
    onError: (error: Error) => {
      toast.error(`Error al crear marca: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: BrandFormData;
    }) => {
      const { error } = await supabase
        .from('brands')
        .update({
          name: data.name.trim(),
          is_active: data.is_active,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands-admin'] });
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast.success('Marca actualizada correctamente');
      closeDialog();
    },
    onError: (error: Error) => {
      toast.error(`Error al actualizar marca: ${error.message}`);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({
      id,
      is_active,
    }: {
      id: string;
      is_active: boolean;
    }) => {
      const { error } = await supabase
        .from('brands')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['brands-admin'] });
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast.success(
        variables.is_active ? 'Marca activada' : 'Marca desactivada',
      );
    },
    onError: (error: Error) => {
      toast.error(`Error al cambiar estado: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check if any products use this brand
      const { count, error: countError } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', id);
      if (countError) throw countError;
      if (count && count > 0) {
        throw new Error(
          `No se puede eliminar: ${count} producto(s) usan esta marca`,
        );
      }
      const { error } = await supabase.from('brands').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands-admin'] });
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast.success('Marca eliminada correctamente');
      setDeleteDialogOpen(false);
      setDeletingBrand(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setDeleteDialogOpen(false);
      setDeletingBrand(null);
    },
  });

  // ─── Handlers ────────────────────────────────────────────────────────────

  const openCreateDialog = useCallback(() => {
    setEditingBrand(null);
    setFormData(emptyForm);
    setFormErrors({});
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((brand: Brand) => {
    setEditingBrand(brand);
    setFormData({
      name: brand.name,
      is_active: brand.is_active,
    });
    setFormErrors({});
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingBrand(null);
    setFormData(emptyForm);
    setFormErrors({});
  }, []);

  const openDeleteDialog = useCallback((brand: Brand) => {
    setDeletingBrand(brand);
    setDeleteDialogOpen(true);
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
    if (editingBrand) {
      updateMutation.mutate({ id: editingBrand.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  }, [formData, editingBrand, updateMutation, createMutation]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ─── Table columns ───────────────────────────────────────────────────────

  const columns: ColumnDef<Brand>[] = useMemo(
    () => [
      {
        header: 'Nombre',
        accessor: 'name',
        sortable: true,
        cell: (row) => <span className="font-medium">{row.name}</span>,
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
              <Badge variant="default">Activa</Badge>
            ) : (
              <Badge variant="secondary">Inactiva</Badge>
            )}
          </div>
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
              onClick={() => openDeleteDialog(row)}
              title="Eliminar"
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    [toggleMutation, openEditDialog, openDeleteDialog],
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  if (role && role !== 'admin') {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Marcas</h1>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 size-4" />
          Nueva Marca
        </Button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={brands}
        isLoading={isLoading}
        emptyMessage="No se encontraron marcas."
        rowKey="id"
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBrand ? 'Editar Marca' : 'Nueva Marca'}
            </DialogTitle>
            <DialogDescription>
              {editingBrand
                ? 'Modifica los datos de la marca.'
                : 'Completa los datos para crear una nueva marca.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brand-name">Nombre *</Label>
              <Input
                id="brand-name"
                value={formData.name}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, name: e.target.value }));
                  if (formErrors.name) {
                    setFormErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                placeholder="Ej: Nike, Adidas, Flexi..."
              />
              {formErrors.name && (
                <p className="text-sm text-destructive">{formErrors.name}</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="brand-active"
                checked={formData.is_active}
                onCheckedChange={(checked: boolean) =>
                  setFormData((prev) => ({ ...prev, is_active: checked }))
                }
              />
              <Label htmlFor="brand-active">Activa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeDialog}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving && (
                <LoadingSpinner
                  size="sm"
                  className="mr-2 border-current border-t-transparent"
                />
              )}
              {editingBrand ? 'Guardar Cambios' : 'Crear Marca'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Eliminar Marca"
        description={`¿Estás seguro de que deseas eliminar la marca "${deletingBrand?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={() => {
          if (deletingBrand) {
            deleteMutation.mutate(deletingBrand.id);
          }
        }}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
