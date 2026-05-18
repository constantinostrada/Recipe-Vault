/**
 * src/interfaces/http/controllers/RatingController.ts
 *
 * Thin HTTP controller for recipe ratings.
 *
 *   POST   /api/recipes/:slug/rating  → 201, upsert {stars} for the user
 *   DELETE /api/recipes/:slug/rating  → 204, remove the user's rating
 *   GET    /api/recipes/:slug/rating  → 200, public { average, count }
 *
 * Responsibilities:
 *   1. Validate path params and body with Zod.
 *   2. Require auth on rate / remove via requireAuth().
 *   3. Delegate to the rating use cases.
 *   4. Map errors to HTTP status codes via apiResponse helpers.
 *
 * No business logic. No infrastructure imports.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { GetRecipeRatingStatsUseCase } from '@/application/use-cases/rating/GetRecipeRatingStatsUseCase';
import type { RateRecipeUseCase } from '@/application/use-cases/rating/RateRecipeUseCase';
import type { RemoveRatingUseCase } from '@/application/use-cases/rating/RemoveRatingUseCase';
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

const rateBodySchema = z.object({
  stars: z
    .number({ required_error: 'stars is required', invalid_type_error: 'stars must be a number' })
    .int({ message: 'stars must be an integer' })
    .min(1, { message: 'stars must be between 1 and 5' })
    .max(5, { message: 'stars must be between 1 and 5' }),
});

// ── Controller ──────────────────────────────────────────────────────────────

export class RatingController {
  constructor(
    private readonly rateRecipeUseCase: RateRecipeUseCase,
    private readonly removeRatingUseCase: RemoveRatingUseCase,
    private readonly getRecipeRatingStatsUseCase: GetRecipeRatingStatsUseCase,
  ) {}

  /** POST /api/recipes/:slug/rating */
  rate = async (
    req: NextRequest,
    { params }: { params: { slug: string } },
  ): Promise<NextResponse> => {
    try {
      const slug = slugParamSchema.parse(params?.slug);
      const user = await requireAuth();
      const body = await safeJson(req);
      const { stars } = rateBodySchema.parse(body);

      await this.rateRecipeUseCase.execute({
        slug,
        userId: user.id,
        stars,
      });

      return createdResponse({ rated: true, slug, stars });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return validationErrorResponse(err);
      }
      return errorResponse(err);
    }
  };

  /** DELETE /api/recipes/:slug/rating */
  remove = async (
    _req: NextRequest,
    { params }: { params: { slug: string } },
  ): Promise<NextResponse> => {
    try {
      const slug = slugParamSchema.parse(params?.slug);
      const user = await requireAuth();

      await this.removeRatingUseCase.execute({
        slug,
        userId: user.id,
      });

      return noContentResponse();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return validationErrorResponse(err);
      }
      return errorResponse(err);
    }
  };

  /** GET /api/recipes/:slug/rating — public */
  getStats = async (
    _req: NextRequest,
    { params }: { params: { slug: string } },
  ): Promise<NextResponse> => {
    try {
      const slug = slugParamSchema.parse(params?.slug);
      const stats = await this.getRecipeRatingStatsUseCase.execute({ slug });
      return successResponse(stats);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return validationErrorResponse(err);
      }
      return errorResponse(err);
    }
  };
}

async function safeJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function validationErrorResponse(err: z.ZodError): NextResponse {
  const message = err.errors
    .map((e) => {
      const path = e.path.join('.');
      return path ? `${path}: ${e.message}` : e.message;
    })
    .join('; ');
  return NextResponse.json(
    { success: false, error: { message, code: 'VALIDATION_ERROR' } },
    { status: 400 },
  );
}

/** Application-wide singleton wired from the DI container. */
export const ratingController = new RatingController(
  container.rateRecipeUseCase,
  container.removeRatingUseCase,
  container.getRecipeRatingStatsUseCase,
);
