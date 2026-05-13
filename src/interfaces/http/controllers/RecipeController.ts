/**
 * src/interfaces/http/controllers/RecipeController.ts
 *
 * Thin controller class for Recipe HTTP operations.
 *
 * Each method:
 *   1. Validates / parses incoming request data (schema validation only)
 *   2. Calls the appropriate use case via the container
 *   3. Serializes the use case output into an HTTP response
 *
 * No business logic lives here. All rules are in domain/application.
 *
 * Imports: application (DTOs, use cases via container), interfaces helpers.
 * Does NOT import infrastructure repositories directly.
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { container } from '@/infrastructure/container';

import {
  createdResponse,
  errorResponse,
  noContentResponse,
  successResponse,
} from '../helpers/apiResponse';
import { getOptionalAuth, requireAuth } from '../helpers/authGuard';

// ── Input validation schemas ────────────────────────────────────────────────

const createRecipeSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(2000).optional(),
  servings: z.number().int().min(1),
  prepTimeMin: z.number().int().min(0),
  cookTimeMin: z.number().int().min(0),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'EXPERT']),
  isPublic: z.boolean().optional().default(false),
  ingredients: z
    .array(
      z.object({
        ingredientId: z.string().min(1),
        ingredientName: z.string().min(1),
        quantity: z.number().positive(),
        unit: z.string().min(1),
        notes: z.string().optional(),
      }),
    )
    .min(1),
  steps: z
    .array(
      z.object({
        stepNumber: z.number().int().min(1),
        instruction: z.string().min(5),
        durationMin: z.number().int().min(0).optional(),
      }),
    )
    .min(1),
  tags: z.array(z.string()).optional().default([]),
});

const updateRecipeSchema = z
  .object({
    title: z.string().min(3).max(120).optional(),
    description: z.string().max(2000).nullable().optional(),
    servings: z.number().int().min(1).optional(),
    prepTimeMin: z.number().int().min(0).optional(),
    cookTimeMin: z.number().int().min(0).optional(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'EXPERT']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update.',
  });

const listRecipesSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  tags: z.string().optional(), // comma-separated
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'EXPERT']).optional(),
  search: z.string().optional(),
  authorId: z.string().optional(),
});

// ── Controller ──────────────────────────────────────────────────────────────

export class RecipeController {
  /**
   * GET /api/recipes
   * List recipes with optional filters.
   */
  static async list(req: NextRequest) {
    try {
      const { searchParams } = req.nextUrl;
      const query = listRecipesSchema.parse({
        page: searchParams.get('page') ?? undefined,
        pageSize: searchParams.get('pageSize') ?? undefined,
        tags: searchParams.get('tags') ?? undefined,
        difficulty: searchParams.get('difficulty') ?? undefined,
        search: searchParams.get('search') ?? undefined,
        authorId: searchParams.get('authorId') ?? undefined,
      });

      const currentUser = await getOptionalAuth();

      const result = await container.listRecipesUseCase.execute({
        page: query.page,
        pageSize: query.pageSize,
        tags: query.tags?.split(',').map((t) => t.trim()),
        difficulty: query.difficulty,
        searchTerm: query.search,
        authorId: query.authorId,
        requestingUserId: currentUser?.id,
      });

      return successResponse(result);
    } catch (err) {
      return errorResponse(err);
    }
  }

  /**
   * POST /api/recipes
   * Create a new recipe.  Requires authentication.
   */
  static async create(req: NextRequest) {
    try {
      const currentUser = await requireAuth();
      const body = await req.json();
      const validated = createRecipeSchema.parse(body);

      const result = await container.createRecipeUseCase.execute({
        ...validated,
        authorId: currentUser.id,
      });

      return createdResponse(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return errorResponse(
          Object.assign(new Error(err.errors.map((e) => e.message).join(', ')), {
            name: 'ValidationError',
          }),
        );
      }
      return errorResponse(err);
    }
  }

  /**
   * GET /api/recipes/:id
   * Retrieve a single recipe.
   */
  static async getById(
    _req: NextRequest,
    { params }: { params: { id: string } },
  ) {
    try {
      const currentUser = await getOptionalAuth();

      const result = await container.getRecipeUseCase.execute({
        recipeId: params.id,
        requestingUserId: currentUser?.id,
      });

      return successResponse(result);
    } catch (err) {
      return errorResponse(err);
    }
  }

  /**
   * PATCH /api/recipes/:id
   * Update recipe metadata.  Requires authentication as the author.
   */
  static async update(
    req: NextRequest,
    { params }: { params: { id: string } },
  ) {
    try {
      const currentUser = await requireAuth();
      const body = await req.json();
      const validated = updateRecipeSchema.parse(body);

      const result = await container.updateRecipeUseCase.execute({
        recipeId: params.id,
        requestingUserId: currentUser.id,
        ...validated,
      });

      return successResponse(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return errorResponse(
          Object.assign(new Error(err.errors.map((e) => e.message).join(', ')), {
            name: 'ValidationError',
          }),
        );
      }
      return errorResponse(err);
    }
  }

  /**
   * DELETE /api/recipes/:id
   * Delete a recipe.  Requires authentication as the author.
   */
  static async remove(
    _req: NextRequest,
    { params }: { params: { id: string } },
  ) {
    try {
      const currentUser = await requireAuth();

      await container.deleteRecipeUseCase.execute({
        recipeId: params.id,
        requestingUserId: currentUser.id,
      });

      return noContentResponse();
    } catch (err) {
      return errorResponse(err);
    }
  }

  /**
   * POST /api/recipes/:id/publish
   * Publish a recipe.  Requires authentication as the author.
   */
  static async publish(
    _req: NextRequest,
    { params }: { params: { id: string } },
  ) {
    try {
      const currentUser = await requireAuth();

      const result = await container.publishRecipeUseCase.execute({
        recipeId: params.id,
        requestingUserId: currentUser.id,
      });

      return successResponse(result);
    } catch (err) {
      return errorResponse(err);
    }
  }
}
