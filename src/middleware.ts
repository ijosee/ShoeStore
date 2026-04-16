/**
 * Next.js middleware for authentication and RBAC route protection.
 *
 * 1. Refreshes the Supabase auth session via updateSession().
 * 2. For role-protected routes, fetches the user's role from the `users` table
 *    and redirects to / (dashboard) if the user lacks permission.
 *
 * Validates: Requirements 11.6, 11.7, 2.2, 2.3
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { ADMIN_ONLY_PATHS, MANAGER_ADMIN_PATHS } from '@/lib/constants';

/**
 * Check if a pathname starts with any of the given prefixes.
 */
function matchesAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  // --- 1. Refresh the auth session (handles redirect to /login if not authenticated) ---
  const { updateSession } = await import('@/lib/supabase/middleware');
  const response = await updateSession(request);

  // If updateSession returned a redirect (e.g. to /login), honour it immediately.
  if (response.headers.get('location')) {
    return response;
  }

  // --- 2. Role-based route protection ---
  const { pathname } = request.nextUrl;
  const needsAdmin = matchesAny(pathname, ADMIN_ONLY_PATHS);
  const needsManagerOrAdmin = matchesAny(pathname, MANAGER_ADMIN_PATHS);

  if (!needsAdmin && !needsManagerOrAdmin) {
    // No role restriction on this route — allow through.
    return response;
  }

  // We need to check the user's role. Create a Supabase client that reads
  // cookies from the *request* (the same way updateSession does).
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Should not happen (updateSession already redirects), but guard anyway.
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Fetch the role from the users table.
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role as string | undefined;

  // Admin-only routes: only admin can access.
  if (needsAdmin && role !== 'admin') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Manager/Admin routes: admin or manager can access.
  if (needsManagerOrAdmin && role !== 'admin' && role !== 'manager') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Only run middleware on page routes, not on:
     * - _next (all static/compiled assets)
     * - api routes (handled by their own auth)
     * - static files (images, fonts, sw.js, manifest, etc.)
     * - login and auth callback pages
     */
    '/((?!_next|api|favicon\\.ico|sw\\.js|manifest\\.webmanifest|icon-.*\\.png|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.webp|login|auth).*)',
  ],
};
