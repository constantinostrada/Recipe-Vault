/**
 * src/application/use-cases/rating/RateRecipeUseCase.ts
 *
 * Use Case: Submit (or update) the rating an authenticated user gives a
 * recipe. The (userId, recipeId) pair is unique — calling this again with
 * a different `stars` value overwrites the previous rating.
 *
 * Imports: domain + application only (no infrastructure).
 */

import { DomainError, RecipeNotFoundError } from '@/domain/errors/DomainError';
import type { IRatingRepository } from '@/domain/repositories/IRatingRepository';
import type { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';

import type { RateRecipeInput } from '../../dtos/RatingDto';

const MIN_STARS = 1;
const MAX_STARS = 5;

export class RateRecipeUseCase {
  constructor(
    private readonly recipeRepository: IRecipeRepository,
    private readonly ratingRepository: IRatingRepository,
  ) {}

  async execute(input: RateRecipeInput): Promise<void> {
    if (typeof input?.slug !== 'string' || input.slug.trim().length === 0) {
      throw new DomainError('slug must be a non-empty string.');
    }
    if (typeof input?.userId !== 'string' || input.userId.trim().length === 0) {
      throw new DomainError('userId must be a non-empty string.');
    }
    if (
      typeof input?.stars !== 'number' ||
      !Number.isInteger(input.stars) ||
      input.stars < MIN_STARS ||
      input.stars > MAX_STARS
    ) {
      throw new DomainError(
        `stars must be an integer between ${MIN_STARS} and ${MAX_STARS}.`,
      );
    }

    const recipe = await this.recipeRepository.findBySlug(input.slug);
    if (!recipe) {
      throw new RecipeNotFoundError(input.slug);
    }

    await this.ratingRepository.upsert(input.userId, recipe.id, input.stars);
  }
}
