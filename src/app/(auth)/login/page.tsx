'use client';

/**
 * Login page for ShoeStore POS & Inventario.
 *
 * Features:
 * - Email + password form
 * - Password visibility toggle
 * - "Recordar sesión" checkbox
 * - Loading, error, and account lockout states
 * - Account lockout after 5 failed attempts (15 min)
 *
 * Validates: Requirements 11.1, 11.3, 11.4
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Lock, ShoppingBag } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { loginSchema } from '@/lib/validators/auth';

type LoginError = {
  type: 'validation' | 'credentials' | 'locked' | 'general';
  message: string;
  lockedUntil?: string;
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Client-side validation
      const validation = loginSchema.safeParse({ email, password });
      if (!validation.success) {
        const firstIssue = validation.error.issues[0];
        setError({
          type: 'validation',
          message: firstIssue?.message ?? 'Datos inválidos',
        });
        setIsLoading(false);
        return;
      }

      // Check account lockout before attempting login
      const lockoutRes = await fetch('/api/auth/lockout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', email }),
      });

      if (lockoutRes.ok) {
        const lockoutData = await lockoutRes.json();
        if (lockoutData.is_locked) {
          const lockedUntil = new Date(lockoutData.locked_until);
          const minutesLeft = Math.max(
            1,
            Math.ceil((lockedUntil.getTime() - Date.now()) / 60000)
          );
          setError({
            type: 'locked',
            message: `Cuenta bloqueada. Intenta de nuevo en ${minutesLeft} ${minutesLeft === 1 ? 'minuto' : 'minutos'}.`,
            lockedUntil: lockoutData.locked_until,
          });
          setIsLoading(false);
          return;
        }
      }

      // Attempt sign in with Supabase Auth
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // Record failed login attempt
        const failRes = await fetch('/api/auth/lockout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'record_failure', email }),
        });

        if (failRes.ok) {
          const failData = await failRes.json();
          if (failData.is_locked) {
            setError({
              type: 'locked',
              message: `Cuenta bloqueada por demasiados intentos fallidos. Intenta de nuevo en ${LOCKOUT_MINUTES} minutos.`,
              lockedUntil: failData.locked_until,
            });
            setIsLoading(false);
            return;
          }
        }

        setError({
          type: 'credentials',
          message: 'Correo electrónico o contraseña incorrectos.',
        });
        setIsLoading(false);
        return;
      }

      // Successful login — reset failed attempts
      await fetch('/api/auth/lockout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', email }),
      });

      // Redirect to dashboard
      router.push('/');
      router.refresh();
    } catch {
      setError({
        type: 'general',
        message: 'Ocurrió un error inesperado. Intenta de nuevo.',
      });
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShoppingBag className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Zapatería Rocío</CardTitle>
          <CardDescription>
            Ingresa tus credenciales para acceder al sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error message */}
            {error && (
              <div
                role="alert"
                className={`flex items-start gap-2 rounded-md border px-4 py-3 text-sm ${
                  error.type === 'locked'
                    ? 'border-orange-200 bg-orange-50 text-orange-800'
                    : 'border-destructive/20 bg-destructive/5 text-destructive'
                }`}
              >
                {error.type === 'locked' && (
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span>{error.message}</span>
              </div>
            )}

            {/* Email field */}
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
                required
              />
            </div>

            {/* Password field with visibility toggle */}
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={
                    showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember session checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberSession}
                onCheckedChange={(checked) =>
                  setRememberSession(checked === true)
                }
                disabled={isLoading}
              />
              <Label
                htmlFor="remember"
                className="text-sm font-normal cursor-pointer"
              >
                Recordar sesión
              </Label>
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar sesión'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

const LOCKOUT_MINUTES = 15;
