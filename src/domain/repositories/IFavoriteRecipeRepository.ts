/**
 * src/domain/repositories/IFavoriteRecipeRepository.ts
 *
 * Repository interface for the User → Recipe favorite relation.
 * Describes WHAT persistence operations exist — not HOW they are implemented.
 *
 * Imports: domain only. Zero knowledge of Prisma, Postgres, or any concrete
 * persistence technology.
 */

import type { Recipe } from '../entities/Recipe';

export interface IFavoriteRecipeRepository {
  /**
   * Mark a recipe as favorited by the given user. Idempotent: calling twice
   * with the same (userId, recipeId) pair must not throw.
   */
  add(userId: string, recipeId: string): Promise<void>;

  /**
   * Remove the favorite relation. Idempotent: calling on a non-existing
   * favorite is a no-op (no throw).
   */
  remove(userId: string, recipeId: string): Promise<void>;

  /**
   * Return whether the user has favorited the recipe.
   */
  exists(userId: string, recipeId: string): Promise<boolean>;

  /**
   * Return every Recipe currently favorited by the user, ordered by the
   * favorite's createdAt descending (most recently favorited first).
   */
  findRecipesByUser(userId: string): Promise<Recipe[]>;
}

/** Spec-aligned alias (the AC refers to it as "FavoriteRecipeRepository"). */
export type FavoriteRecipeRepository = IFavoriteRecipeRepository;
