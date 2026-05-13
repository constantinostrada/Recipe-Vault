/**
 * src/app/api/recipes/route.ts
 *
 * Next.js App Router route handler for /api/recipes
 *
 * GET  /api/recipes  → list recipes
 * POST /api/recipes  → create a recipe
 *
 * All logic is delegated to RecipeController.
 */

import type { NextRequest } from 'next/server';

import { RecipeController } from '@/interfaces/http/controllers/RecipeController';

export async function GET(req: NextRequest) {
  return RecipeController.list(req);
}

export async function POST(req: NextRequest) {
  return RecipeController.create(req);
}
