/**
 * src/application/use-cases/favorite/RemoveFavoriteUseCase.ts
 *
 * Use Case: Remove a recipe from the authenticated user's favorites.
 *
 * Idempotent — removing a favorite that does not exist is a no-op. The DELETE
 * endpoint therefore always returns 204.
 *
 * Imports: domain + application only (no infrastructure).
 */

import { DomainError } from '@/domain/errors/DomainError';
import type { IFavoriteRecipeRepository } from '@/domain/repositories/IFavoriteRecipeRepository';

import type { FavoriteRecipeInput } from '../../dtos/FavoriteDto';

export class RemoveFavoriteUseCase {
  constructor(private readonly favoriteRepository: IFavoriteRecipeRepository) {}

  async execute(input: FavoriteRecipeInput): Promise<void> {
    assertNonEmptyString(input?.userId, 'userId');
    assertNonEmptyString(input?.recipeId, 'recipeId');

    await this.favoriteRepository.remove(input.userId, input.recipeId);
  }
}

function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DomainError(`${field} must be a non-empty string.`);
  }
}
