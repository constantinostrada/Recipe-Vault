/**
 * src/app/api/comments/[id]/route.ts
 *
 * Next.js App Router route handler for /api/comments/:id.
 *
 *   DELETE /api/comments/:id → delete a comment (auth required, 204)
 *
 * Only the comment author may delete; non-authors get 403 (mapped from
 * the UnauthorizedError thrown inside DeleteCommentUseCase).
 *
 * All logic is delegated to CommentController.
 */

import type { NextRequest } from 'next/server';

import { commentController } from '@/interfaces/http/controllers/CommentController';

export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } },
) {
  return commentController.delete(req, context);
}
