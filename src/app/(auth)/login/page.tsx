'use client';

/**
 * Login page for ShoeStore POS & Inventario.
 *
 * Features:
 * - Multi-layer parallax that follows mouse movement
 * - Floating shoe emojis at different depths
 * - Glassmorphism card with 3D tilt effect
 * - Animated gradient background with moving particles
 * - Account lockout after 5 failed attempts (15 min)
 *
 * Validates: Requirements 11.1, 11.3, 11.4
 */

import { useState, useEffect, useRef, useCallback } from 'react';
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

/* Three parallax layers: back (slow), mid, front (fast) */
const PARALLAX_SHOES = [
  // Back layer — large, slow, subtle
  { emoji: '👟', x: 10, y: 15, size: 48, depth: 0.015, delay: 0 },
  { emoji: '👠', x: 80, y: 20, size: 44, depth: 0.015, delay: 0.8 },
  { emoji: '👢', x: 25, y: 75, size: 50, depth: 0.02, delay: 1.6 },
  { emoji: '👞', x: 85, y: 70, size: 46, depth: 0.015, delay: 0.4 },
  // Mid layer — medium
  { emoji: '🥿', x: 50, y: 10, size: 36, depth: 0.035, delay: 0.6 },
  { emoji: '👡', x: 15, y: 45, size: 34, depth: 0.04, delay: 1.2 },
  { emoji: '👟', x: 75, y: 45, size: 38, depth: 0.035, delay: 1.8 },
  { emoji: '👠', x: 40, y: 80, size: 32, depth: 0.04, delay: 0.2 },
  // Front layer — small, fast, more movement
  { emoji: '🩴', x: 30, y: 25, size: 26, depth: 0.06, delay: 1 },
  { emoji: '👞', x: 65, y: 30, size: 24, depth: 0.065, delay: 1.4 },
  { emoji: '👢', x: 20, y: 60, size: 28, depth: 0.055, delay: 0.5 },
  { emoji: '🥿', x: 70, y: 65, size: 22, depth: 0.07, delay: 1.7 },
  { emoji: '👡', x: 55, y: 85, size: 24, depth: 0.06, delay: 0.9 },
  { emoji: '👟', x: 90, y: 50, size: 26, depth: 0.065, delay: 1.3 },
];

const LOCKOUT_MINUTES = 15;

export default function LoginPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animatedRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const [mounted, setMounted] = useState(false);

  /* Smooth parallax animation loop */
  const animate = useCallback(() => {
    const lerp = 0.08;
    animatedRef.current.x += (mouseRef.current.x - animatedRef.current.x) * lerp;
    animatedRef.current.y += (mouseRef.current.y - animatedRef.current.y) * lerp;

    const container = containerRef.current;
    if (container) {
      const mx = animatedRef.current.x;
      const my = animatedRef.current.y;

      // Move each parallax shoe
      const shoes = container.querySelectorAll<HTMLElement>('[data-parallax]');
      shoes.forEach((el) => {
        const depth = Number.parseFloat(el.dataset.depth ?? '0');
        const offsetX = mx * depth * 100;
        const offsetY = my * depth * 100;
        el.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
      });

      // Move orbs (background glow)
      const orbs = container.querySelectorAll<HTMLElement>('[data-orb]');
      orbs.forEach((el, i) => {
        const speed = 0.02 + i * 0.01;
        el.style.transform = `translate(${mx * speed * 60}px, ${my * speed * 60}px)`;
      });

      // Tilt the card
      const card = container.querySelector<HTMLElement>('[data-card]');
      if (card) {
        const tiltX = my * 4;
        const tiltY = -mx * 4;
        card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
      }

      // Move grid
      const grid = container.querySelector<HTMLElement>('[data-grid]');
      if (grid) {
        grid.style.transform = `translate(${mx * 8}px, ${my * 8}px)`;
      }
    }

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    setMounted(true);

    const handleMouseMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      mouseRef.current.x = (e.clientX - cx) / cx;  // -1 to 1
      mouseRef.current.y = (e.clientY - cy) / cy;
    };

    globalThis.addEventListener('mousemove', handleMouseMove);
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      globalThis.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [animate]);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const validation = loginSchema.safeParse({ email, password });
      if (!validation.success) {
        const firstIssue = validation.error.issues[0];
        setError({ type: 'validation', message: firstIssue?.message ?? 'Datos inválidos' });
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
          const minutesLeft = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60000));
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
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

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

        setError({ type: 'credentials', message: 'Correo electrónico o contraseña incorrectos.' });
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
      setError({ type: 'general', message: 'Ocurrió un error inesperado. Intenta de nuevo.' });
      setIsLoading(false);
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 px-4 py-12"
    >
      {/* Animated background grid — parallax layer */}
      <div
        data-grid
        className="absolute inset-[-20px] bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px] transition-none"
      />

      {/* Glowing orbs — parallax layer (slow) */}
      <div data-orb className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-teal-500/20 blur-[140px]" />
      <div data-orb className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-amber-500/15 blur-[140px]" />
      <div data-orb className="absolute left-1/3 top-1/4 h-80 w-80 rounded-full bg-purple-500/10 blur-[120px]" />

      {/* Floating shoe emojis — multi-depth parallax */}
      {mounted && PARALLAX_SHOES.map((shoe, i) => (
        <span
          key={`shoe-${shoe.emoji}-${shoe.x}-${shoe.y}`}
          data-parallax
          data-depth={shoe.depth}
          className="absolute select-none will-change-transform"
          style={{
            left: `${shoe.x}%`,
            top: `${shoe.y}%`,
            fontSize: `${shoe.size}px`,
            opacity: 0,
            animation: `fadeInShoe 1s ease-out ${shoe.delay}s forwards, bobShoe ${6 + (i % 3) * 2}s ease-in-out ${shoe.delay}s infinite`,
          }}
        >
          {shoe.emoji}
        </span>
      ))}

      {/* Shoe silhouettes — deep parallax (very slow) */}
      <div data-parallax data-depth="0.01" className="absolute left-[5%] top-[40%] hidden lg:block will-change-transform">
        <svg viewBox="0 0 200 120" className="h-36 w-52 text-white/[0.03]" fill="currentColor">
          <path d="M20,80 Q30,40 60,35 Q90,30 120,40 Q150,50 170,45 Q190,40 195,55 L195,85 Q190,95 170,95 L30,95 Q15,95 15,85 Z" />
          <path d="M60,35 Q65,25 80,22 Q95,20 100,28 Q90,30 80,32 Z" opacity="0.5" />
        </svg>
      </div>
      <div data-parallax data-depth="0.012" className="absolute right-[5%] top-[25%] hidden lg:block will-change-transform">
        <svg viewBox="0 0 120 180" className="h-44 w-32 text-white/[0.03]" fill="currentColor">
          <path d="M30,170 L30,60 Q30,30 50,15 Q65,5 75,10 Q85,15 80,30 L75,50 Q90,55 100,70 Q110,85 105,100 L100,170 Z" />
        </svg>
      </div>
      <div data-parallax data-depth="0.008" className="absolute left-[60%] bottom-[10%] hidden lg:block will-change-transform">
        <svg viewBox="0 0 200 120" className="h-28 w-44 rotate-12 text-white/[0.025]" fill="currentColor">
          <path d="M20,80 Q30,40 60,35 Q90,30 120,40 Q150,50 170,45 Q190,40 195,55 L195,85 Q190,95 170,95 L30,95 Q15,95 15,85 Z" />
        </svg>
      </div>

      {/* Login card — 3D tilt parallax */}
      <div
        className={`relative z-10 w-full max-w-md transition-all duration-700 ${
          mounted ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
        }`}
      >
        {/* Card glow — follows mouse subtly */}
        <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-teal-500/20 via-purple-500/10 to-amber-500/20 blur-2xl" />

        <div
          data-card
          className="relative rounded-2xl border border-white/10 bg-white/[0.07] p-8 shadow-2xl backdrop-blur-xl transition-[box-shadow] duration-300 will-change-transform hover:shadow-teal-500/10"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Logo / Brand */}
          <div className="mb-8 text-center" style={{ transform: 'translateZ(40px)' }}>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 shadow-lg shadow-teal-500/30 transition-transform duration-300 hover:scale-110 hover:rotate-6">
              <span className="text-3xl" role="img" aria-label="Zapato">👟</span>
            </div>
            <h1 className="bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
              Zapatería Rocío
            </h1>
            <p className="mt-2 text-sm text-white/50">
              Sistema de punto de venta e inventario
            </p>
            <div className="mx-auto mt-3 h-0.5 w-20 rounded-full bg-gradient-to-r from-transparent via-teal-400/60 to-transparent" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" style={{ transform: 'translateZ(20px)' }}>
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
                {error.type === 'locked' && <Lock className="mt-0.5 h-4 w-4 shrink-0" />}
                <span>{error.message}</span>
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-white/70">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
                required
                className="h-11 rounded-xl border-white/10 bg-white/[0.06] text-white placeholder:text-white/30 focus:border-teal-400/50 focus:ring-teal-400/20 transition-all duration-200 hover:bg-white/[0.1]"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-white/70">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="h-11 rounded-xl border-white/10 bg-white/[0.06] pr-10 text-white placeholder:text-white/30 focus:border-teal-400/50 focus:ring-teal-400/20 transition-all duration-200 hover:bg-white/[0.1]"
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

            {/* Submit */}
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
          <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-white/25" style={{ transform: 'translateZ(10px)' }}>
            <span>👟</span>
            <span>Zapatería Rocío © {new Date().getFullYear()}</span>
          </div>
        </div>
      </div>

      {/* Keyframe animations */}
      <style jsx global>{`
        @keyframes bobShoe {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-12px) rotate(4deg); }
          66% { transform: translateY(-6px) rotate(-3deg); }
        }
        @keyframes fadeInShoe {
          from { opacity: 0; transform: scale(0.3); }
          to { opacity: 0.2; transform: scale(1); }
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
