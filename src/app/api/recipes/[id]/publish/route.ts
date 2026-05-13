/**
 * src/app/api/recipes/[id]/publish/route.ts
 *
 * POST /api/recipes/:id/publish → publish a recipe
 */

import type { NextRequest } from 'next/server';

import { RecipeController } from '@/interfaces/http/controllers/RecipeController';

export async function POST(
  req: NextRequest,
  context: { params: { id: string } },
) {
  return RecipeController.publish(req, context);
}
