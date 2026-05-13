/**
 * src/interfaces/components/layout/Navbar.tsx
 *
 * Application-wide navigation bar.
 * Shows auth state and links to main sections.
 */

'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';

export function Navbar() {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-stone-100 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 flex h-16 items-center justify-between">
        {/* Brand */}
        <Link
          href="/"
          className="font-serif text-xl font-bold text-brand-600 hover:text-brand-700 transition-colors"
        >
          🥘 Recipe Vault
        </Link>

        {/* Nav links */}
        <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-stone-600">
          <Link href="/recipes" className="hover:text-brand-600 transition-colors">
            Browse
          </Link>
          {session && (
            <Link href="/dashboard" className="hover:text-brand-600 transition-colors">
              My Recipes
            </Link>
          )}
        </div>

        {/* Auth */}
        <div className="flex items-center gap-3">
          {isLoading ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-stone-100" />
          ) : session?.user ? (
            <div className="flex items-center gap-3">
              {session.user.image && (
                <Image
                  src={session.user.image}
                  alt={session.user.name ?? 'User avatar'}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              )}
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link href="/auth/signin" className="btn-primary text-xs px-4 py-2">
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
