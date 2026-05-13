/**
 * src/interfaces/components/recipes/RecipeCard.tsx
 *
 * Card component for displaying a recipe summary in grids and lists.
 * Receives a RecipeSummaryDto — no domain entities here.
 */

import Link from 'next/link';

import type { RecipeSummaryDto } from '@/application/dtos/RecipeDto';

interface Props {
  recipe: RecipeSummaryDto;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: 'bg-green-100 text-green-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HARD: 'bg-orange-100 text-orange-700',
  EXPERT: 'bg-red-100 text-red-700',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
  EXPERT: 'Expert',
};

export function RecipeCard({ recipe }: Props) {
  const difficultyColor = DIFFICULTY_COLORS[recipe.difficulty] ?? 'bg-stone-100 text-stone-600';
  const difficultyLabel = DIFFICULTY_LABELS[recipe.difficulty] ?? recipe.difficulty;

  return (
    <Link href={`/recipes/${recipe.id}`} className="group block">
      <article className="card overflow-hidden hover:shadow-md transition-shadow h-full">
        {/* Placeholder hero */}
        <div className="h-40 bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
          <span className="text-5xl" aria-hidden="true">
            🍽️
          </span>
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-serif font-semibold text-stone-800 text-lg leading-snug line-clamp-2 group-hover:text-brand-600 transition-colors">
              {recipe.title}
            </h3>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${difficultyColor}`}
            >
              {difficultyLabel}
            </span>
          </div>

          {recipe.description && (
            <p className="text-stone-500 text-sm line-clamp-2 mb-3">{recipe.description}</p>
          )}

          <div className="flex items-center gap-4 text-xs text-stone-400">
            <span>⏱ {recipe.totalTimeMin} min</span>
            <span>🍽 {recipe.servings} servings</span>
            {!recipe.isPublic && (
              <span className="ml-auto rounded-full bg-stone-100 px-2 py-0.5 text-stone-500 font-medium">
                Private
              </span>
            )}
          </div>

          {recipe.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {recipe.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-600"
                >
                  {tag}
                </span>
              ))}
              {recipe.tags.length > 3 && (
                <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-400">
                  +{recipe.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
