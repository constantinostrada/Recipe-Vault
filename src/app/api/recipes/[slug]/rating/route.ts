/**
 * src/app/api/recipes/[slug]/rating/route.ts
 *
 * Next.js App Router route handler for /api/recipes/:slug/rating.
 *
 *   POST   → 201, authenticated, upserts the user's rating
 *   DELETE → 204, authenticated, removes the user's rating
 *   GET    → 200, public, { average, count }
 *
 * All logic is delegated to RatingController.
 */

import type { NextRequest } from 'next/server';

import { ratingController } from '@/interfaces/http/controllers/RatingController';

export async function POST(
  req: NextRequest,
  context: { params: { slug: string } },
) {
  return ratingController.rate(req, context);
}

export async function DELETE(
  req: NextRequest,
  context: { params: { slug: string } },
) {
  return ratingController.remove(req, context);
}

export async function GET(
  req: NextRequest,
  context: { params: { slug: string } },
) {
  return ratingController.getStats(req, context);
}
