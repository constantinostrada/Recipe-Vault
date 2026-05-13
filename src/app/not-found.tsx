/**
 * src/app/not-found.tsx
 *
 * Global 404 page.
 */

import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="text-center">
        <p className="text-8xl font-serif font-bold text-brand-500">404</p>
        <h1 className="mt-4 text-3xl font-semibold text-stone-800">Page Not Found</h1>
        <p className="mt-2 text-stone-500">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-xl bg-brand-500 text-white font-semibold
                     px-6 py-3 hover:bg-brand-600 transition-colors"
        >
          Go Home
        </Link>
      </div>
    </main>
  );
}
