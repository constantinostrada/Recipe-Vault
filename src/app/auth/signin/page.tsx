/**
 * src/app/auth/signin/page.tsx
 *
 * Custom sign-in page.
 */

import type { Metadata } from 'next';

import { SignInForm } from '@/interfaces/components/auth/SignInForm';

export const metadata: Metadata = {
  title: 'Sign In',
};

export default function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-serif font-bold text-stone-800">Recipe Vault</h1>
          <p className="mt-2 text-stone-500">Sign in to save and share your recipes.</p>
        </div>
        <SignInForm />
      </div>
    </main>
  );
}
