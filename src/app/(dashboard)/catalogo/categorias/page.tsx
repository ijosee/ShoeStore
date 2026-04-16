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
import { Textarea } from '@/components/ui/textarea';
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
import type { Category } from '@/types/database';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CategoryFormData {
  name: string;
  description: string;
  is_active: boolean;
}

const emptyForm: CategoryFormData = {
  name: '',
  description: '',
  is_active: true,
};

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * Categories CRUD page. Admin-only access.
 *
 * Validates: Requirements 1.1, 2.1
 */
export default function CategoriasPage() {
  const router = useRouter();
  const { role } = usePermissions();
  const queryClient = useQueryClient();
  const supabase = createClient();

  // ─── Dialog state ────────────────────────────────────────────────────────

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<{ name?: string }>({});

  // ─── Delete state ────────────────────────────────────────────────────────

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(
    null,
  );

  // ─── Redirect non-admin users ────────────────────────────────────────────

  useEffect(() => {
    if (role && role !== 'admin') {
      router.replace('/catalogo/productos');
    }
  }, [role, router]);

  // ─── Queries ─────────────────────────────────────────────────────────────

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data ?? []) as Category[];
    },
    enabled: role === 'admin',
  });

  // ─── Mutations ───────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      const { error } = await supabase.from('categories').insert({
        name: data.name.trim(),
        description: data.description.trim() || null,
        is_active: data.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories-admin'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Categoría creada correctamente');
      closeDialog();
    },
    onError: (error: Error) => {
      toast.error(`Error al crear categoría: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: CategoryFormData;
    }) => {
      const { error } = await supabase
        .from('categories')
        .update({
          name: data.name.trim(),
          description: data.description.trim() || null,
          is_active: data.is_active,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories-admin'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Categoría actualizada correctamente');
      closeDialog();
    },
    onError: (error: Error) => {
      toast.error(`Error al actualizar categoría: ${error.message}`);
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
        .from('categories')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['categories-admin'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success(
        variables.is_active ? 'Categoría activada' : 'Categoría desactivada',
      );
    },
    onError: (error: Error) => {
      toast.error(`Error al cambiar estado: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check if any products use this category
      const { count, error: countError } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', id);
      if (countError) throw countError;
      if (count && count > 0) {
        throw new Error(
          `No se puede eliminar: ${count} producto(s) usan esta categoría`,
        );
      }
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories-admin'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Categoría eliminada correctamente');
      setDeleteDialogOpen(false);
      setDeletingCategory(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setDeleteDialogOpen(false);
      setDeletingCategory(null);
    },
  });

  // ─── Handlers ────────────────────────────────────────────────────────────

  const openCreateDialog = useCallback(() => {
    setEditingCategory(null);
    setFormData(emptyForm);
    setFormErrors({});
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description ?? '',
      is_active: category.is_active,
    });
    setFormErrors({});
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingCategory(null);
    setFormData(emptyForm);
    setFormErrors({});
  }, []);

  const openDeleteDialog = useCallback((category: Category) => {
    setDeletingCategory(category);
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
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  }, [formData, editingCategory, updateMutation, createMutation]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ─── Table columns ───────────────────────────────────────────────────────

  const columns: ColumnDef<Category>[] = useMemo(
    () => [
      {
        header: 'Nombre',
        accessor: 'name',
        sortable: true,
        cell: (row) => <span className="font-medium">{row.name}</span>,
      },
      {
        header: 'Descripción',
        accessor: 'description',
        cell: (row) => (
          <span className="text-muted-foreground">
            {row.description || '—'}
          </span>
        ),
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
        <h1 className="text-2xl font-bold">Categorías</h1>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 size-4" />
          Nueva Categoría
        </Button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={categories}
        isLoading={isLoading}
        emptyMessage="No se encontraron categorías."
        rowKey="id"
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? 'Modifica los datos de la categoría.'
                : 'Completa los datos para crear una nueva categoría.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Nombre *</Label>
              <Input
                id="category-name"
                value={formData.name}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, name: e.target.value }));
                  if (formErrors.name) {
                    setFormErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                placeholder="Ej: Formal, Deportivo, Casual..."
              />
              {formErrors.name && (
                <p className="text-sm text-destructive">{formErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-description">Descripción</Label>
              <Textarea
                id="category-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Descripción opcional de la categoría..."
                rows={3}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="category-active"
                checked={formData.is_active}
                onCheckedChange={(checked: boolean) =>
                  setFormData((prev) => ({ ...prev, is_active: checked }))
                }
              />
              <Label htmlFor="category-active">Activa</Label>
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
              {editingCategory ? 'Guardar Cambios' : 'Crear Categoría'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Eliminar Categoría"
        description={`¿Estás seguro de que deseas eliminar la categoría "${deletingCategory?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={() => {
          if (deletingCategory) {
            deleteMutation.mutate(deletingCategory.id);
          }
        }}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
