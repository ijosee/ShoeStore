'use client';

import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Small button that triggers the guided tour replay.
 * Dispatches a custom 'start-tour' event that TourProvider listens for.
 */
export function TourButton() {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => globalThis.dispatchEvent(new CustomEvent('start-tour'))}
      aria-label="Repetir tour guiado"
      title="Repetir tour"
    >
      <HelpCircle className="size-4" />
    </Button>
  );
}
