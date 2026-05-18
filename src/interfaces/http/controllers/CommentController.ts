/**
 * src/interfaces/http/controllers/CommentController.ts
 *
 * Thin HTTP controller for the Comment API.
 *
 *   POST   /api/recipes/:slug/comments   → create (auth required, 201)
 *   GET    /api/recipes/:slug/comments   → list comments (public, 200)
 *   DELETE /api/comments/:id             → delete (auth required, 204)
 *
 * Responsibilities:
 *   1. Validate path / body with Zod.
 *   2. Pull the authenticated user via requireAuth().
 *   3. Map to use-case input, serialise the response.
 *
 * No business logic. All rules live in domain/application.
 *
 * Imports: application (use cases via container), interfaces helpers.
 * Does NOT import infrastructure directly.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { AddCommentUseCase } from '@/application/use-cases/comment/AddCommentUseCase';
import type { DeleteCommentUseCase } from '@/application/use-cases/comment/DeleteCommentUseCase';
import type { ListRecipeCommentsUseCase } from '@/application/use-cases/comment/ListRecipeCommentsUseCase';
import { container } from '@/infrastructure/container';

import {
  createdResponse,
  errorResponse,
  noContentResponse,
  successResponse,
} from '../helpers/apiResponse';
import { requireAuth } from '../helpers/authGuard';

// ── Validation schemas ──────────────────────────────────────────────────────

const slugParamSchema = z
  .string({ required_error: 'slug is required', invalid_type_error: 'slug must be a string' })
  .trim()
  .min(1, { message: 'slug must be a non-empty string' });

const commentIdParamSchema = z
  .string({ required_error: 'id is required', invalid_type_error: 'id must be a string' })
  .trim()
  .min(1, { message: 'id must be a non-empty string' });

const createBodySchema = z.object({
  body: z
    .string({
      required_error: 'body is required',
      invalid_type_error: 'body must be a string',
    })
    .trim()
    .min(1, { message: 'body must be between 1 and 500 characters' })
    .max(500, { message: 'body must be between 1 and 500 characters' }),
});

// ── Controller ──────────────────────────────────────────────────────────────

export class CommentController {
  constructor(
    private readonly addCommentUseCase: AddCommentUseCase,
    private readonly deleteCommentUseCase: DeleteCommentUseCase,
    private readonly listRecipeCommentsUseCase: ListRecipeCommentsUseCase,
  ) {}

  /** POST /api/recipes/:slug/comments */
  create = async (
    req: NextRequest,
    { params }: { params: { slug: string } },
  ): Promise<NextResponse> => {
    try {
      const slug = slugParamSchema.parse(params?.slug);
      const session = await requireAuth();
      const raw = (await req.json().catch(() => ({}))) as unknown;
      const { body } = createBodySchema.parse(raw);

      const comment = await this.addCommentUseCase.execute({
        slug,
        userId: session.id,
        body,
      });
      return createdResponse(comment);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return validationErrorResponse(err);
      }
      return errorResponse(err);
    }
  };

  /** GET /api/recipes/:slug/comments — public, no auth */
  list = async (
    _req: NextRequest,
    { params }: { params: { slug: string } },
  ): Promise<NextResponse> => {
    try {
      const slug = slugParamSchema.parse(params?.slug);
      const data = await this.listRecipeCommentsUseCase.execute({ slug });
      return successResponse(data);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return validationErrorResponse(err);
      }
      return errorResponse(err);
    }
  };

  /** DELETE /api/comments/:id */
  delete = async (
    _req: NextRequest,
    { params }: { params: { id: string } },
  ): Promise<NextResponse> => {
    try {
      const commentId = commentIdParamSchema.parse(params?.id);
      const session = await requireAuth();
      await this.deleteCommentUseCase.execute({ commentId, userId: session.id });
      return noContentResponse();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return validationErrorResponse(err);
      }
      return errorResponse(err);
    }
  };
}

function validationErrorResponse(err: z.ZodError): NextResponse {
  const message = err.errors
    .map((e) => {
      const path = e.path.join('.');
      return path ? `${path}: ${e.message}` : e.message;
    })
    .join('; ');
  return NextResponse.json(
    {
      success: false,
      error: { message, code: 'VALIDATION_ERROR' },
    },
    { status: 400 },
  );
}

/** Application-wide singleton wired from the DI container. */
export const commentController = new CommentController(
  container.addCommentUseCase,
  container.deleteCommentUseCase,
  container.listRecipeCommentsUseCase,
);
