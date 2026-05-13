/**
 * src/application/mappers/RecipeMapper.ts
 *
 * Bidirectional mapper between Recipe domain entities and RecipeDTOs.
 * Use cases call these mappers — domain entities never leave the use case
 * in raw form.
 *
 * Imports: domain + application.
 */

import type { Recipe } from '@/domain/entities/Recipe';

import type {
  RecipeDto,
  RecipeIngredientDto,
  RecipeStepDto,
  RecipeSummaryDto,
} from '../dtos/RecipeDto';

export class RecipeMapper {
  static toDto(recipe: Recipe): RecipeDto {
    return {
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings,
      prepTimeMin: recipe.prepTimeMin,
      cookTimeMin: recipe.cookTimeMin,
      totalTimeMin: recipe.totalTimeMin,
      difficulty: recipe.difficulty.value,
      isPublic: recipe.isPublic,
      authorId: recipe.authorId,
      ingredients: recipe.ingredients.map(
        (i): RecipeIngredientDto => ({
          id: i.id,
          ingredientId: i.ingredientId,
          ingredientName: i.ingredientName,
          quantity: i.quantity,
          unit: i.unit,
          notes: i.notes,
        }),
      ),
      steps: recipe.steps.map(
        (s): RecipeStepDto => ({
          id: s.id,
          stepNumber: s.stepNumber,
          instruction: s.instruction,
          durationMin: s.durationMin,
        }),
      ),
      tags: [...recipe.tags],
      createdAt: recipe.createdAt.toISOString(),
      updatedAt: recipe.updatedAt.toISOString(),
    };
  }

  static toSummaryDto(recipe: Recipe): RecipeSummaryDto {
    return {
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings,
      totalTimeMin: recipe.totalTimeMin,
      difficulty: recipe.difficulty.value,
      isPublic: recipe.isPublic,
      authorId: recipe.authorId,
      tags: [...recipe.tags],
      createdAt: recipe.createdAt.toISOString(),
    };
  }
}
