'use client';

/**
 * Barcode scanner dialog using the device camera.
 *
 * Uses the BarcodeDetector API (Chrome/Edge) to detect EAN-13 and UPC-A barcodes
 * from the device camera feed. Falls back to a message for unsupported browsers.
 *
 * Validates: Requirements 6.3
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { validateEAN13, validateUPCA } from '@/lib/barcode/scanner';

interface BarcodeScannerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onScan: (barcode: string) => void;
}

type ScannerState =
  | 'initializing'
  | 'scanning'
  | 'unsupported'
  | 'permission-denied'
  | 'error';

/**
 * Check if the BarcodeDetector API is available in the current browser.
 */
function isBarcodeDetectorSupported(): boolean {
  return (
    globalThis.window !== undefined &&
    'BarcodeDetector' in globalThis &&
    typeof (globalThis as unknown as Record<string, unknown>).BarcodeDetector ===
      'function'
  );
}

export function BarcodeScanner({
  open,
  onOpenChange,
  onScan,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);
  const [state, setState] = useState<ScannerState>('initializing');
  const [errorMessage, setErrorMessage] = useState('');
  const hasScannedRef = useRef(false);

  /**
   * Stop the camera stream and cancel any pending animation frame.
   */
  const stopCamera = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = 0;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  /**
   * Start the camera and begin scanning for barcodes.
   */
  const startScanning = useCallback(async () => {
    hasScannedRef.current = false;

    if (!isBarcodeDetectorSupported()) {
      setState('unsupported');
      return;
    }

    setState('initializing');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setState('scanning');

      // Create BarcodeDetector for EAN-13 and UPC-A
      const BarcodeDetectorCtor = (
        globalThis as unknown as Record<string, unknown>
      ).BarcodeDetector as new (options: {
        formats: string[];
      }) => {
        detect: (source: HTMLVideoElement) => Promise<
          Array<{ rawValue: string; format: string }>
        >;
      };

      const detector = new BarcodeDetectorCtor({
        formats: ['ean_13', 'upc_a'],
      });

      const scan = async () => {
        if (hasScannedRef.current || !videoRef.current) return;

        try {
          const barcodes = await detector.detect(videoRef.current);

          for (const barcode of barcodes) {
            const value = barcode.rawValue;
            const isValid = validateEAN13(value) || validateUPCA(value);

            if (isValid && !hasScannedRef.current) {
              hasScannedRef.current = true;
              onScan(value);
              onOpenChange(false);
              return;
            }
          }
        } catch {
          // Detection can fail on individual frames — keep scanning
        }

        animationRef.current = requestAnimationFrame(scan);
      };

      animationRef.current = requestAnimationFrame(scan);
    } catch (err) {
      const error = err as DOMException;
      if (
        error.name === 'NotAllowedError' ||
        error.name === 'PermissionDeniedError'
      ) {
        setState('permission-denied');
        setErrorMessage(
          'Se necesita permiso para acceder a la cámara. Habilita el acceso en la configuración de tu navegador.',
        );
      } else if (
        error.name === 'NotFoundError' ||
        error.name === 'DevicesNotFoundError'
      ) {
        setState('error');
        setErrorMessage(
          'No se encontró una cámara en este dispositivo.',
        );
      } else {
        setState('error');
        setErrorMessage(
          'No se pudo iniciar la cámara. Verifica que no esté en uso por otra aplicación.',
        );
      }
    }
  }, [onScan, onOpenChange]);

  // Start/stop camera when dialog opens/closes
  useEffect(() => {
    if (open) {
      startScanning();
    } else {
      stopCamera();
      setState('initializing');
      setErrorMessage('');
    }

    return () => {
      stopCamera();
    };
  }, [open, startScanning, stopCamera]);

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escanear Código de Barras</DialogTitle>
          <DialogDescription>
            Apunta la cámara al código de barras del producto (EAN-13 o UPC-A).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          {/* Camera feed */}
          {(state === 'initializing' || state === 'scanning') && (
            <div className="relative w-full overflow-hidden rounded-lg bg-black">
              <video
                ref={videoRef}
                className="aspect-video w-full object-cover"
                playsInline
                muted
                aria-label="Vista de cámara para escaneo de código de barras"
              />
              {state === 'initializing' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-white">
                  <Loader2 className="size-8 animate-spin" />
                  <p className="text-sm">Iniciando cámara...</p>
                </div>
              )}
              {state === 'scanning' && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-0.5 w-3/4 animate-pulse bg-green-400/80" />
                </div>
              )}
            </div>
          )}

          {/* Unsupported browser */}
          {state === 'unsupported' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Camera className="size-12 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Navegador no compatible
                </p>
                <p className="text-xs text-muted-foreground">
                  El escaneo de códigos de barras requiere un navegador
                  compatible (Chrome o Edge). También puedes escribir el código
                  manualmente en la barra de búsqueda.
                </p>
              </div>
            </div>
          )}

          {/* Permission denied or error */}
          {(state === 'permission-denied' || state === 'error') && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Camera className="size-12 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {state === 'permission-denied'
                    ? 'Acceso a cámara denegado'
                    : 'Error de cámara'}
                </p>
                <p className="text-xs text-muted-foreground">{errorMessage}</p>
              </div>
              {state === 'error' && (
                <Button variant="outline" size="sm" onClick={startScanning}>
                  Reintentar
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
