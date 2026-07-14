/**
 * src/app/api/recipes/[slug]/favorite/route.ts
 *
 * Next.js App Router route handler for /api/recipes/:id/favorite.
 *
 *   POST   → mark the recipe as favorited (201)
 *   DELETE → remove from favorites      (204)
 *
 * Both require an authenticated session.
 *
 * NOTE on the folder name: the sibling /api/recipes/[slug]/route.ts already
 * exists for the slug-based detail endpoint, and Next.js requires identical
 * dynamic segment names at the same path level. We therefore keep the folder
 * named [slug] but treat the value here as a recipe id (per the AC, which
 * specifies /api/recipes/:id/favorite). The URL the client hits is identical
 * either way.
 */

import type { NextRequest } from 'next/server';

import { favoriteController } from '@/interfaces/http/controllers/FavoriteController';

export async function POST(
  req: NextRequest,
  ctx: { params: { slug: string } },
) {
  return favoriteController.add(req, { params: { id: ctx.params.slug } });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: { slug: string } },
) {
  return favoriteController.remove(req, { params: { id: ctx.params.slug } });
}
