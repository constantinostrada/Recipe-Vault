/**
 * src/app/auth/error/page.tsx
 *
 * Auth error page — shown when NextAuth encounters an error.
 */

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Authentication Error',
};

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const messages: Record<string, string> = {
    OAuthSignin: 'Could not start the sign-in flow. Please try again.',
    OAuthCallback: 'Something went wrong during sign-in. Please try again.',
    OAuthCreateAccount: 'Could not create your account. Please try again.',
    EmailCreateAccount: 'Could not create your account. Please try again.',
    Callback: 'An error occurred during authentication.',
    OAuthAccountNotLinked:
      'An account with this email already exists using a different provider.',
    default: 'An unexpected authentication error occurred.',
  };

  const errorMessage =
    messages[searchParams.error ?? 'default'] ?? messages.default;

  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="rounded-2xl bg-white shadow-sm border border-stone-100 p-10">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-serif font-bold text-stone-800 mb-3">
            Authentication Error
          </h1>
          <p className="text-stone-600 mb-8">{errorMessage}</p>
          <Link
            href="/auth/signin"
            className="inline-block rounded-xl bg-brand-500 text-white font-semibold
                       px-6 py-3 hover:bg-brand-600 transition-colors"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}
