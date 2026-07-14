/**
 * src/application/use-cases/favorite/AddFavoriteUseCase.ts
 *
 * Use Case: Mark a recipe as favorited by the authenticated user.
 *
 * Verifies the recipe exists first (throws RecipeNotFoundError otherwise) so
 * the favorite table cannot be polluted with dangling references. The add
 * itself is idempotent at the repository layer — calling twice does not throw.
 *
 * Imports: domain + application only (no infrastructure).
 */

import { DomainError, RecipeNotFoundError } from '@/domain/errors/DomainError';
import type { IFavoriteRecipeRepository } from '@/domain/repositories/IFavoriteRecipeRepository';
import type { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';

import type { FavoriteRecipeInput } from '../../dtos/FavoriteDto';

export class AddFavoriteUseCase {
  constructor(
    private readonly favoriteRepository: IFavoriteRecipeRepository,
    private readonly recipeRepository: IRecipeRepository,
  ) {}

  async execute(input: FavoriteRecipeInput): Promise<void> {
    assertNonEmptyString(input?.userId, 'userId');
    assertNonEmptyString(input?.recipeId, 'recipeId');

    const recipeExists = await this.recipeRepository.exists(input.recipeId);
    if (!recipeExists) {
      throw new RecipeNotFoundError(input.recipeId);
    }

    await this.favoriteRepository.add(input.userId, input.recipeId);
  }
}

function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DomainError(`${field} must be a non-empty string.`);
  }
}
