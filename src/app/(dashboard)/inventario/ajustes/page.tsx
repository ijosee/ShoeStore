'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AjustesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/inventario/ajustes/nuevo');
  }, [router]);

  return null;
}
