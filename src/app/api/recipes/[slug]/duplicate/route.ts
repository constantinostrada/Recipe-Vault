/**
 * src/app/api/recipes/[slug]/duplicate/route.ts
 *
 * Next.js App Router route handler for /api/recipes/:id/duplicate.
 *
 *   POST /api/recipes/:id/duplicate → create a copy of the recipe
 *
 * Next.js requires that sibling dynamic segments under `recipes/` share a
 * single param name, hence the `[slug]` folder. The handler treats the
 * incoming value as a recipe id and delegates to RecipeController.
 */

import type { NextRequest } from 'next/server';

import { recipeController } from '@/interfaces/http/controllers/RecipeController';

export async function POST(
  req: NextRequest,
  context: { params: { slug: string } },
) {
  return recipeController.duplicate(req, context);
}
