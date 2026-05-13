/**
 * src/app/page.tsx
 *
 * Public home page — hero section + recipe discovery grid.
 */

import Link from 'next/link';

import { RecipeGrid } from '@/interfaces/components/recipes/RecipeGrid';

export default function HomePage() {
  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-brand-500 to-brand-700 text-white">
        <div className="mx-auto max-w-5xl px-4 py-24 text-center">
          <h1 className="font-serif text-5xl font-bold tracking-tight sm:text-6xl">
            Your Personal Recipe Vault
          </h1>
          <p className="mt-6 text-xl text-brand-100 max-w-2xl mx-auto">
            Save, organise, and share the recipes you love — from quick weeknight dinners to
            elaborate weekend projects.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/recipes/new"
              className="rounded-xl bg-white text-brand-700 font-semibold px-8 py-3 text-lg
                         hover:bg-brand-50 transition-colors shadow-lg"
            >
              Add a Recipe
            </Link>
            <Link
              href="/recipes"
              className="rounded-xl border-2 border-white text-white font-semibold px-8 py-3
                         text-lg hover:bg-white/10 transition-colors"
            >
              Browse Recipes
            </Link>
          </div>
        </div>
      </section>

      {/* ── Featured recipes ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-3xl font-serif font-semibold text-stone-800 mb-8">
          Recently Added
        </h2>
        <RecipeGrid />
      </section>
    </main>
  );
}
