/**
 * src/app/api/recipes/[slug]/rate/route.ts
 *
 * Next.js App Router route handler for /api/recipes/:slug/rate.
 *
 *   POST /api/recipes/:slug/rate  body: { rating: 1..5 }
 *     → 201 with the persisted RatingDto on success
 *     → 400 when the body / rating is invalid
 *     → 404 when the slug doesn't resolve to a recipe
 *
 * All logic is delegated to RecipeController.
 */

import type { NextRequest } from 'next/server';

import { recipeController } from '@/interfaces/http/controllers/RecipeController';

export async function POST(
  req: NextRequest,
  context: { params: { slug: string } },
) {
  return recipeController.rate(req, context);
}
