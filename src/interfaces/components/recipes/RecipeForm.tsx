/**
 * src/interfaces/components/recipes/RecipeForm.tsx
 *
 * Client component for creating a new recipe.
 * Submits to POST /api/recipes.
 *
 * Input validation here is presentation-layer validation (required fields,
 * string lengths). Business rules are enforced by the domain.
 */

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function RecipeForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const form = e.currentTarget;
    const data = new FormData(form);

    const payload = {
      title: data.get('title') as string,
      description: (data.get('description') as string) || undefined,
      servings: Number(data.get('servings')),
      prepTimeMin: Number(data.get('prepTimeMin')),
      cookTimeMin: Number(data.get('cookTimeMin')),
      difficulty: data.get('difficulty') as string,
      isPublic: data.get('isPublic') === 'on',
      ingredients: [
        {
          ingredientId: 'placeholder',
          ingredientName: data.get('ingredientName') as string,
          quantity: Number(data.get('ingredientQty')),
          unit: data.get('ingredientUnit') as string,
        },
      ],
      steps: [
        {
          stepNumber: 1,
          instruction: data.get('step1') as string,
        },
      ],
      tags: (data.get('tags') as string)
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };

    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error?.message ?? 'Failed to create recipe.');
        return;
      }

      router.push(`/recipes/${json.data.id}`);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Basic info ────────────────────────────────────────────── */}
      <section className="card p-6 space-y-5">
        <h2 className="font-serif text-xl font-semibold text-stone-800">Basic Info</h2>

        <div>
          <label htmlFor="title" className="label">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            minLength={3}
            maxLength={120}
            placeholder="e.g. Classic Spaghetti Bolognese"
            className="input"
          />
        </div>

        <div>
          <label htmlFor="description" className="label">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={2000}
            placeholder="A short description of your recipe…"
            className="input resize-none"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label htmlFor="servings" className="label">
              Servings <span className="text-red-500">*</span>
            </label>
            <input
              id="servings"
              name="servings"
              type="number"
              required
              min={1}
              defaultValue={2}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="prepTimeMin" className="label">
              Prep (min)
            </label>
            <input
              id="prepTimeMin"
              name="prepTimeMin"
              type="number"
              min={0}
              defaultValue={10}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="cookTimeMin" className="label">
              Cook (min)
            </label>
            <input
              id="cookTimeMin"
              name="cookTimeMin"
              type="number"
              min={0}
              defaultValue={30}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="difficulty" className="label">
              Difficulty
            </label>
            <select id="difficulty" name="difficulty" className="input">
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
              <option value="EXPERT">Expert</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="tags" className="label">
            Tags <span className="text-stone-400 font-normal">(comma-separated)</span>
          </label>
          <input
            id="tags"
            name="tags"
            type="text"
            placeholder="Italian, Vegetarian, Quick…"
            className="input"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="isPublic"
            name="isPublic"
            type="checkbox"
            className="h-4 w-4 rounded border-stone-300 text-brand-500 focus:ring-brand-500"
          />
          <label htmlFor="isPublic" className="text-sm text-stone-700 cursor-pointer">
            Make this recipe public
          </label>
        </div>
      </section>

      {/* ── Ingredient (simplified — single row for MVP) ─────────── */}
      <section className="card p-6 space-y-5">
        <h2 className="font-serif text-xl font-semibold text-stone-800">
          Ingredients <span className="text-stone-400 text-sm font-sans font-normal">(at least one)</span>
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1">
            <label htmlFor="ingredientName" className="label">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="ingredientName"
              name="ingredientName"
              type="text"
              required
              placeholder="e.g. Pasta"
              className="input"
            />
          </div>
          <div>
            <label htmlFor="ingredientQty" className="label">
              Quantity <span className="text-red-500">*</span>
            </label>
            <input
              id="ingredientQty"
              name="ingredientQty"
              type="number"
              required
              min={0.01}
              step={0.01}
              placeholder="200"
              className="input"
            />
          </div>
          <div>
            <label htmlFor="ingredientUnit" className="label">
              Unit <span className="text-red-500">*</span>
            </label>
            <input
              id="ingredientUnit"
              name="ingredientUnit"
              type="text"
              required
              placeholder="g"
              className="input"
            />
          </div>
        </div>
      </section>

      {/* ── Step 1 (simplified — single step for MVP) ─────────────── */}
      <section className="card p-6 space-y-5">
        <h2 className="font-serif text-xl font-semibold text-stone-800">
          Instructions <span className="text-stone-400 text-sm font-sans font-normal">(at least one step)</span>
        </h2>
        <div>
          <label htmlFor="step1" className="label">
            Step 1 <span className="text-red-500">*</span>
          </label>
          <textarea
            id="step1"
            name="step1"
            rows={4}
            required
            minLength={5}
            placeholder="Describe the first step of your recipe…"
            className="input resize-none"
          />
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? 'Saving…' : 'Save Recipe'}
        </button>
      </div>
    </form>
  );
}
