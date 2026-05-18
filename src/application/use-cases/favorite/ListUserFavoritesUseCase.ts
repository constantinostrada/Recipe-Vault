/**
 * src/application/use-cases/favorite/ListUserFavoritesUseCase.ts
 *
 * Use Case: Return the authenticated user's favorited recipes, with the full
 * recipe payload (ingredients + steps) so the favorites view can render
 * without an additional round-trip per recipe.
 *
 * Imports: domain + application only (no infrastructure).
 */

import type { Recipe } from '@/domain/entities/Recipe';
import { DomainError } from '@/domain/errors/DomainError';
import type { IFavoriteRecipeRepository } from '@/domain/repositories/IFavoriteRecipeRepository';

import type {
  ListUserFavoritesInput,
  ListUserFavoritesResult,
} from '../../dtos/FavoriteDto';
import type { RecipeDetailDto } from '../../dtos/RecipeDetailDto';

export class ListUserFavoritesUseCase {
  constructor(private readonly favoriteRepository: IFavoriteRecipeRepository) {}

  async execute(input: ListUserFavoritesInput): Promise<ListUserFavoritesResult> {
    if (typeof input?.userId !== 'string' || input.userId.trim().length === 0) {
      throw new DomainError('userId must be a non-empty string.');
    }

    const recipes = await this.favoriteRepository.findRecipesByUser(input.userId);
    return { data: recipes.map(toDetailDto) };
  }
}

function toDetailDto(recipe: Recipe): RecipeDetailDto {
  return {
    id: recipe.id,
    slug: recipe.slug.value,
    name: recipe.name,
    description: recipe.description,
    cookTimeMinutes: recipe.cookTimeMinutes,
    difficulty: recipe.difficulty.value,
    tags: [...recipe.tags],
    imageUrl: recipe.imageUrl,
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
