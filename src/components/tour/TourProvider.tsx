'use client';

import { useEffect, useCallback } from 'react';
import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

import { useAuthStore } from '@/stores/auth-store';

const ADMIN_STEPS: DriveStep[] = [
  {
    element: '[data-tour="sidebar"]',
    popover: {
      title: 'Menú de navegación',
      description: 'Desde aquí accedes a todas las secciones del sistema.',
    },
  },
  {
    element: '[data-tour="store-selector"]',
    popover: {
      title: 'Selector de tienda',
      description: 'Cambia entre Montellano y Morón de la Frontera.',
    },
  },
  {
    element: '[data-tour="sidebar-pos"]',
    popover: {
      title: 'Punto de Venta',
      description: 'Registra ventas rápidamente buscando productos.',
    },
  },
  {
    element: '[data-tour="sidebar-catalogo"]',
    popover: {
      title: 'Catálogo',
      description: 'Gestiona productos, categorías y marcas.',
    },
  },
  {
    element: '[data-tour="sidebar-inventario"]',
    popover: {
      title: 'Inventario',
      description: 'Controla stock, movimientos, ajustes y transferencias entre tiendas.',
    },
  },
  {
    element: '[data-tour="sidebar-ventas"]',
    popover: {
      title: 'Ventas',
      description: 'Consulta el historial de ventas y procesa devoluciones.',
    },
  },
  {
    element: '[data-tour="sidebar-usuarios"]',
    popover: {
      title: 'Usuarios',
      description: 'Crea y gestiona las cuentas de los empleados.',
    },
  },
  {
    element: '[data-tour="sidebar-configuracion"]',
    popover: {
      title: 'Configuración',
      description: 'Ajusta tiendas, impuestos, métodos de pago e impresoras.',
    },
  },
  {
    element: '[data-tour="sidebar-auditoria"]',
    popover: {
      title: 'Auditoría',
      description: 'Revisa el registro de todas las acciones del sistema.',
    },
  },
];

const SELLER_STEPS: DriveStep[] = [
  {
    element: '[data-tour="sidebar"]',
    popover: {
      title: 'Menú de navegación',
      description: 'Estas son las secciones a las que tienes acceso.',
    },
  },
  {
    element: '[data-tour="store-selector"]',
    popover: {
      title: 'Tu tienda',
      description: 'Aquí ves en qué tienda estás trabajando.',
    },
  },
  {
    element: '[data-tour="sidebar-pos"]',
    popover: {
      title: 'Punto de Venta',
      description: 'Tu herramienta principal. Busca productos y registra ventas.',
    },
  },
  {
    element: '[data-tour="sidebar-catalogo"]',
    popover: {
      title: 'Catálogo',
      description: 'Consulta los productos disponibles y sus precios.',
    },
  },
  {
    element: '[data-tour="sidebar-inventario"]',
    popover: {
      title: 'Inventario',
      description: 'Consulta el stock disponible en tu tienda.',
    },
  },
  {
    element: '[data-tour="sidebar-ventas"]',
    popover: {
      title: 'Ventas',
      description: 'Revisa tus ventas y procesa devoluciones de clientes.',
    },
  },
];

function getStorageKey(role: string): string {
  return `tour_completed_${role}`;
}

/**
 * Provides a guided tour using driver.js.
 * Automatically shows the tour on first login and listens for
 * a 'start-tour' custom event to replay it from the user menu.
 */
export function TourProvider() {
  const role = useAuthStore((s) => s.user?.role ?? null);

  const startTour = useCallback(
    (force = false) => {
      if (!role) return;

      const key = getStorageKey(role);
      if (!force && localStorage.getItem(key) === 'true') return;

      const steps = role === 'admin' ? ADMIN_STEPS : SELLER_STEPS;

      const tourDriver = driver({
        showProgress: true,
        animate: true,
        nextBtnText: 'Siguiente',
        prevBtnText: 'Anterior',
        doneBtnText: 'Cerrar',
        popoverClass: 'tour-popover',
        steps,
        onDestroyed: () => {
          localStorage.setItem(key, 'true');
        },
      });

      // Small delay to ensure DOM elements are rendered
      setTimeout(() => tourDriver.drive(), 300);
    },
    [role],
  );

  // Auto-start on first visit
  useEffect(() => {
    if (!role) return;
    startTour(false);
  }, [role, startTour]);

  // Listen for replay event from the user menu
  useEffect(() => {
    const handler = () => startTour(true);
    globalThis.addEventListener('start-tour', handler);
    return () => globalThis.removeEventListener('start-tour', handler);
  }, [startTour]);

  return null;
}
