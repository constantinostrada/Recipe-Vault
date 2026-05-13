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
import type {
  CreateRecipeInput,
  CreateRecipeUseCase,
} from '@/application/use-cases/recipe/CreateRecipeUseCase';
import type { SearchRecipesQuery } from '@/application/dtos/SearchRecipesDto';
import { container } from '@/infrastructure/container';

import { createdResponse, errorResponse, successResponse } from '../helpers/apiResponse';
import { requireAuth } from '../helpers/authGuard';

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

const createIngredientSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  quantity: z.number().positive('quantity must be a positive number'),
  unit: z.string().trim().min(1, 'unit is required'),
});

const createStepSchema = z.object({
  instruction: z.string().trim().min(1, 'instruction is required'),
});

const createRecipeBodySchema = z.object({
  name: z.string({ required_error: 'name is required' }).trim().min(1, 'name is required'),
  description: z.string().trim().min(1).nullable().optional(),
  cookTimeMinutes: z
    .number({ required_error: 'cookTimeMinutes is required', invalid_type_error: 'cookTimeMinutes must be a number' })
    .int('cookTimeMinutes must be an integer')
    .positive('cookTimeMinutes must be a positive number'),
  difficulty: z.enum(DIFFICULTY_VALUES, {
    required_error: 'difficulty is required',
    invalid_type_error: 'invalid difficulty',
  }),
  tags: z.array(z.string().trim().min(1, 'tag entries must be non-empty')).optional(),
  imageUrl: z.string().url('imageUrl must be a valid URL').nullable().optional(),
  ingredients: z
    .array(createIngredientSchema, { required_error: 'ingredients is required' })
    .min(1, 'ingredients must contain at least one item'),
  steps: z
    .array(createStepSchema, { required_error: 'steps is required' })
    .min(1, 'steps must contain at least one item'),
});

// ── Controller ──────────────────────────────────────────────────────────────

export class RecipeController {
  constructor(
    private readonly searchRecipesUseCase: SearchRecipesUseCase,
    private readonly getRecipeBySlugUseCase: GetRecipeBySlugUseCase,
    private readonly createRecipeUseCase: CreateRecipeUseCase,
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
   * POST /api/recipes
   * Creates a new recipe. Requires an authenticated session.
   * Body: { name, description?, cookTimeMinutes, difficulty, tags?, imageUrl?,
   *         ingredients:[{name,quantity,unit}], steps:[{instruction}] }
   * Returns 201 with the created RecipeDetailDto.
   */
  createRecipe = async (req: NextRequest): Promise<NextResponse> => {
    try {
      await requireAuth();

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json(
          {
            success: false,
            error: { message: 'request body must be valid JSON', code: 'VALIDATION_ERROR' },
          },
          { status: 400 },
        );
      }

      const parsed = createRecipeBodySchema.parse(body);

      const input: CreateRecipeInput = {
        name: parsed.name,
        cookTimeMinutes: parsed.cookTimeMinutes,
        difficulty: parsed.difficulty,
        ingredients: parsed.ingredients,
        steps: parsed.steps,
      };
      if (parsed.description !== undefined) input.description = parsed.description;
      if (parsed.tags !== undefined) input.tags = parsed.tags;
      if (parsed.imageUrl !== undefined) input.imageUrl = parsed.imageUrl;

      const created = await this.createRecipeUseCase.execute(input);
      return createdResponse(created);
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
  container.createRecipeUseCase,
);
