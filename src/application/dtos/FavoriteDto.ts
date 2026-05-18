/**
 * src/application/dtos/FavoriteDto.ts
 *
 * Input / output DTOs for the favorite-recipe use cases.
 *
 * The list result reuses RecipeDetailDto so /api/me/favorites returns the
 * "full recipe payload" (ingredients + steps) requested by the AC.
 */

import type { RecipeDetailDto } from './RecipeDetailDto';

export interface FavoriteRecipeInput {
  userId: string;
  recipeId: string;
}

export interface ListUserFavoritesInput {
  userId: string;
}

export interface ListUserFavoritesResult {
  data: RecipeDetailDto[];
}
