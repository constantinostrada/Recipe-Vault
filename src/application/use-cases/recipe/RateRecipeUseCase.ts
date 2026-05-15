/**
 * src/application/use-cases/recipe/RateRecipeUseCase.ts
 *
 * Use Case: Submit a 1-5 star rating for a recipe identified by slug.
 *
 *  - Validates the input shape (slug non-empty, rating integer 1..5).
 *  - Resolves the recipe by slug and 404s via RecipeNotFoundError when missing.
 *  - Creates a new Rating domain entity (which re-validates the value as a
 *    last line of defense — invariants live in the domain).
 *  - Persists the rating through IRecipeRepository.saveRating.
 *
 * Imports: domain + application only (no infrastructure).
 */

import { Rating } from '@/domain/entities/Rating';
import { DomainError, RecipeNotFoundError } from '@/domain/errors/DomainError';
import type { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';

import type { RateRecipeInput, RatingDto } from '../../dtos/RateRecipeDto';

export class RateRecipeUseCase {
  constructor(
    private readonly recipeRepository: IRecipeRepository,
    private readonly idFactory: () => string = defaultUuid,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(input: RateRecipeInput): Promise<RatingDto> {
    if (typeof input?.slug !== 'string' || input.slug.trim().length === 0) {
      throw new DomainError('slug must be a non-empty string.');
    }

    const rawRating = input.rating;
    if (rawRating === undefined || rawRating === null) {
      throw new DomainError('rating is required.');
    }
    if (typeof rawRating !== 'number' || !Number.isFinite(rawRating)) {
      throw new DomainError('rating must be a finite number.');
    }
    if (!Number.isInteger(rawRating)) {
      throw new DomainError('rating must be an integer.');
    }
    if (rawRating < 1 || rawRating > 5) {
      throw new DomainError('rating must be between 1 and 5.');
    }

    const recipe = await this.recipeRepository.findBySlug(input.slug);
    if (!recipe) {
      throw new RecipeNotFoundError(input.slug);
    }

    const rating = Rating.create({
      id: this.idFactory(),
      recipeId: recipe.id,
      value: rawRating,
      createdAt: this.clock(),
    });

    await this.recipeRepository.saveRating(rating);

    return {
      id: rating.id,
      recipeId: rating.recipeId,
      value: rating.value,
      createdAt: rating.createdAt.toISOString(),
    };
  }
}

/**
 * Default id factory — uses Node's `crypto.randomUUID` when available so the
 * use case has no third-party id dependency. Tests inject a deterministic
 * factory instead.
 */
function defaultUuid(): string {
  // Avoid a hard import on `crypto` at module scope so this file remains
  // importable in any V8 runtime that exposes globalThis.crypto.
  const cryptoLike = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoLike?.randomUUID) {
    return cryptoLike.randomUUID();
  }
  // Fallback: fall back to a non-collision-safe id. The real persistence path
  // always has Node's crypto available; this branch only matters in legacy
  // bundlers.
  return `rid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
