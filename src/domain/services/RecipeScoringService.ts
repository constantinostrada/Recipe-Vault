/**
 * src/domain/services/RecipeScoringService.ts
 *
 * Domain Service: encapsulates business logic that spans multiple domain
 * concepts and doesn't naturally belong to a single entity.
 *
 * Calculates a "completeness score" for a recipe to guide users toward
 * providing rich data before publishing.
 *
 * Imports: domain only — zero third-party dependencies.
 */

import type { Recipe } from '../entities/Recipe';

export interface RecipeScore {
  /** 0–100 */
  total: number;
  breakdown: {
    hasDescription: boolean;
    hasIngredients: boolean;
    hasSteps: boolean;
    hasTags: boolean;
    hasTimes: boolean;
  };
  isReadyToPublish: boolean;
}

export class RecipeScoringService {
  private static readonly WEIGHTS = {
    hasDescription: 20,
    hasIngredients: 25,
    hasSteps: 30,
    hasTags: 10,
    hasTimes: 15,
  };

  /** Returns a completeness score with a breakdown per criterion. */
  score(recipe: Recipe): RecipeScore {
    const breakdown = {
      hasDescription:
        recipe.description !== null && recipe.description.trim().length >= 20,
      hasIngredients: recipe.ingredients.length >= 1,
      hasSteps: recipe.steps.length >= 1,
      hasTags: recipe.tags.length >= 1,
      hasTimes: recipe.prepTimeMin > 0 || recipe.cookTimeMin > 0,
    };

    const total = (Object.keys(breakdown) as Array<keyof typeof breakdown>).reduce(
      (sum, key) => sum + (breakdown[key] ? RecipeScoringService.WEIGHTS[key] : 0),
      0,
    );

    return {
      total,
      breakdown,
      isReadyToPublish: breakdown.hasIngredients && breakdown.hasSteps && total >= 60,
    };
  }

  /**
   * Compares two recipes and returns the one with the higher score.
   * Used when surfacing "featured" recipes.
   */
  selectHigherScored(a: Recipe, b: Recipe): Recipe {
    return this.score(a).total >= this.score(b).total ? a : b;
  }
}
