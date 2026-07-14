/**
 * src/app/api/recipes/[slug]/comments/route.ts
 *
 * Next.js App Router route handlers for /api/recipes/:slug/comments.
 *
 *   POST /api/recipes/:slug/comments → create a comment (auth required, 201)
 *   GET  /api/recipes/:slug/comments → list comments (public, 200)
 *
 * All logic is delegated to CommentController.
 */

import type { NextRequest } from 'next/server';

import { commentController } from '@/interfaces/http/controllers/CommentController';

export async function POST(
  req: NextRequest,
  context: { params: { slug: string } },
) {
  return commentController.create(req, context);
}

export async function GET(
  req: NextRequest,
  context: { params: { slug: string } },
) {
  return commentController.list(req, context);
}
