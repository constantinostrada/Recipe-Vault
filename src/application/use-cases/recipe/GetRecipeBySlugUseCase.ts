/**
 * src/application/use-cases/recipe/GetRecipeBySlugUseCase.ts
 *
 * Use Case: Retrieve a single recipe by slug, including its ingredients
 * and steps. Used by the public detail endpoint.
 *
 * Imports: domain + application only (no infrastructure).
 */

import type { Recipe } from '@/domain/entities/Recipe';
import { DomainError, RecipeNotFoundError } from '@/domain/errors/DomainError';
import type { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';

import type { RecipeDetailDto } from '../../dtos/RecipeDetailDto';

export interface GetRecipeBySlugInput {
  slug: string;
}

export class GetRecipeBySlugUseCase {
  constructor(private readonly recipeRepository: IRecipeRepository) {}

  async execute(input: GetRecipeBySlugInput): Promise<RecipeDetailDto> {
    if (typeof input?.slug !== 'string' || input.slug.trim().length === 0) {
      throw new DomainError('slug must be a non-empty string.');
    }
    const recipe = await this.recipeRepository.findBySlug(input.slug);
    if (!recipe) {
      throw new RecipeNotFoundError(input.slug);
    }
    const averages = await this.recipeRepository.getAverageRatingsByRecipeIds([
      recipe.id,
    ]);
    return toDetailDto(recipe, roundAverage(averages.get(recipe.id) ?? null));
  }
}

function toDetailDto(recipe: Recipe, averageRating: number | null): RecipeDetailDto {
  return {
    id: recipe.id,
    slug: recipe.slug.value,
    name: recipe.name,
    description: recipe.description,
    cookTimeMinutes: recipe.cookTimeMinutes,
    difficulty: recipe.difficulty.value,
    tags: [...recipe.tags],
    imageUrl: recipe.imageUrl,
    averageRating,
    ingredients: recipe.ingredients.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      order: i.order,
    })),
    steps: recipe.steps.map((s) => ({
      id: s.id,
      instruction: s.instruction,
      order: s.order,
    })),
  };
}

/** AC-4: surface averages rounded to a single decimal (e.g. 3.666… → 3.7). */
function roundAverage(value: number | null): number | null {
  if (value === null) return null;
  return Math.round(value * 10) / 10;
}
