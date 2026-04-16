'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { createClient } from '@/lib/supabase/client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TransferLine {
  id: string;
  variant_id: string;
  product_name: string;
  sku: string;
  size: string;
  color: string;
  quantity: number;
}

interface VariantSearchResult {
  variant_id: string;
  product_name: string;
  sku: string;
  size: string;
  color: string;
  current_stock: number;
}

export interface TransferFormProps {
  readonly onSuccess?: () => void;
}

let lineIdCounter = 0;

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Transfer form with source/destination store selection and dynamic line items.
 *
 * Validates: Requirements 4.1, 4.2
 */
export function TransferForm({ onSuccess }: TransferFormProps) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  // Store state
  const [sourceStoreId, setSourceStoreId] = useState<string>('');
  const [destStoreId, setDestStoreId] = useState<string>('');
  const [note, setNote] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Lines state
  const [lines, setLines] = useState<TransferLine[]>([]);

  // Line search state
  const [lineSearchQuery, setLineSearchQuery] = useState('');
  const [lineSearchResults, setLineSearchResults] = useState<VariantSearchResult[]>([]);
  const [isLineSearching, setIsLineSearching] = useState(false);

  // ─── Fetch stores ──────────────────────────────────────────────────────

  const { data: stores = [] } = useQuery({
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

  // ─── Search variants in source store ───────────────────────────────────

  const handleLineSearch = useCallback(async () => {
    if (!lineSearchQuery.trim() || !sourceStoreId) return;

    setIsLineSearching(true);
    try {
      const params = new URLSearchParams({
        search: lineSearchQuery.trim(),
        store_id: sourceStoreId,
        page_size: '10',
      });
      const res = await fetch(`/api/inventory/stock?${params.toString()}`);
      if (!res.ok) throw new Error('Error al buscar');
      const json = await res.json();

      const results: VariantSearchResult[] = (json.data ?? []).map(
        (item: Record<string, unknown>) => {
          const variant = item.variant as Record<string, unknown>;
          const product = item.product as Record<string, unknown>;
          const size = variant?.size as { value: string } | null;
          const color = variant?.color as { name: string } | null;

          return {
            variant_id: item.variant_id as string,
            product_name: (product?.name as string) ?? '',
            sku: (variant?.sku as string) ?? '',
            size: size?.value ?? '',
            color: color?.name ?? '',
            current_stock: item.quantity as number,
          };
        },
      );

      setLineSearchResults(results);
    } catch {
      toast.error('Error al buscar variantes');
    } finally {
      setIsLineSearching(false);
    }
  }, [lineSearchQuery, sourceStoreId]);

  const handleAddLine = useCallback((variant: VariantSearchResult) => {
    // Check if already added
    if (lines.some((l) => l.variant_id === variant.variant_id)) {
      toast.error('Esta variante ya fue agregada');
      return;
    }

    setLines((prev) => [
      ...prev,
      {
        id: `line-${++lineIdCounter}`,
        variant_id: variant.variant_id,
        product_name: variant.product_name,
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        quantity: 1,
      },
    ]);
    setLineSearchResults([]);
    setLineSearchQuery('');
  }, [lines]);

  const handleRemoveLine = useCallback((lineId: string) => {
    setLines((prev) => prev.filter((l) => l.id !== lineId));
  }, []);

  const handleLineQuantityChange = useCallback((lineId: string, qty: string) => {
    setLines((prev) =>
      prev.map((l) =>
        l.id === lineId ? { ...l, quantity: Math.max(1, Number(qty) || 1) } : l,
      ),
    );
  }, []);

  // ─── Submit mutation ───────────────────────────────────────────────────

  const transferMutation = useMutation({
    mutationFn: async (data: {
      source_store_id: string;
      destination_store_id: string;
      lines: Array<{ variant_id: string; quantity: number }>;
      note?: string;
    }) => {
      const res = await fetch('/api/inventory/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? 'Error al crear transferencia');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['kardex'] });
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('Transferencia realizada correctamente');
      // Reset form
      setSourceStoreId('');
      setDestStoreId('');
      setLines([]);
      setNote('');
      setFormErrors({});
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = useCallback(() => {
    const errors: Record<string, string> = {};

    if (!sourceStoreId) errors.source = 'Seleccione tienda origen';
    if (!destStoreId) errors.dest = 'Seleccione tienda destino';
    if (sourceStoreId && destStoreId && sourceStoreId === destStoreId) {
      errors.dest = 'La tienda destino debe ser diferente a la origen';
    }
    if (lines.length === 0) errors.lines = 'Agregue al menos una línea';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    transferMutation.mutate({
      source_store_id: sourceStoreId,
      destination_store_id: destStoreId,
      lines: lines.map((l) => ({ variant_id: l.variant_id, quantity: l.quantity })),
      note: note.trim() || undefined,
    });
  }, [sourceStoreId, destStoreId, lines, note, transferMutation]);

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Store selection */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Tienda origen *</Label>
          <Select value={sourceStoreId} onValueChange={(val) => {
            setSourceStoreId(val ?? '');
            setLines([]);
            if (formErrors.source) setFormErrors((prev) => ({ ...prev, source: '' }));
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar tienda origen">
                {(value: string) => {
                  if (!value) return 'Seleccionar tienda origen';
                  const store = stores.find((s) => s.id === value);
                  return store ? `${store.name} (${store.code})` : value;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {stores.map((s) => (
                <SelectItem key={s.id} value={s.id} label={s.name + ' (' + s.code + ')'}>
                  {s.name} ({s.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formErrors.source && (
            <p className="text-sm text-destructive">{formErrors.source}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Tienda destino *</Label>
          <Select value={destStoreId} onValueChange={(val) => {
            setDestStoreId(val ?? '');
            if (formErrors.dest) setFormErrors((prev) => ({ ...prev, dest: '' }));
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar tienda destino">
                {(value: string) => {
                  if (!value) return 'Seleccionar tienda destino';
                  const store = stores.find((s) => s.id === value);
                  return store ? `${store.name} (${store.code})` : value;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {stores
                .filter((s) => s.id !== sourceStoreId)
                .map((s) => (
                  <SelectItem key={s.id} value={s.id} label={s.name + ' (' + s.code + ')'}>
                    {s.name} ({s.code})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {formErrors.dest && (
            <p className="text-sm text-destructive">{formErrors.dest}</p>
          )}
        </div>
      </div>

      {/* Lines */}
      <div className="space-y-3">
        <Label>Líneas de transferencia *</Label>

        {/* Add line search */}
        {sourceStoreId && (
          <div className="flex gap-2">
            <Input
              placeholder="Buscar variante por nombre, SKU..."
              value={lineSearchQuery}
              onChange={(e) => setLineSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleLineSearch();
                }
              }}
            />
            <Button
              variant="outline"
              onClick={handleLineSearch}
              disabled={isLineSearching || !lineSearchQuery.trim()}
            >
              {isLineSearching ? <LoadingSpinner size="sm" /> : <Plus className="size-4" />}
            </Button>
          </div>
        )}

        {!sourceStoreId && (
          <p className="text-sm text-muted-foreground">
            Seleccione una tienda origen para buscar variantes.
          </p>
        )}

        {/* Search results */}
        {lineSearchResults.length > 0 && (
          <div className="max-h-48 overflow-y-auto rounded-md border">
            {lineSearchResults.map((v) => (
              <button
                key={v.variant_id}
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => handleAddLine(v)}
              >
                <div>
                  <span className="font-medium">{v.product_name}</span>
                  <span className="ml-2 text-muted-foreground">
                    {v.sku} — T{v.size} {v.color}
                  </span>
                </div>
                <span className="text-muted-foreground">Stock: {v.current_stock}</span>
              </button>
            ))}
          </div>
        )}

        {formErrors.lines && (
          <p className="text-sm text-destructive">{formErrors.lines}</p>
        )}

        {/* Line items */}
        {lines.length > 0 && (
          <div className="space-y-2 rounded-md border p-3">
            {lines.map((line) => (
              <div key={line.id} className="flex items-center gap-3">
                <div className="flex-1 text-sm">
                  <span className="font-medium">{line.product_name}</span>
                  <span className="ml-1 text-muted-foreground">
                    ({line.sku} — T{line.size} {line.color})
                  </span>
                </div>
                <Input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) => handleLineQuantityChange(line.id, e.target.value)}
                  className="w-20"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleRemoveLine(line.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Note */}
      <div className="space-y-2">
        <Label htmlFor="transfer-note">Nota</Label>
        <Textarea
          id="transfer-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota opcional sobre la transferencia..."
          rows={2}
        />
      </div>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={transferMutation.isPending}
        className="w-full sm:w-auto"
      >
        {transferMutation.isPending && (
          <LoadingSpinner size="sm" className="mr-2 border-current border-t-transparent" />
        )}
        Confirmar Transferencia
      </Button>
    </div>
  );
}
