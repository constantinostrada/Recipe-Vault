/**
 * src/interfaces/components/recipes/RecipeGrid.tsx
 *
 * Client component that fetches recipes from the API and renders
 * a responsive grid of RecipeCards.
 */

'use client';

import { useEffect, useState } from 'react';

import type { PaginatedRecipesDto, RecipeSummaryDto } from '@/application/dtos/RecipeDto';

import { RecipeCard } from './RecipeCard';

interface Props {
  authorId?: string;
  showPrivate?: boolean;
}

export function RecipeGrid({ authorId, showPrivate }: Props) {
  const [recipes, setRecipes] = useState<RecipeSummaryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (authorId) params.set('authorId', authorId);
    if (!showPrivate) params.set('isPublic', 'true');

    fetch(`/api/recipes?${params.toString()}`)
      .then((r) => r.json())
      .then((json: { success: boolean; data: PaginatedRecipesDto }) => {
        if (json.success) {
          setRecipes(json.data.data);
        } else {
          setError('Failed to load recipes.');
        }
      })
      .catch(() => setError('Failed to load recipes.'))
      .finally(() => setIsLoading(false));
  }, [authorId, showPrivate]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card h-64 animate-pulse">
            <div className="h-40 bg-stone-100 rounded-t-2xl" />
            <div className="p-5 space-y-2">
              <div className="h-4 bg-stone-100 rounded w-3/4" />
              <div className="h-3 bg-stone-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center text-red-600">
        {error}
      </div>
    );
  }

  if (recipes.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-stone-200 p-16 text-center">
        <p className="text-4xl mb-3">📭</p>
        <p className="text-stone-500 font-medium">No recipes here yet.</p>
        <p className="text-stone-400 text-sm mt-1">
          Be the first to add one!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} />
      ))}
    </div>
  );
}
