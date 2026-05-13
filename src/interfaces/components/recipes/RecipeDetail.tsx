/**
 * src/interfaces/components/recipes/RecipeDetail.tsx
 *
 * Full recipe detail view.
 * Receives a RecipeDto — no domain entities.
 */

import Link from 'next/link';

import type { RecipeDto } from '@/application/dtos/RecipeDto';

interface Props {
  recipe: RecipeDto;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
  EXPERT: 'Expert',
};

export function RecipeDetail({ recipe }: Props) {
  return (
    <article>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1 className="font-serif text-4xl font-bold text-stone-800">{recipe.title}</h1>
          {!recipe.isPublic && (
            <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-500 font-medium">
              Private
            </span>
          )}
        </div>
        {recipe.description && (
          <p className="mt-3 text-stone-600 text-lg leading-relaxed">{recipe.description}</p>
        )}

        {/* ── Stats ────────────────────────────────────────────────── */}
        <dl className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Prep Time', value: `${recipe.prepTimeMin} min` },
            { label: 'Cook Time', value: `${recipe.cookTimeMin} min` },
            { label: 'Servings', value: recipe.servings.toString() },
            {
              label: 'Difficulty',
              value: DIFFICULTY_LABELS[recipe.difficulty] ?? recipe.difficulty,
            },
          ].map(({ label, value }) => (
            <div key={label} className="card p-4 text-center">
              <dt className="text-xs text-stone-400 uppercase tracking-wide">{label}</dt>
              <dd className="mt-1 font-semibold text-stone-800">{value}</dd>
            </div>
          ))}
        </dl>

        {/* ── Tags ─────────────────────────────────────────────────── */}
        {recipe.tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {recipe.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-brand-50 text-brand-700 px-3 py-1 text-sm font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* ── Ingredients ────────────────────────────────────────────── */}
        <aside className="md:col-span-1">
          <div className="card p-6 sticky top-24">
            <h2 className="font-serif text-xl font-semibold text-stone-800 mb-4">
              Ingredients
            </h2>
            <ul className="space-y-3">
              {recipe.ingredients.map((ingredient) => (
                <li key={ingredient.id} className="flex items-baseline justify-between gap-2">
                  <span className="text-stone-700">{ingredient.ingredientName}</span>
                  <span className="text-stone-400 text-sm shrink-0">
                    {ingredient.quantity} {ingredient.unit}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* ── Steps ──────────────────────────────────────────────────── */}
        <main className="md:col-span-2">
          <h2 className="font-serif text-xl font-semibold text-stone-800 mb-4">
            Instructions
          </h2>
          <ol className="space-y-6">
            {recipe.steps.map((step) => (
              <li key={step.id} className="flex gap-4">
                <span className="flex-shrink-0 h-8 w-8 rounded-full bg-brand-500 text-white text-sm font-bold flex items-center justify-center mt-0.5">
                  {step.stepNumber}
                </span>
                <div>
                  <p className="text-stone-700 leading-relaxed">{step.instruction}</p>
                  {step.durationMin !== null && (
                    <p className="mt-1 text-xs text-stone-400">⏱ {step.durationMin} min</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </main>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="mt-12 pt-6 border-t border-stone-100">
        <Link href="/recipes" className="text-sm text-brand-500 hover:underline">
          ← Back to recipes
        </Link>
      </footer>
    </article>
  );
}
