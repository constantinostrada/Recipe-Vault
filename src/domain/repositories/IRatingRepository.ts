/**
 * src/domain/repositories/IRatingRepository.ts
 *
 * Repository interface for the User → Recipe rating relation.
 * Describes WHAT persistence operations exist — not HOW they are implemented.
 *
 * Imports: domain only. ZERO knowledge of Prisma, Postgres, HTTP.
 */

export interface RecipeRatingStats {
  /** Average stars across all ratings for the recipe. 0 when no ratings. */
  average: number;
  /** Number of ratings for the recipe. */
  count: number;
}

export interface IRatingRepository {
  /**
   * Insert or update the rating a user gave to a recipe.
   * Idempotent on (userId, recipeId) — second call with the same pair
   * overwrites the previous `stars`.
   */
  upsert(userId: string, recipeId: string, stars: number): Promise<void>;

  /**
   * Remove the rating a user gave to a recipe.
   * Idempotent — removing a non-existent rating is a no-op (never throws).
   */
  remove(userId: string, recipeId: string): Promise<void>;

  /**
   * Aggregate stats for a recipe. Returns { average: 0, count: 0 }
   * when no ratings exist.
   */
  getStats(recipeId: string): Promise<RecipeRatingStats>;
}

/** Spec-aligned alias (the AC refers to it as "RatingRepository"). */
export type RatingRepository = IRatingRepository;
