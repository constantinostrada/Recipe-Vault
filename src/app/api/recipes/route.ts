/**
 * src/app/api/recipes/route.ts
 *
 * Next.js App Router route handler for /api/recipes.
 *
 *   GET  /api/recipes → list / search recipes (filters via query params)
 *   POST /api/recipes → create a new recipe (body: name, cookTimeMinutes,
 *                        difficulty, tags?, ...)
 *
 * All logic is delegated to RecipeController.
 */

import type { NextRequest } from 'next/server';

import { recipeController } from '@/interfaces/http/controllers/RecipeController';

export async function GET(req: NextRequest) {
  return recipeController.list(req);
}

export async function POST(req: NextRequest) {
  return recipeController.create(req);
}
