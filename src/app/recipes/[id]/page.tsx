/**
 * src/app/recipes/[id]/page.tsx
 *
 * Recipe detail page — server component that fetches the recipe
 * via the API and renders it.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { RecipeDetail } from '@/interfaces/components/recipes/RecipeDetail';
import type { RecipeDto } from '@/application/dtos/RecipeDto';

interface Props {
  params: { id: string };
}

async function fetchRecipe(id: string): Promise<RecipeDto | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/recipes/${id}`, {
    next: { revalidate: 60 },
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch recipe');

  const json = await res.json();
  return json.data as RecipeDto;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const recipe = await fetchRecipe(params.id);
  if (!recipe) return { title: 'Recipe Not Found' };

  return {
    title: recipe.title,
    description: recipe.description ?? undefined,
  };
}

export default async function RecipeDetailPage({ params }: Props) {
  const recipe = await fetchRecipe(params.id);

  if (!recipe) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <RecipeDetail recipe={recipe} />
    </main>
  );
}
