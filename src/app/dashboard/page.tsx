/**
 * src/app/dashboard/page.tsx
 *
 * User dashboard — shows the authenticated user's own recipes.
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/infrastructure/auth/authOptions';
import { RecipeGrid } from '@/interfaces/components/recipes/RecipeGrid';

export const metadata: Metadata = {
  title: 'My Dashboard',
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/dashboard');
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-12">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif font-bold text-stone-800">My Recipes</h1>
          <p className="mt-1 text-stone-500">
            {session.user.name ? `Welcome back, ${session.user.name}!` : 'Welcome back!'}
          </p>
        </div>
        <a
          href="/recipes/new"
          className="rounded-xl bg-brand-500 text-white font-semibold px-6 py-3
                     hover:bg-brand-600 transition-colors"
        >
          + New Recipe
        </a>
      </header>
      <RecipeGrid authorId={session.user.id} showPrivate />
    </main>
  );
}
