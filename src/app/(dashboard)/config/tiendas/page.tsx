'use client';

/**
 * Store management configuration page. Admin only.
 *
 * Allows editing store details: name, code, address, phone, RFC, logo, return policy.
 *
 * Validates: Requirements 7.4, 8.4
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Store, Pencil, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

// ─── Types ───────────────────────────────────────────────────────────────────

interface StoreData {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  tax_id: string;
  logo_url: string | null;
  return_policy_text: string | null;
  is_active: boolean;
}

interface StoreFormData {
  name: string;
  code: string;
  address: string;
  phone: string;
  tax_id: string;
  return_policy_text: string;
  is_active: boolean;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TiendasConfigPage() {
  const router = useRouter();
  const { role, hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const canManage = hasPermission('config.manage');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreData | null>(null);
  const [formData, setFormData] = useState<StoreFormData>({
    name: '',
    code: '',
    address: '',
    phone: '',
    tax_id: '',
    return_policy_text: '',
    is_active: true,
  });

  useEffect(() => {
    if (role && !canManage) {
      router.replace('/');
    }
  }, [role, canManage, router]);

  // Fetch stores
  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['config-stores'],
    queryFn: async () => {
      const res = await fetch('/api/config/stores');
      if (!res.ok) throw new Error('Error al cargar tiendas');
      const json = await res.json();
      return json.data as StoreData[];
    },
    enabled: canManage,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: StoreFormData & { id: string }) => {
      const res = await fetch('/api/config/stores', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? 'Error al actualizar tienda');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-stores'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      toast.success('Tienda actualizada correctamente');
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const openEditDialog = useCallback((store: StoreData) => {
    setEditingStore(store);
    setFormData({
      name: store.name,
      code: store.code,
      address: store.address ?? '',
      phone: store.phone ?? '',
      tax_id: store.tax_id ?? '',
      return_policy_text: store.return_policy_text ?? '',
      is_active: store.is_active,
    });
    setDialogOpen(true);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!editingStore) return;
    if (!formData.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    updateMutation.mutate({ id: editingStore.id, ...formData });
  }, [editingStore, formData, updateMutation]);

  const columns: ColumnDef<StoreData>[] = [
    {
      header: 'Nombre',
      accessor: 'name',
      sortable: true,
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      header: 'Código',
      accessor: 'code',
      cell: (row) => <Badge variant="outline">{row.code}</Badge>,
    },
    {
      header: 'Dirección',
      accessor: 'address',
      cell: (row) => (
        <span className="text-sm text-muted-foreground">{row.address || '—'}</span>
      ),
    },
    {
      header: 'Teléfono',
      accessor: 'phone',
      cell: (row) => <span className="text-sm">{row.phone || '—'}</span>,
    },
    {
      header: 'Estado',
      accessor: 'is_active',
      cell: (row) =>
        row.is_active ? (
          <Badge variant="default">Activa</Badge>
        ) : (
          <Badge variant="secondary">Inactiva</Badge>
        ),
    },
    {
      header: 'Acciones',
      accessor: 'id',
      cell: (row) => (
        <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(row)} title="Editar">
          <Pencil className="size-4" />
        </Button>
      ),
    },
  ];

  if (role && !canManage) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Store className="size-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold">Tiendas</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona los datos de las tiendas de la cadena.
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={stores}
        isLoading={isLoading}
        emptyMessage="No se encontraron tiendas."
        rowKey="id"
      />

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Tienda</DialogTitle>
            <DialogDescription>Modifica los datos de la tienda.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="store-name">Nombre *</Label>
                <Input
                  id="store-name"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="store-code">Código (prefijo tickets)</Label>
                <Input
                  id="store-code"
                  value={formData.code}
                  onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-address">Dirección</Label>
              <Textarea
                id="store-address"
                value={formData.address}
                onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="store-phone">Teléfono</Label>
                <Input
                  id="store-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="store-tax-id">RFC</Label>
                <Input
                  id="store-tax-id"
                  value={formData.tax_id}
                  onChange={(e) => setFormData((p) => ({ ...p, tax_id: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-policy">Política de devolución</Label>
              <Textarea
                id="store-policy"
                value={formData.return_policy_text}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, return_policy_text: e.target.value }))
                }
                rows={3}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="store-active"
                checked={formData.is_active}
                onCheckedChange={(checked: boolean) =>
                  setFormData((p) => ({ ...p, is_active: checked }))
                }
              />
              <Label htmlFor="store-active">Activa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={updateMutation.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
              {updateMutation.isPending && (
                <LoadingSpinner size="sm" className="mr-2 border-current border-t-transparent" />
              )}
              <Save className="mr-2 size-4" />
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
