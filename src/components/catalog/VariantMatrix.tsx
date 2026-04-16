'use client';

import { useState, useMemo, useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface SizeOption {
  id: string;
  value: string;
  sort_order: number;
}

interface ColorOption {
  id: string;
  name: string;
  hex_code: string;
  sort_order: number;
}

export interface VariantRow {
  size_id: string;
  color_id: string;
  size_value: string;
  color_name: string;
  sku_preview: string;
  barcode: string;
  price_override: string;
}

interface VariantMatrixProps {
  sizes: SizeOption[];
  colors: ColorOption[];
  categoryName: string;
  brandName: string;
  value: VariantRow[];
  onChange: (variants: VariantRow[]) => void;
}

/** Generate a SKU preview from category, brand, size, and color names. */
function skuPreview(
  category: string,
  brand: string,
  size: string,
  color: string,
): string {
  const normalize = (s: string) =>
    s
      .normalize('NFD')
      .replaceAll(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replaceAll(/[^A-Z0-9]/g, '');
  const cat = normalize(category).slice(0, 3).padEnd(3, 'X');
  const br = normalize(brand).slice(0, 3).padEnd(3, 'X');
  const sz = size;
  const col = normalize(color).slice(0, 3).padEnd(3, 'X');
  return `${cat}-${br}-${sz}-${col}`;
}

/**
 * Variant matrix selector for product creation/editing.
 * Multi-select sizes and colors, generates combination matrix.
 *
 * Validates: Requirements 1.5, 2.2
 */
export function VariantMatrix({
  sizes,
  colors,
  categoryName,
  brandName,
  value,
  onChange,
}: VariantMatrixProps) {
  const [selectedSizeIds, setSelectedSizeIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    value.forEach((v) => ids.add(v.size_id));
    return ids;
  });

  const [selectedColorIds, setSelectedColorIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    value.forEach((v) => ids.add(v.color_id));
    return ids;
  });

  const sortedSizes = useMemo(
    () => [...sizes].sort((a, b) => a.sort_order - b.sort_order),
    [sizes],
  );

  const sortedColors = useMemo(
    () => [...colors].sort((a, b) => a.sort_order - b.sort_order),
    [colors],
  );

  const sizeMap = useMemo(
    () => new Map(sizes.map((s) => [s.id, s])),
    [sizes],
  );

  const colorMap = useMemo(
    () => new Map(colors.map((c) => [c.id, c])),
    [colors],
  );

  // Build variant map from current value for quick lookup
  const variantMap = useMemo(() => {
    const map = new Map<string, VariantRow>();
    value.forEach((v) => map.set(`${v.size_id}-${v.color_id}`, v));
    return map;
  }, [value]);

  const regenerateMatrix = useCallback(
    (sizeIds: Set<string>, colorIds: Set<string>) => {
      const newVariants: VariantRow[] = [];
      for (const sizeId of sizeIds) {
        for (const colorId of colorIds) {
          const key = `${sizeId}-${colorId}`;
          const existing = variantMap.get(key);
          const size = sizeMap.get(sizeId);
          const color = colorMap.get(colorId);
          if (!size || !color) continue;

          newVariants.push(
            existing ?? {
              size_id: sizeId,
              color_id: colorId,
              size_value: size.value,
              color_name: color.name,
              sku_preview: skuPreview(
                categoryName,
                brandName,
                size.value,
                color.name,
              ),
              barcode: '',
              price_override: '',
            },
          );
        }
      }
      onChange(newVariants);
    },
    [variantMap, sizeMap, colorMap, categoryName, brandName, onChange],
  );

  const toggleSize = useCallback(
    (sizeId: string) => {
      const next = new Set(selectedSizeIds);
      if (next.has(sizeId)) next.delete(sizeId);
      else next.add(sizeId);
      setSelectedSizeIds(next);
      regenerateMatrix(next, selectedColorIds);
    },
    [selectedSizeIds, selectedColorIds, regenerateMatrix],
  );

  const toggleColor = useCallback(
    (colorId: string) => {
      const next = new Set(selectedColorIds);
      if (next.has(colorId)) next.delete(colorId);
      else next.add(colorId);
      setSelectedColorIds(next);
      regenerateMatrix(selectedSizeIds, next);
    },
    [selectedSizeIds, selectedColorIds, regenerateMatrix],
  );

  const toggleAllSizes = useCallback(
    (checked: boolean) => {
      const next = checked
        ? new Set(sortedSizes.map((s) => s.id))
        : new Set<string>();
      setSelectedSizeIds(next);
      regenerateMatrix(next, selectedColorIds);
    },
    [sortedSizes, selectedColorIds, regenerateMatrix],
  );

  const toggleAllColors = useCallback(
    (checked: boolean) => {
      const next = checked
        ? new Set(sortedColors.map((c) => c.id))
        : new Set<string>();
      setSelectedColorIds(next);
      regenerateMatrix(selectedSizeIds, next);
    },
    [sortedColors, selectedSizeIds, regenerateMatrix],
  );

  const updateVariantField = useCallback(
    (
      sizeId: string,
      colorId: string,
      field: 'barcode' | 'price_override',
      fieldValue: string,
    ) => {
      const updated = value.map((v) =>
        v.size_id === sizeId && v.color_id === colorId
          ? { ...v, [field]: fieldValue }
          : v,
      );
      onChange(updated);
    },
    [value, onChange],
  );

  const allSizesSelected =
    sortedSizes.length > 0 && selectedSizeIds.size === sortedSizes.length;
  const allColorsSelected =
    sortedColors.length > 0 && selectedColorIds.size === sortedColors.length;

  return (
    <div className="space-y-4">
      {/* Size selector */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="all-sizes"
            checked={allSizesSelected}
            onCheckedChange={(checked) => toggleAllSizes(!!checked)}
          />
          <Label htmlFor="all-sizes" className="text-sm font-medium">
            Seleccionar todas las tallas
          </Label>
        </div>
        <div className="flex flex-wrap gap-2">
          {sortedSizes.map((size) => (
            <label
              key={size.id}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <Checkbox
                checked={selectedSizeIds.has(size.id)}
                onCheckedChange={() => toggleSize(size.id)}
              />
              {size.value}
            </label>
          ))}
        </div>
      </div>

      {/* Color selector */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="all-colors"
            checked={allColorsSelected}
            onCheckedChange={(checked) => toggleAllColors(!!checked)}
          />
          <Label htmlFor="all-colors" className="text-sm font-medium">
            Seleccionar todos los colores
          </Label>
        </div>
        <div className="flex flex-wrap gap-2">
          {sortedColors.map((color) => (
            <label
              key={color.id}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <Checkbox
                checked={selectedColorIds.has(color.id)}
                onCheckedChange={() => toggleColor(color.id)}
              />
              <span
                className="inline-block size-3 rounded-full border"
                style={{ backgroundColor: color.hex_code }}
              />
              {color.name}
            </label>
          ))}
        </div>
      </div>

      {/* Generated matrix */}
      {value.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {value.length} variante(s) generada(s)
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Talla</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>SKU (vista previa)</TableHead>
                  <TableHead>Código de barras</TableHead>
                  <TableHead>Precio especial</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {value.map((v) => (
                  <TableRow key={`${v.size_id}-${v.color_id}`}>
                    <TableCell>{v.size_value}</TableCell>
                    <TableCell>{v.color_name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {v.sku_preview}
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="EAN-13 (opcional)"
                        value={v.barcode}
                        onChange={(e) =>
                          updateVariantField(
                            v.size_id,
                            v.color_id,
                            'barcode',
                            e.target.value,
                          )
                        }
                        className="h-8 w-40"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        placeholder="Precio base"
                        value={v.price_override}
                        onChange={(e) =>
                          updateVariantField(
                            v.size_id,
                            v.color_id,
                            'price_override',
                            e.target.value,
                          )
                        }
                        className="h-8 w-32"
                        min={0}
                        step={0.01}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
