/**
 * src/interfaces/http/controllers/RecipeController.ts
 *
 * Thin HTTP controller for the Recipe API.
 *
 *   GET    /api/recipes           → list / filter recipes
 *   POST   /api/recipes           → create a new recipe (with tags)
 *   GET    /api/recipes/:slug     → recipe detail (ingredients + steps)
 *   PUT    /api/recipes/:slug     → update an existing recipe (with tags)
 *
 * Responsibilities:
 *   1. Validate / parse incoming params (query, path, body) with Zod.
 *   2. Map params to the use-case input.
 *   3. Serialise the use-case output to a JSON HTTP response.
 *
 * No business logic. All rules live in domain/application.
 *
 * Imports: application (DTOs, use cases via container), interfaces helpers.
 * Does NOT import infrastructure directly.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { SearchRecipesUseCase } from '@/application/use-cases/recipe/SearchRecipesUseCase';
import type { GetRecipeBySlugUseCase } from '@/application/use-cases/recipe/GetRecipeBySlugUseCase';
import type { AddRecipeUseCase } from '@/application/use-cases/recipe/AddRecipeUseCase';
import type { EditRecipeUseCase } from '@/application/use-cases/recipe/EditRecipeUseCase';
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

const tagsArraySchema = z
  .array(z.string().trim().min(1, 'tag entries must be non-empty'))
  .optional();

const ingredientInputSchema = z.object({
  name: z.string().trim().min(1, 'ingredient name must be non-empty'),
  quantity: z.number().positive('ingredient quantity must be > 0'),
  unit: z.string().trim().min(1, 'ingredient unit must be non-empty'),
});

const stepInputSchema = z.object({
  instruction: z.string().trim().min(1, 'step instruction must be non-empty'),
});

const createRecipeBodySchema = z.object({
  slug: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1, 'name must be non-empty'),
  description: z.string().nullable().optional(),
  cookTimeMinutes: z.number().int().positive('cookTimeMinutes must be a positive integer'),
  difficulty: z.enum(DIFFICULTY_VALUES, { invalid_type_error: 'invalid difficulty' }),
  tags: tagsArraySchema,
  imageUrl: z.string().nullable().optional(),
  ingredients: z.array(ingredientInputSchema).optional(),
  steps: z.array(stepInputSchema).optional(),
});

const updateRecipeBodySchema = z.object({
  name: z.string().trim().min(1, 'name must be non-empty').optional(),
  description: z.string().nullable().optional(),
  cookTimeMinutes: z.number().int().positive('cookTimeMinutes must be a positive integer').optional(),
  difficulty: z.enum(DIFFICULTY_VALUES, { invalid_type_error: 'invalid difficulty' }).optional(),
  tags: tagsArraySchema,
  imageUrl: z.string().nullable().optional(),
});

// ── Controller ──────────────────────────────────────────────────────────────

export class RecipeController {
  constructor(
    private readonly searchRecipesUseCase: SearchRecipesUseCase,
    private readonly getRecipeBySlugUseCase: GetRecipeBySlugUseCase,
    private readonly addRecipeUseCase?: AddRecipeUseCase,
    private readonly editRecipeUseCase?: EditRecipeUseCase,
  ) {}

  /**
   * GET /api/recipes
   * Returns a flat array of RecipeSummaryDTOs (no paginated wrapper).
   * Query params (all optional):
   *   q             free-text search over name/description
   *   difficulty    repeatable: ?difficulty=easy&difficulty=hard
   *   maxCookTime   positive integer
   *   tags          repeatable: ?tags=vegan&tags=fast
   *   tag           singular alias of `tags`: ?tag=vegetarian
   *                 (merged into the tags array; AND semantics)
   *   page          1-indexed, default 1
   *   pageSize      default 12, max 50
   */
  list = async (req: NextRequest): Promise<NextResponse> => {
    try {
      const params = req.nextUrl.searchParams;
      // `?tags=` (repeatable) and `?tag=` (also repeatable) are both
      // accepted and merged. Singular form is the documented API for
      // the simple "filter by one tag" case.
      const tagsFromArrayParam = params.getAll('tags');
      const tagsFromSingularParam = params.getAll('tag');
      const allTags = [...tagsFromArrayParam, ...tagsFromSingularParam].filter(
        (t) => t.trim().length > 0,
      );

      const raw = {
        q: params.get('q') ?? undefined,
        difficulty: params.getAll('difficulty'),
        maxCookTime: params.get('maxCookTime') ?? undefined,
        tags: allTags,
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
   * POST /api/recipes
   * Creates a new recipe. Body shape:
   *   { name, cookTimeMinutes, difficulty, tags?, description?,
   *     imageUrl?, ingredients?, steps?, slug? }
   * Returns 201 + { success, data: RecipeDetailDto } on success.
   */
  create = async (req: NextRequest): Promise<NextResponse> => {
    try {
      if (!this.addRecipeUseCase) {
        throw new Error('AddRecipeUseCase not configured on this controller.');
      }
      const body = await req.json();
      const parsed = createRecipeBodySchema.parse(body);
      const result = await this.addRecipeUseCase.execute({
        slug: parsed.slug,
        name: parsed.name,
        description: parsed.description ?? null,
        cookTimeMinutes: parsed.cookTimeMinutes,
        difficulty: parsed.difficulty,
        tags: parsed.tags,
        imageUrl: parsed.imageUrl ?? null,
        ingredients: parsed.ingredients,
        steps: parsed.steps,
      });
      return createdResponse(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return validationErrorResponse(err);
      }
      return errorResponse(err);
    }
  };

  /**
   * PUT /api/recipes/:slug
   * Updates an existing recipe identified by its slug. Body shape:
   *   { name?, cookTimeMinutes?, difficulty?, tags?, description?, imageUrl? }
   * Returns 200 + { success, data: RecipeDetailDto } on success,
   * 404 if the slug is unknown.
   */
  update = async (
    req: NextRequest,
    { params }: { params: { slug: string } },
  ): Promise<NextResponse> => {
    try {
      if (!this.editRecipeUseCase) {
        throw new Error('EditRecipeUseCase not configured on this controller.');
      }
      const slug = slugParamSchema.parse(params?.slug);
      const body = await req.json();
      const parsed = updateRecipeBodySchema.parse(body);
      const result = await this.editRecipeUseCase.execute({
        slug,
        name: parsed.name,
        description: parsed.description,
        cookTimeMinutes: parsed.cookTimeMinutes,
        difficulty: parsed.difficulty,
        tags: parsed.tags,
        imageUrl: parsed.imageUrl,
      });
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
  container.addRecipeUseCase,
  container.editRecipeUseCase,
);
