/**
 * src/application/dtos/RateRecipeDto.ts
 *
 * Input / output DTOs for RateRecipeUseCase. Kept in a dedicated file to
 * avoid coupling with the legacy RecipeDto.ts that referenced the
 * pre-rewrite Recipe shape.
 */

export interface RateRecipeInput {
  /** Recipe slug from the URL path. */
  slug: string;
  /** Integer 1..5 — validated by the use case + domain entity. */
  rating: unknown;
}

export interface RatingDto {
  id: string;
  recipeId: string;
  value: number;
  createdAt: string; // ISO-8601
}
