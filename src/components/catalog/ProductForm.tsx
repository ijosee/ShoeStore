'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

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
import { VariantMatrix, type VariantRow } from './VariantMatrix';
import { ImageUploader } from './ImageUploader';
import { createClient } from '@/lib/supabase/client';
import {
  PRODUCT_NAME_MAX_LENGTH,
  PRODUCT_DESCRIPTION_MAX_LENGTH,
  DEFAULT_TAX_RATE,
} from '@/lib/constants';

interface ProductFormProps {
  /** Product ID when editing, undefined when creating. */
  productId?: string;
  /** Pre-filled data for edit mode. */
  initialData?: {
    name: string;
    brand_id: string;
    category_id: string;
    description: string;
    base_price: number;
    cost: number;
    tax_rate: number;
  };
  /** Existing images for edit mode. */
  existingImages?: Array<{
    id: string;
    image_url: string;
    thumbnail_url: string | null;
    is_primary: boolean;
  }>;
}

/**
 * Multi-section product form for creating and editing products.
 * Sections: Basic info, Variants, Images (edit only).
 *
 * Validates: Requirements 1.1, 1.2, 1.5
 */
export function ProductForm({
  productId,
  initialData,
  existingImages = [],
}: ProductFormProps) {
  const router = useRouter();
  const isEditing = !!productId;

  // Form state
  const [name, setName] = useState(initialData?.name ?? '');
  const [brandId, setBrandId] = useState(initialData?.brand_id ?? '');
  const [categoryId, setCategoryId] = useState(initialData?.category_id ?? '');
  const [description, setDescription] = useState(
    initialData?.description ?? '',
  );
  const [basePrice, setBasePrice] = useState(
    initialData?.base_price?.toString() ?? '',
  );
  const [cost, setCost] = useState(initialData?.cost?.toString() ?? '');
  const [taxRate, setTaxRate] = useState(
    initialData?.tax_rate?.toString() ?? String(DEFAULT_TAX_RATE),
  );
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [images, setImages] = useState(existingImages);

  // Fetch categories and brands for selects
  const supabase = createClient();

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase
        .from('categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const { data } = await supabase
        .from('brands')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
  });

  const { data: sizes = [] } = useQuery({
    queryKey: ['sizes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sizes')
        .select('id, value, sort_order')
        .order('sort_order');
      return (data ?? []) as Array<{
        id: string;
        value: string;
        sort_order: number;
      }>;
    },
  });

  const { data: colors = [] } = useQuery({
    queryKey: ['colors'],
    queryFn: async () => {
      const { data } = await supabase
        .from('colors')
        .select('id, name, hex_code, sort_order')
        .order('sort_order');
      return (data ?? []) as Array<{
        id: string;
        name: string;
        hex_code: string;
        sort_order: number;
      }>;
    },
  });

  // Derive category/brand names for SKU preview
  const categoryName =
    categories.find((c) => c.id === categoryId)?.name ?? '';
  const brandName = brands.find((b) => b.id === brandId)?.name ?? '';

  const refreshImages = useCallback(async () => {
    if (!productId) return;
    const { data } = await supabase
      .from('product_images')
      .select('id, image_url, thumbnail_url, is_primary')
      .eq('product_id', productId)
      .order('sort_order');
    if (data) {
      setImages(
        data as Array<{
          id: string;
          image_url: string;
          thumbnail_url: string | null;
          is_primary: boolean;
        }>,
      );
    }
  }, [productId, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Basic validation
      if (!name.trim()) {
        toast.error('El nombre del producto es requerido');
        return;
      }
      if (!brandId) {
        toast.error('Seleccione una marca');
        return;
      }
      if (!categoryId) {
        toast.error('Seleccione una categoría');
        return;
      }
      const price = Number.parseFloat(basePrice);
      const costVal = Number.parseFloat(cost);
      const tax = Number.parseFloat(taxRate);

      if (Number.isNaN(price) || price < 0) {
        toast.error('El precio base debe ser un número válido >= 0');
        return;
      }
      if (Number.isNaN(costVal) || costVal < 0) {
        toast.error('El costo debe ser un número válido >= 0');
        return;
      }
      if (Number.isNaN(tax) || tax < 0 || tax > 1) {
        toast.error('La tasa de impuesto debe estar entre 0 y 1');
        return;
      }

      if (isEditing) {
        // PUT update
        const res = await fetch(`/api/products/${productId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            brand_id: brandId,
            category_id: categoryId,
            description: description.trim() || undefined,
            base_price: price,
            cost: costVal,
            tax_rate: tax,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            body?.error?.message ?? 'Error al actualizar producto',
          );
        }

        toast.success('Producto actualizado');
        router.push(`/catalogo/productos/${productId}`);
      } else {
        // POST create
        if (variants.length === 0) {
          toast.error('Debe agregar al menos una variante');
          return;
        }

        const variantPayload = variants.map((v) => ({
          size_id: v.size_id,
          color_id: v.color_id,
          barcode: v.barcode || undefined,
          price_override: v.price_override
            ? Number.parseFloat(v.price_override)
            : undefined,
        }));

        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            brand_id: brandId,
            category_id: categoryId,
            description: description.trim() || undefined,
            base_price: price,
            cost: costVal,
            tax_rate: tax,
            variants: variantPayload,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            body?.error?.message ?? 'Error al crear producto',
          );
        }

        const { data } = await res.json();
        
        // Upload pending images if any
        if (pendingFiles.length > 0) {
          for (const file of pendingFiles) {
            const formData = new FormData();
            formData.append('image', file);
            await fetch(`/api/products/${data.id}/images`, {
              method: 'POST',
              body: formData,
            });
          }
        }
        
        toast.success('Producto creado');
        router.push(`/catalogo/productos/${data.id}`);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Error inesperado',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Section 1: Basic info */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Información básica</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Nombre del producto *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={PRODUCT_NAME_MAX_LENGTH}
              placeholder="Ej: Zapato Oxford Classic"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand">Marca *</Label>
            <Select value={brandId} onValueChange={(val) => setBrandId(val ?? '')}>
              <SelectTrigger id="brand">
                <SelectValue placeholder="Seleccionar marca">
                  {(value: string) => {
                    if (!value) return 'Seleccionar marca';
                    return brands.find((b) => b.id === value)?.name ?? value;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id} label={b.name}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoría *</Label>
            <Select value={categoryId} onValueChange={(val) => setCategoryId(val ?? '')}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Seleccionar categoría">
                  {(value: string) => {
                    if (!value) return 'Seleccionar categoría';
                    return categories.find((c) => c.id === value)?.name ?? value;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id} label={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={PRODUCT_DESCRIPTION_MAX_LENGTH}
              placeholder="Descripción del producto (opcional)"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="base_price">Precio base (MXN) *</Label>
            <Input
              id="base_price"
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              min={0}
              step={0.01}
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost">Costo (MXN) *</Label>
            <Input
              id="cost"
              type="number"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              min={0}
              step={0.01}
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tax_rate">Tasa de impuesto (IVA) *</Label>
            <Input
              id="tax_rate"
              type="number"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              min={0}
              max={1}
              step={0.01}
              placeholder="0.16"
              required
            />
          </div>
        </div>
      </section>

      {/* Section 2: Variants (create mode only) */}
      {!isEditing && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Variantes *</h2>
          <p className="text-sm text-muted-foreground">
            Seleccione tallas y colores para generar la matriz de variantes.
          </p>
          <VariantMatrix
            sizes={sizes}
            colors={colors}
            categoryName={categoryName}
            brandName={brandName}
            value={variants}
            onChange={setVariants}
          />
        </section>
      )}

      {/* Section 3: Images */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Imágenes</h2>
        {isEditing && productId ? (
          <>
            <ImageUploader
              productId={productId}
              existingImages={images}
              onUploadComplete={refreshImages}
            />
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className="relative size-20 overflow-hidden rounded-md border"
                  >
                    <img
                      src={img.thumbnail_url ?? img.image_url}
                      alt="Imagen del producto"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Selecciona las fotos del producto. Se subirán al crear el producto.
            </p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                setPendingFiles((prev) => [...prev, ...files]);
                const newPreviews = files.map((f) => URL.createObjectURL(f));
                setPendingPreviews((prev) => [...prev, ...newPreviews]);
              }}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            />
            {pendingPreviews.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pendingPreviews.map((src, i) => (
                  <div
                    key={src}
                    className="relative size-20 overflow-hidden rounded-md border"
                  >
                    <img
                      src={src}
                      alt={`Vista previa ${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(src);
                        setPendingFiles((prev) => prev.filter((_, idx) => idx !== i));
                        setPendingPreviews((prev) => prev.filter((_, idx) => idx !== i));
                      }}
                      className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* Submit */}
      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          {isEditing ? 'Guardar cambios' : 'Crear producto'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
