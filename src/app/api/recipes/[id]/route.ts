/**
 * src/app/api/recipes/[id]/route.ts
 *
 * Next.js App Router route handler for /api/recipes/:id
 *
 * GET    /api/recipes/:id  → get recipe by id
 * PATCH  /api/recipes/:id  → update recipe
 * DELETE /api/recipes/:id  → delete recipe
 */

import type { NextRequest } from 'next/server';

import { RecipeController } from '@/interfaces/http/controllers/RecipeController';

export async function GET(
  req: NextRequest,
  context: { params: { id: string } },
) {
  return RecipeController.getById(req, context);
}

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } },
) {
  return RecipeController.update(req, context);
}

export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } },
) {
  return RecipeController.remove(req, context);
}
