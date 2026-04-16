'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  MAX_PRODUCT_IMAGES,
  MAX_IMAGE_SIZE_BYTES,
  ALLOWED_IMAGE_TYPES,
} from '@/lib/constants';
import { cn } from '@/lib/utils';

interface UploadedImage {
  id: string;
  image_url: string;
  thumbnail_url: string | null;
  is_primary: boolean;
}

interface ImageUploaderProps {
  productId: string;
  existingImages: UploadedImage[];
  onUploadComplete: () => void;
}

const ALLOWED_EXTENSIONS = 'JPG, PNG, WebP';

/**
 * Drag & drop image uploader for product images.
 * Max 10 images, max 5MB each, JPG/PNG/WebP only.
 *
 * Validates: Requirements 1.3
 */
export function ImageUploader({
  productId,
  existingImages,
  onUploadComplete,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remainingSlots = MAX_PRODUCT_IMAGES - existingImages.length;

  const validateFile = useCallback((file: File): string | null => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return `Formato no permitido. Use ${ALLOWED_EXTENSIONS}.`;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return 'El archivo excede el tamaño máximo de 5 MB.';
    }
    return null;
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch(`/api/products/${productId}/images`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.error?.message ?? 'Error al subir imagen',
        );
      }
    },
    [productId],
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      const fileArray = Array.from(files);

      if (fileArray.length > remainingSlots) {
        setError(
          `Solo puede agregar ${remainingSlots} imagen(es) más (máximo ${MAX_PRODUCT_IMAGES}).`,
        );
        return;
      }

      for (const file of fileArray) {
        const validationError = validateFile(file);
        if (validationError) {
          setError(validationError);
          return;
        }
      }

      setUploading(true);
      setProgress(0);

      try {
        for (let i = 0; i < fileArray.length; i++) {
          await uploadFile(fileArray[i]);
          setProgress(Math.round(((i + 1) / fileArray.length) * 100));
        }
        onUploadComplete();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Error al subir imagen',
        );
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [remainingSlots, validateFile, uploadFile, onUploadComplete],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    },
    [],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles],
  );

  if (remainingSlots <= 0 && !uploading) {
    return (
      <p className="text-sm text-muted-foreground">
        Se alcanzó el máximo de {MAX_PRODUCT_IMAGES} imágenes.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          uploading && 'pointer-events-none opacity-60',
        )}
      >
        <Upload className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Arrastra imágenes aquí o{' '}
          <button
            type="button"
            className="font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            selecciona archivos
          </button>
        </p>
        <p className="text-xs text-muted-foreground">
          {ALLOWED_EXTENSIONS} · Máx. 5 MB · {remainingSlots} espacio(s)
          disponible(s)
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(',')}
          multiple
          className="hidden"
          onChange={handleInputChange}
          disabled={uploading}
        />
      </div>

      {/* Upload progress */}
      {uploading && (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Subiendo... {progress}%
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto size-6 p-0"
            onClick={() => setError(null)}
          >
            <X className="size-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
