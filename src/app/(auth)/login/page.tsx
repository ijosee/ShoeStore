'use client';

/**
 * Login page for ShoeStore POS & Inventario.
 *
 * Features:
 * - Animated shoe-themed background with floating shoes
 * - Email + password form with glassmorphism card
 * - Password visibility toggle
 * - "Recordar sesión" checkbox
 * - Loading, error, and account lockout states
 * - Account lockout after 5 failed attempts (15 min)
 *
 * Validates: Requirements 11.1, 11.3, 11.4
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
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

const SHOE_EMOJIS = ['👟', '👠', '👢', '👞', '🥿', '👡', '🩴', '👟', '👠', '👢', '👞', '🥿'];

const LOCKOUT_MINUTES = 15;

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
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

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
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

      await fetch('/api/auth/lockout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', email }),
      });

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 px-4 py-12">
      {/* Animated background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />

      {/* Glowing orbs */}
      <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-teal-500/20 blur-[120px] animate-pulse" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-amber-500/15 blur-[120px] animate-pulse [animation-delay:2s]" />
      <div className="absolute left-1/2 top-1/4 h-64 w-64 -translate-x-1/2 rounded-full bg-teal-400/10 blur-[100px] animate-pulse [animation-delay:4s]" />

      {/* Floating shoe emojis */}
      {mounted && SHOE_EMOJIS.map((emoji, i) => (
        <span
          key={i}
          className="absolute select-none text-2xl opacity-0 sm:text-3xl"
          style={{
            left: `${8 + (i * 7.5) % 85}%`,
            top: `${5 + (i * 13) % 80}%`,
            animation: `floatShoe ${8 + (i % 4) * 2}s ease-in-out infinite, fadeInShoe 0.8s ease-out ${i * 0.15}s forwards`,
            animationDelay: `${i * 0.15}s, ${i * 0.15}s`,
          }}
        >
          {emoji}
        </span>
      ))}

      {/* Animated shoe silhouette - left */}
      <div className="absolute left-8 top-1/2 -translate-y-1/2 hidden lg:block">
        <svg
          viewBox="0 0 200 120"
          className="h-32 w-48 text-white/[0.04] animate-[sway_6s_ease-in-out_infinite]"
          fill="currentColor"
        >
          <path d="M20,80 Q30,40 60,35 Q90,30 120,40 Q150,50 170,45 Q190,40 195,55 L195,85 Q190,95 170,95 L30,95 Q15,95 15,85 Z" />
          <path d="M60,35 Q65,25 80,22 Q95,20 100,28 Q90,30 80,32 Z" opacity="0.5" />
        </svg>
      </div>

      {/* Animated shoe silhouette - right */}
      <div className="absolute right-8 top-1/3 hidden lg:block">
        <svg
          viewBox="0 0 120 180"
          className="h-40 w-28 text-white/[0.04] animate-[sway_7s_ease-in-out_infinite_reverse]"
          fill="currentColor"
        >
          <path d="M30,170 L30,60 Q30,30 50,15 Q65,5 75,10 Q85,15 80,30 L75,50 Q90,55 100,70 Q110,85 105,100 L100,170 Z" />
        </svg>
      </div>

      {/* Login card */}
      <div
        className={`relative z-10 w-full max-w-md transition-all duration-700 ${
          mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        }`}
      >
        {/* Card glow effect */}
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-teal-500/20 via-transparent to-amber-500/20 blur-xl" />

        <div className="relative rounded-2xl border border-white/10 bg-white/[0.07] p-8 shadow-2xl backdrop-blur-xl">
          {/* Logo / Brand */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 shadow-lg shadow-teal-500/25 transition-transform hover:scale-105">
              <span className="text-3xl" role="img" aria-label="Zapato">👟</span>
            </div>
            <h1 className="bg-gradient-to-r from-white to-white/80 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
              Zapatería Rocío
            </h1>
            <p className="mt-2 text-sm text-white/50">
              Sistema de punto de venta e inventario
            </p>

            {/* Animated underline */}
            <div className="mx-auto mt-3 h-0.5 w-16 rounded-full bg-gradient-to-r from-transparent via-teal-400 to-transparent animate-pulse" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error message */}
            {error && (
              <div
                role="alert"
                className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm backdrop-blur-sm animate-[shakeX_0.5s_ease-in-out] ${
                  error.type === 'locked'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                    : 'border-red-500/30 bg-red-500/10 text-red-200'
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
              <Label htmlFor="email" className="text-sm font-medium text-white/70">
                Correo electrónico
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
                required
                className="h-11 rounded-xl border-white/10 bg-white/[0.06] text-white placeholder:text-white/30 focus:border-teal-400/50 focus:ring-teal-400/20 transition-all duration-200 hover:bg-white/[0.08]"
              />
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-white/70">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="h-11 rounded-xl border-white/10 bg-white/[0.06] pr-10 text-white placeholder:text-white/30 focus:border-teal-400/50 focus:ring-teal-400/20 transition-all duration-200 hover:bg-white/[0.08]"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-white/70"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember session */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberSession}
                onCheckedChange={(checked) => setRememberSession(checked === true)}
                disabled={isLoading}
                className="border-white/20 data-[state=checked]:bg-teal-500 data-[state=checked]:border-teal-500"
              />
              <Label htmlFor="remember" className="cursor-pointer text-sm font-normal text-white/50">
                Recordar sesión
              </Label>
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              className="h-11 w-full rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 text-white font-semibold shadow-lg shadow-teal-500/25 transition-all duration-200 hover:from-teal-400 hover:to-teal-500 hover:shadow-teal-500/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
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

          {/* Footer */}
          <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-white/25">
            <span>👟</span>
            <span>Zapatería Rocío © {new Date().getFullYear()}</span>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes floatShoe {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-15px) rotate(5deg); }
          50% { transform: translateY(-8px) rotate(-3deg); }
          75% { transform: translateY(-20px) rotate(3deg); }
        }
        @keyframes fadeInShoe {
          from { opacity: 0; transform: scale(0.5) translateY(20px); }
          to { opacity: 0.15; transform: scale(1) translateY(0); }
        }
        @keyframes sway {
          0%, 100% { transform: translateY(-50%) rotate(-3deg); }
          50% { transform: translateY(-50%) rotate(3deg); }
        }
        @keyframes shakeX {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
