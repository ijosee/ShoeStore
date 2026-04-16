'use client';

/**
 * User profile page. Accessible by all authenticated users.
 *
 * Shows user info and assigned stores. Allows editing own name.
 *
 * Validates: Requirements 11.5, 11.7
 */

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { User, Save, Store, Shield } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { ROLE_LABELS } from '@/lib/constants';
import type { UserRole } from '@/types/database';

export default function PerfilPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const supabase = createClient();

  const [fullName, setFullName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch full profile with stores
  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('users')
        .select(
          `
          id,
          email,
          full_name,
          role,
          is_active,
          last_login_at,
          created_at,
          user_stores ( store_id, stores ( id, name, code, address, phone ) )
        `,
        )
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data as unknown as {
        id: string;
        email: string;
        full_name: string;
        role: UserRole;
        is_active: boolean;
        last_login_at: string | null;
        created_at: string;
        user_stores: Array<{
          store_id: string;
          stores: { id: string; name: string; code: string; address: string; phone: string } | null;
        }>;
      };
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user?.id || !fullName.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ full_name: fullName.trim() })
        .eq('id', user.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      toast.success('Perfil actualizado correctamente');
    } catch {
      toast.error('Error al actualizar el perfil');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">No se pudo cargar el perfil.</p>
      </div>
    );
  }

  const stores = (profile.user_stores ?? [])
    .filter((us): us is typeof us & { stores: NonNullable<typeof us.stores> } => us.stores !== null)
    .map((us) => us.stores);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <User className="size-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Mi Perfil</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="size-5" />
              Información Personal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Nombre completo</Label>
              <Input
                id="profile-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile.email} disabled />
              <p className="text-xs text-muted-foreground">
                El email no se puede cambiar.
              </p>
            </div>

            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && (
                <LoadingSpinner size="sm" className="mr-2 border-current border-t-transparent" />
              )}
              <Save className="mr-2 size-4" />
              Guardar Cambios
            </Button>
          </CardContent>
        </Card>

        {/* Role & Access */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="size-5" />
              Rol y Acceso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Rol</span>
              <Badge variant="default">
                {ROLE_LABELS[profile.role] ?? profile.role}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Estado</span>
              {profile.is_active ? (
                <Badge variant="default">Activo</Badge>
              ) : (
                <Badge variant="secondary">Inactivo</Badge>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Último acceso</span>
              <span className="text-sm">
                {profile.last_login_at
                  ? new Date(profile.last_login_at).toLocaleString('es-MX')
                  : 'Nunca'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Miembro desde</span>
              <span className="text-sm">
                {new Date(profile.created_at).toLocaleDateString('es-MX')}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Assigned Stores */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="size-5" />
              Tiendas Asignadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stores.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tienes tiendas asignadas.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stores.map((store) => (
                  <div
                    key={store.id}
                    className="rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{store.code}</Badge>
                      <span className="font-medium">{store.name}</span>
                    </div>
                    {store.address && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {store.address}
                      </p>
                    )}
                    {store.phone && (
                      <p className="text-xs text-muted-foreground">
                        Tel: {store.phone}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
