/**
 * src/app/api/recipes/[slug]/route.ts
 *
 * Next.js App Router route handler for /api/recipes/:slug.
 *
 *   GET /api/recipes/:slug → full recipe detail (ingredients + steps)
 *
 * All logic is delegated to RecipeController.
 */

import type { NextRequest } from 'next/server';

import { recipeController } from '@/interfaces/http/controllers/RecipeController';

export async function GET(
  req: NextRequest,
  context: { params: { slug: string } },
) {
  return recipeController.getBySlug(req, context);
}
