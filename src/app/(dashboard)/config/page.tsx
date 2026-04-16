'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import { Settings, Store, Receipt, CreditCard, Printer, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

const configSections = [
  { href: '/config/tiendas', label: 'Tiendas', description: 'Gestionar datos de las tiendas', icon: Store },
  { href: '/config/impuestos', label: 'Impuestos', description: 'Configuración de tasas de IVA', icon: Receipt },
  { href: '/config/metodos-pago', label: 'Métodos de Pago', description: 'Gestionar métodos de pago del POS', icon: CreditCard },
  { href: '/config/ticket', label: 'Plantilla de Ticket', description: 'Configurar formato de tickets impresos', icon: FileText },
  { href: '/config/impresoras', label: 'Impresoras', description: 'Gestionar impresoras Bluetooth', icon: Printer },
];

export default function ConfigPage() {
  const router = useRouter();
  const { role, hasPermission } = usePermissions();
  const canManage = hasPermission('config.manage');

  useEffect(() => {
    if (role && !canManage) {
      router.replace('/');
    }
  }, [role, canManage, router]);

  if (role && !canManage) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="size-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Configuración</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {configSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <Icon className="size-5 text-muted-foreground" />
                  <CardTitle className="text-base">{section.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{section.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
