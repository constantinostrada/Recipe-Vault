/**
 * src/application/use-cases/rating/GetRecipeRatingStatsUseCase.ts
 *
 * Use Case: Return the aggregate rating stats for a recipe — average +
 * count. Public endpoint, no auth needed. When the recipe has no ratings
 * the result is { average: 0, count: 0 }.
 *
 * Imports: domain + application only (no infrastructure).
 */

import { DomainError, RecipeNotFoundError } from '@/domain/errors/DomainError';
import type { IRatingRepository } from '@/domain/repositories/IRatingRepository';
import type { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';

import type {
  GetRecipeRatingStatsInput,
  RecipeRatingStatsDto,
} from '../../dtos/RatingDto';

export class GetRecipeRatingStatsUseCase {
  constructor(
    private readonly recipeRepository: IRecipeRepository,
    private readonly ratingRepository: IRatingRepository,
  ) {}

  async execute(
    input: GetRecipeRatingStatsInput,
  ): Promise<RecipeRatingStatsDto> {
    if (typeof input?.slug !== 'string' || input.slug.trim().length === 0) {
      throw new DomainError('slug must be a non-empty string.');
    }

    const recipe = await this.recipeRepository.findBySlug(input.slug);
    if (!recipe) {
      throw new RecipeNotFoundError(input.slug);
    }

    const stats = await this.ratingRepository.getStats(recipe.id);
    return { average: stats.average, count: stats.count };
  }
}
