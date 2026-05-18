/**
 * src/app/api/me/favorites/route.ts
 *
 * GET /api/me/favorites → returns the authenticated user's favorited
 * recipes, each with its full recipe payload (ingredients + steps).
 */

import type { NextRequest } from 'next/server';

import { favoriteController } from '@/interfaces/http/controllers/FavoriteController';

export async function GET(req: NextRequest) {
  return favoriteController.list(req);
}
