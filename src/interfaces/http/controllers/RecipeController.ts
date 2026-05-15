/**
 * src/interfaces/http/controllers/RecipeController.ts
 *
 * Thin HTTP controller for the Recipe read API.
 *
 *   GET /api/recipes           → list recipes (filters via query params)
 *   GET /api/recipes/:slug     → recipe detail (ingredients + steps)
 *
 * Responsibilities:
 *   1. Validate / parse incoming query + path params with Zod.
 *   2. Map params to the use-case input (SearchRecipesQuery / { slug }).
 *   3. Serialise the use-case output to a JSON HTTP response.
 *
 * No business logic. All rules live in domain/application. The legacy
 * mutation endpoints (POST/PATCH/DELETE/publish) referenced use cases
 * that were rewritten away in earlier tasks; they have been removed
 * from this controller and from their route handlers. Realigning those
 * use cases is the responsibility of a separate task.
 *
 * Imports: application (DTOs, use cases via container), interfaces helpers.
 * Does NOT import infrastructure directly.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { SearchRecipesUseCase } from '@/application/use-cases/recipe/SearchRecipesUseCase';
import type { GetRecipeBySlugUseCase } from '@/application/use-cases/recipe/GetRecipeBySlugUseCase';
import type { DuplicateRecipeUseCase } from '@/application/use-cases/recipe/DuplicateRecipeUseCase';
import type { SearchRecipesQuery } from '@/application/dtos/SearchRecipesDto';
import { container } from '@/infrastructure/container';

import { createdResponse, errorResponse, successResponse } from '../helpers/apiResponse';

// ── Validation schema ───────────────────────────────────────────────────────

const DIFFICULTY_VALUES = ['easy', 'medium', 'hard'] as const;

const optionalString = z
  .string()
  .trim()
  .min(1)
  .optional();

const positiveInt = z.coerce
  .number({ invalid_type_error: 'must be a number' })
  .int({ message: 'must be an integer' })
  .positive({ message: 'must be a positive number' });

const searchQuerySchema = z.object({
  q: optionalString,
  difficulty: z
    .array(z.enum(DIFFICULTY_VALUES, { invalid_type_error: 'invalid difficulty' }))
    .optional(),
  maxCookTime: positiveInt.optional(),
  tags: z.array(z.string().trim().min(1, 'tags entries must be non-empty')).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(50).optional(),
});

const slugParamSchema = z
  .string({ required_error: 'slug is required', invalid_type_error: 'slug must be a string' })
  .trim()
  .min(1, { message: 'slug must be a non-empty string' });

const recipeIdParamSchema = z
  .string({ required_error: 'id is required', invalid_type_error: 'id must be a string' })
  .trim()
  .min(1, { message: 'id must be a non-empty string' });

// ── Controller ──────────────────────────────────────────────────────────────

export class RecipeController {
  constructor(
    private readonly searchRecipesUseCase: SearchRecipesUseCase,
    private readonly getRecipeBySlugUseCase: GetRecipeBySlugUseCase,
    private readonly duplicateRecipeUseCase: DuplicateRecipeUseCase,
  ) {}

  /**
   * GET /api/recipes
   * Returns a flat array of RecipeSummaryDTOs (no paginated wrapper).
   * Query params (all optional):
   *   q             free-text search over name/description
   *   difficulty    repeatable: ?difficulty=easy&difficulty=hard
   *   maxCookTime   positive integer
   *   tags          repeatable: ?tags=vegan&tags=fast
   *   page          1-indexed, default 1
   *   pageSize      default 12, max 50
   */
  list = async (req: NextRequest): Promise<NextResponse> => {
    try {
      const params = req.nextUrl.searchParams;
      const raw = {
        q: params.get('q') ?? undefined,
        difficulty: params.getAll('difficulty'),
        maxCookTime: params.get('maxCookTime') ?? undefined,
        tags: params.getAll('tags'),
        page: params.get('page') ?? undefined,
        pageSize: params.get('pageSize') ?? undefined,
      };
      // Strip empty arrays so optional() applies and zod doesn't choke on []
      const normalised = {
        ...raw,
        difficulty: raw.difficulty.length > 0 ? raw.difficulty : undefined,
        tags: raw.tags.length > 0 ? raw.tags : undefined,
      };

      const parsed = searchQuerySchema.parse(normalised);

      const query: SearchRecipesQuery = {};
      if (parsed.q !== undefined) query.query = parsed.q;
      if (parsed.difficulty !== undefined) query.difficulty = parsed.difficulty;
      if (parsed.maxCookTime !== undefined) query.maxCookTime = parsed.maxCookTime;
      if (parsed.tags !== undefined) query.tags = parsed.tags;
      if (parsed.page !== undefined) query.page = parsed.page;
      if (parsed.pageSize !== undefined) query.pageSize = parsed.pageSize;

      const result = await this.searchRecipesUseCase.execute(query);
      // AC-4: response is a flat array of RecipeSummaryDTO (no internal aggregate fields).
      return successResponse(result.data);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return validationErrorResponse(err);
      }
      return errorResponse(err);
    }
  };

  /**
   * GET /api/recipes/:slug
   * Returns the full recipe detail including ingredients and steps.
   */
  getBySlug = async (
    _req: NextRequest,
    { params }: { params: { slug: string } },
  ): Promise<NextResponse> => {
    try {
      const slug = slugParamSchema.parse(params?.slug);
      const result = await this.getRecipeBySlugUseCase.execute({ slug });
      return successResponse(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return validationErrorResponse(err);
      }
      return errorResponse(err);
    }
  };

  /**
   * POST /api/recipes/:id/duplicate
   * Creates a duplicate of the recipe identified by `:id`. The new recipe
   * has its own unique id, a derived unique slug, identical ingredients and
   * steps (with fresh child ids), and a title suffixed with " (copy)".
   * Returns 201 with the new recipe detail in the response body.
   *
   * The path param is named `slug` only because Next.js requires a single
   * dynamic-segment name under `recipes/`; the value is treated as a recipe id.
   */
  duplicate = async (
    _req: NextRequest,
    { params }: { params: { slug: string } },
  ): Promise<NextResponse> => {
    try {
      const recipeId = recipeIdParamSchema.parse(params?.slug);
      const result = await this.duplicateRecipeUseCase.execute({ recipeId });
      return createdResponse(result);
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
export const recipeController = new RecipeController(
  container.searchRecipesUseCase,
  container.getRecipeBySlugUseCase,
  container.duplicateRecipeUseCase,
);
