/**
 * src/app/recipes/new/page.tsx
 *
 * Authenticated page for creating a new recipe.
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/infrastructure/auth/authOptions';
import { RecipeForm } from '@/interfaces/components/recipes/RecipeForm';

export const metadata: Metadata = {
  title: 'New Recipe',
};

export default async function NewRecipePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/signin?callbackUrl=/recipes/new');
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-4xl font-serif font-bold text-stone-800 mb-8">New Recipe</h1>
      <RecipeForm />
    </main>
  );
}
