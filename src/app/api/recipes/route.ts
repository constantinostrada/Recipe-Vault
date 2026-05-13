/**
 * src/app/api/recipes/route.ts
 *
 * Next.js App Router route handler for /api/recipes.
 *
 *   GET /api/recipes  → list / search recipes (filters via query params)
 *
 * Mutation endpoints (POST/PATCH/DELETE/publish) were removed when the
 * Recipe aggregate was rewritten; they will be reintroduced by the
 * dedicated realign task. All logic is delegated to RecipeController.
 */

import type { NextRequest } from 'next/server';

import { recipeController } from '@/interfaces/http/controllers/RecipeController';

export async function GET(req: NextRequest) {
  return recipeController.list(req);
}
