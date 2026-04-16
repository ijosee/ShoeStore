'use client';

/**
 * POS search bar with debounce (300ms), camera icon for barcode scanning,
 * and product results grid.
 *
 * Uses TanStack Query for search API calls.
 * Integrates BarcodeScanner dialog for camera-based barcode scanning.
 *
 * Validates: Requirements 6.1, 6.2, 6.3
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Camera, Loader2, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BarcodeScanner } from '@/components/pos/BarcodeScanner';
import { ProductCard, type POSSearchResult } from '@/components/pos/ProductCard';
import { useStore } from '@/hooks/useStore';
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants';

interface SearchBarProps {
  readonly onAddProduct: (product: POSSearchResult) => void;
}

async function searchProducts(
  query: string,
  storeId: string,
): Promise<POSSearchResult[]> {
  const params = new URLSearchParams({ q: query, store_id: storeId });
  const res = await fetch(`/api/pos/search?${params.toString()}`);
  if (!res.ok) {
    throw new Error('Error al buscar productos');
  }
  const json = await res.json();
  return json.data ?? [];
}

export function SearchBar({ onAddProduct }: SearchBarProps) {
  const { activeStoreId } = useStore();
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce input
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(inputValue.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [inputValue]);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['pos-search', debouncedQuery, activeStoreId],
    queryFn: () => searchProducts(debouncedQuery, activeStoreId ?? ''),
    enabled: debouncedQuery.length > 0 && activeStoreId != null,
    staleTime: 10_000,
  });

  const handleAdd = useCallback(
    (product: POSSearchResult) => {
      onAddProduct(product);
      setInputValue('');
      setDebouncedQuery('');
    },
    [onAddProduct],
  );

  const handleBarcodeScan = useCallback((barcode: string) => {
    setInputValue(barcode);
    setDebouncedQuery(barcode);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {/* Search input row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por nombre, SKU o código de barras..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="pl-9"
            aria-label="Buscar productos"
          />
          {isLoading && (
            <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setScannerOpen(true)}
          aria-label="Escanear código de barras"
          title="Escanear código de barras"
        >
          <Camera />
        </Button>
      </div>

      {/* Results grid */}
      {debouncedQuery.length > 0 && (
        <div className="max-h-[60vh] overflow-y-auto">
          {results.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {results.map((product) => (
                <ProductCard
                  key={product.variant_id}
                  product={product}
                  onAdd={handleAdd}
                />
              ))}
            </div>
          ) : (
            !isLoading && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No se encontraron productos para &quot;{debouncedQuery}&quot;
              </p>
            )
          )}
        </div>
      )}

      {/* Barcode scanner dialog */}
      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleBarcodeScan}
      />
    </div>
  );
}
