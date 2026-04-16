'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { ADJUSTMENT_REASON_LABELS } from '@/lib/constants';

// ─── Types ───────────────────────────────────────────────────────────────────

interface VariantSearchResult {
  variant_id: string;
  product_name: string;
  sku: string;
  size: string;
  color: string;
  current_stock: number;
  store_name: string;
  store_id: string;
}

export interface AdjustmentFormProps {
  readonly storeId: string | null;
  readonly onSuccess?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Stock adjustment form with variant search, reason select, and note.
 *
 * Validates: Requirements 3.8
 */
export function AdjustmentForm({ storeId, onSuccess }: AdjustmentFormProps) {
  const queryClient = useQueryClient();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<VariantSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<VariantSearchResult | null>(null);

  // Form state
  const [newQuantity, setNewQuantity] = useState('');
  const [reason, setReason] = useState<string>('');
  const [note, setNote] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ─── Search handler ────────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !storeId) return;

    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        search: searchQuery.trim(),
        store_id: storeId,
        page_size: '10',
      });
      const res = await fetch(`/api/inventory/stock?${params.toString()}`);
      if (!res.ok) throw new Error('Error al buscar');
      const json = await res.json();

      const results: VariantSearchResult[] = (json.data ?? []).map(
        (item: Record<string, unknown>) => {
          const variant = item.variant as Record<string, unknown>;
          const product = item.product as Record<string, unknown>;
          const store = item.store as Record<string, unknown> | null;
          const size = variant?.size as { value: string } | null;
          const color = variant?.color as { name: string } | null;

          return {
            variant_id: item.variant_id as string,
            product_name: (product?.name as string) ?? '',
            sku: (variant?.sku as string) ?? '',
            size: size?.value ?? '',
            color: color?.name ?? '',
            current_stock: item.quantity as number,
            store_name: (store?.name as string) ?? '',
            store_id: item.store_id as string,
          };
        },
      );

      setSearchResults(results);
    } catch {
      toast.error('Error al buscar variantes');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, storeId]);

  const handleSelectVariant = useCallback((variant: VariantSearchResult) => {
    setSelectedVariant(variant);
    setSearchResults([]);
    setSearchQuery('');
    setNewQuantity('');
    setFormErrors({});
  }, []);

  // ─── Submit mutation ───────────────────────────────────────────────────

  const adjustMutation = useMutation({
    mutationFn: async (data: {
      variant_id: string;
      store_id: string;
      new_quantity: number;
      reason: string;
      note: string;
    }) => {
      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? 'Error al realizar ajuste');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['kardex'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('Ajuste de stock realizado correctamente');
      // Reset form
      setSelectedVariant(null);
      setNewQuantity('');
      setReason('');
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

    if (!selectedVariant) {
      errors.variant = 'Debe seleccionar una variante';
    }
    if (newQuantity === '' || Number.isNaN(Number(newQuantity))) {
      errors.quantity = 'Ingrese una cantidad válida';
    } else if (Number(newQuantity) < 0) {
      errors.quantity = 'La cantidad no puede ser negativa';
    } else if (!Number.isInteger(Number(newQuantity))) {
      errors.quantity = 'La cantidad debe ser un número entero';
    }
    if (!reason) {
      errors.reason = 'Seleccione un motivo';
    }
    if (!note.trim()) {
      errors.note = 'La nota es obligatoria';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    if (!selectedVariant) return;

    adjustMutation.mutate({
      variant_id: selectedVariant.variant_id,
      store_id: selectedVariant.store_id,
      new_quantity: Number(newQuantity),
      reason,
      note: note.trim(),
    });
  }, [selectedVariant, newQuantity, reason, note, adjustMutation]);

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Variant search */}
      {selectedVariant ? (
        <div className="space-y-2">
          <Label>Variante seleccionada</Label>
          <div className="flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2">
            <div>
              <span className="font-medium">{selectedVariant.product_name}</span>
              <span className="ml-2 text-sm text-muted-foreground">
                {selectedVariant.sku} — T{selectedVariant.size} {selectedVariant.color}
              </span>
              <span className="ml-2 text-sm text-muted-foreground">
                ({selectedVariant.store_name})
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedVariant(null);
                setFormErrors({});
              }}
            >
              Cambiar
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Stock actual: <span className="font-semibold">{selectedVariant.current_stock}</span>
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Buscar variante *</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Buscar por nombre, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearch();
                }
              }}
            />
            <Button
              variant="outline"
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim() || !storeId}
            >
              {isSearching ? <LoadingSpinner size="sm" /> : 'Buscar'}
            </Button>
          </div>
          {formErrors.variant && (
            <p className="text-sm text-destructive">{formErrors.variant}</p>
          )}
          {!storeId && (
            <p className="text-sm text-muted-foreground">
              Seleccione una tienda activa para buscar variantes.
            </p>
          )}

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="mt-2 max-h-60 overflow-y-auto rounded-md border">
              {searchResults.map((v) => (
                <button
                  key={`${v.variant_id}-${v.store_id}`}
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => handleSelectVariant(v)}
                >
                  <div>
                    <span className="font-medium">{v.product_name}</span>
                    <span className="ml-2 text-muted-foreground">
                      {v.sku} — T{v.size} {v.color}
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    Stock: {v.current_stock}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New quantity */}
      <div className="space-y-2">
        <Label htmlFor="new-quantity">Cantidad nueva *</Label>
        <Input
          id="new-quantity"
          type="number"
          min={0}
          step={1}
          value={newQuantity}
          onChange={(e) => {
            setNewQuantity(e.target.value);
            if (formErrors.quantity) {
              setFormErrors((prev) => ({ ...prev, quantity: '' }));
            }
          }}
          placeholder="Ej: 8"
        />
        {formErrors.quantity && (
          <p className="text-sm text-destructive">{formErrors.quantity}</p>
        )}
        {selectedVariant && newQuantity !== '' && !Number.isNaN(Number(newQuantity)) && (
          <p className="text-sm text-muted-foreground">
            Diferencia:{' '}
            <span className={Number(newQuantity) - selectedVariant.current_stock >= 0 ? 'text-green-700' : 'text-red-700'}>
              {Number(newQuantity) - selectedVariant.current_stock >= 0 ? '+' : ''}
              {Number(newQuantity) - selectedVariant.current_stock}
            </span>
          </p>
        )}
      </div>

      {/* Reason */}
      <div className="space-y-2">
        <Label>Motivo *</Label>
        <Select value={reason} onValueChange={(val) => {
          setReason(val ?? '');
          if (formErrors.reason) {
            setFormErrors((prev) => ({ ...prev, reason: '' }));
          }
        }}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar motivo">
              {(value: string) => {
                if (!value) return 'Seleccionar motivo';
                return ADJUSTMENT_REASON_LABELS[value] ?? value;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ADJUSTMENT_REASON_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key} label={label}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {formErrors.reason && (
          <p className="text-sm text-destructive">{formErrors.reason}</p>
        )}
      </div>

      {/* Note */}
      <div className="space-y-2">
        <Label htmlFor="adjustment-note">Nota *</Label>
        <Textarea
          id="adjustment-note"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            if (formErrors.note) {
              setFormErrors((prev) => ({ ...prev, note: '' }));
            }
          }}
          placeholder="Describa el motivo del ajuste..."
          rows={3}
        />
        {formErrors.note && (
          <p className="text-sm text-destructive">{formErrors.note}</p>
        )}
      </div>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={adjustMutation.isPending}
        className="w-full sm:w-auto"
      >
        {adjustMutation.isPending && (
          <LoadingSpinner size="sm" className="mr-2 border-current border-t-transparent" />
        )}
        Confirmar Ajuste
      </Button>
    </div>
  );
}
