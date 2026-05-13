/**
 * src/app/recipes/page.tsx
 *
 * Public recipe browsing page.
 */

import type { Metadata } from 'next';

import { RecipeGrid } from '@/interfaces/components/recipes/RecipeGrid';

export const metadata: Metadata = {
  title: 'Browse Recipes',
  description: 'Discover public recipes from the Recipe Vault community.',
};

export default function RecipesPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-12">
      <header className="mb-10">
        <h1 className="text-4xl font-serif font-bold text-stone-800">Browse Recipes</h1>
        <p className="mt-2 text-stone-500 text-lg">
          Explore community recipes — filter by difficulty, tags, or search by name.
        </p>
      </header>
      <RecipeGrid />
    </main>
  );
}
