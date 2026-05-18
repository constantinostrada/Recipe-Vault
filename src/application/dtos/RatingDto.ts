/**
 * src/application/dtos/RatingDto.ts
 *
 * Input/output contracts for the recipe-rating use cases.
 *
 * Imports: application only.
 */

export interface RateRecipeInput {
  /** Slug of the recipe being rated. */
  slug: string;
  /** Id of the authenticated user submitting the rating. */
  userId: string;
  /** Stars in the integer range 1..5 inclusive. */
  stars: number;
}

export interface RemoveRatingInput {
  slug: string;
  userId: string;
}

export interface GetRecipeRatingStatsInput {
  slug: string;
}

export interface RecipeRatingStatsDto {
  average: number;
  count: number;
}
