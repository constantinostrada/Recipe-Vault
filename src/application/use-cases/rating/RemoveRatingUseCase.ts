/**
 * src/application/use-cases/rating/RemoveRatingUseCase.ts
 *
 * Use Case: Remove the rating an authenticated user gave to a recipe.
 * Idempotent — calling it twice (or for a recipe the user never rated)
 * is a no-op.
 *
 * Imports: domain + application only (no infrastructure).
 */

import { DomainError, RecipeNotFoundError } from '@/domain/errors/DomainError';
import type { IRatingRepository } from '@/domain/repositories/IRatingRepository';
import type { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';

import type { RemoveRatingInput } from '../../dtos/RatingDto';

export class RemoveRatingUseCase {
  constructor(
    private readonly recipeRepository: IRecipeRepository,
    private readonly ratingRepository: IRatingRepository,
  ) {}

  async execute(input: RemoveRatingInput): Promise<void> {
    if (typeof input?.slug !== 'string' || input.slug.trim().length === 0) {
      throw new DomainError('slug must be a non-empty string.');
    }
    if (typeof input?.userId !== 'string' || input.userId.trim().length === 0) {
      throw new DomainError('userId must be a non-empty string.');
    }

    const recipe = await this.recipeRepository.findBySlug(input.slug);
    if (!recipe) {
      throw new RecipeNotFoundError(input.slug);
    }

    await this.ratingRepository.remove(input.userId, recipe.id);
  }
}
