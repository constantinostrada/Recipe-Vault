/**
 * src/application/dtos/RecipeDetailDto.ts
 *
 * Output DTO for GetRecipeBySlugUseCase. Includes the full recipe with
 * its children (ingredients + steps) so the detail view can render
 * without additional round-trips.
 *
 * Kept in a dedicated file so it does not depend on the legacy RecipeDto.ts,
 * which still references the pre-rewrite Recipe shape.
 */

import type { DifficultyLevelValue } from '@/domain/value-objects/DifficultyLevel';

export interface RecipeDetailIngredientDto {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  order: number;
}

export interface RecipeDetailStepDto {
  id: string;
  instruction: string;
  order: number;
}

export interface RecipeDetailDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cookTimeMinutes: number;
  difficulty: DifficultyLevelValue;
  tags: string[];
  imageUrl: string | null;
  ingredients: RecipeDetailIngredientDto[];
  steps: RecipeDetailStepDto[];
}
