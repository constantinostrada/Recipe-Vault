/**
 * src/interfaces/http/controllers/FavoriteController.ts
 *
 * Thin controller for the favorite-recipe HTTP endpoints.
 *
 *   POST   /api/recipes/:id/favorite  → 201, mark recipe as favorited
 *   DELETE /api/recipes/:id/favorite  → 204, remove from favorites
 *   GET    /api/me/favorites          → 200, current user's favorited recipes
 *
 * All three endpoints require an authenticated session (requireAuth throws
 * UnauthorizedError otherwise, which the errorResponse helper maps to 403).
 *
 * Imports: application (via container), interfaces helpers. Does NOT import
 * infrastructure directly.
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';

import type { AddFavoriteUseCase } from '@/application/use-cases/favorite/AddFavoriteUseCase';
import type { RemoveFavoriteUseCase } from '@/application/use-cases/favorite/RemoveFavoriteUseCase';
import type { ListUserFavoritesUseCase } from '@/application/use-cases/favorite/ListUserFavoritesUseCase';
import { container } from '@/infrastructure/container';

import {
  createdResponse,
  errorResponse,
  noContentResponse,
  successResponse,
} from '../helpers/apiResponse';
import { requireAuth } from '../helpers/authGuard';

const recipeIdParamSchema = z
  .string({
    required_error: 'recipe id is required',
    invalid_type_error: 'recipe id must be a string',
  })
  .trim()
  .min(1, { message: 'recipe id must be a non-empty string' });

export class FavoriteController {
  constructor(
    private readonly addFavoriteUseCase: AddFavoriteUseCase,
    private readonly removeFavoriteUseCase: RemoveFavoriteUseCase,
    private readonly listUserFavoritesUseCase: ListUserFavoritesUseCase,
  ) {}

  /**
   * POST /api/recipes/:id/favorite
   * Returns 201 with `{ favorited: true, recipeId }`.
   */
  add = async (
    _req: NextRequest,
    { params }: { params: { id: string } },
  ) => {
    try {
      const user = await requireAuth();
      const recipeId = recipeIdParamSchema.parse(params?.id);
      await this.addFavoriteUseCase.execute({ userId: user.id, recipeId });
      return createdResponse({ favorited: true, recipeId });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return validationErrorResponse(err);
      }
      return errorResponse(err);
    }
  };

  /**
   * DELETE /api/recipes/:id/favorite
   * Returns 204 (idempotent — removing a non-existing favorite is a no-op).
   */
  remove = async (
    _req: NextRequest,
    { params }: { params: { id: string } },
  ) => {
    try {
      const user = await requireAuth();
      const recipeId = recipeIdParamSchema.parse(params?.id);
      await this.removeFavoriteUseCase.execute({ userId: user.id, recipeId });
      return noContentResponse();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return validationErrorResponse(err);
      }
      return errorResponse(err);
    }
  };

  /**
   * GET /api/me/favorites
   * Returns the current user's favorited recipes with full recipe payload.
   */
  list = async (_req: NextRequest) => {
    try {
      const user = await requireAuth();
      const result = await this.listUserFavoritesUseCase.execute({ userId: user.id });
      return successResponse(result.data);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

function validationErrorResponse(err: z.ZodError) {
  const message = err.errors
    .map((e) => {
      const path = e.path.join('.');
      return path ? `${path}: ${e.message}` : e.message;
    })
    .join('; ');
  return errorResponse(
    Object.assign(new Error(message), { name: 'ValidationError' }),
  );
}

/** Application-wide singleton wired from the DI container. */
export const favoriteController = new FavoriteController(
  container.addFavoriteUseCase,
  container.removeFavoriteUseCase,
  container.listUserFavoritesUseCase,
);
