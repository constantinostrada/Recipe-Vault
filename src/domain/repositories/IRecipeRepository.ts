/**
 * src/domain/repositories/IRecipeRepository.ts
 *
 * Repository interface for the Recipe aggregate.
 * Describes WHAT persistence operations exist — not HOW they are implemented.
 * The concrete implementation lives in src/infrastructure/.
 *
 * Imports: domain only. ZERO knowledge of Prisma, Postgres, HTTP, or any
 * concrete persistence technology. This is enforced by an AC test.
 */

import type { Recipe } from '../entities/Recipe';
import type { DifficultyLevelValue } from '../value-objects/DifficultyLevel';

export interface RecipeFilters {
  /**
   * AND semantics — a recipe matches only if its tags array contains
   * EVERY tag listed here. An empty array is treated as "no tag filter".
   */
  tags?: string[];
  /**
   * OR semantics — a recipe matches if its difficulty is in this set.
   * Used to express a multiselect filter.
   */
  difficulty?: DifficultyLevelValue[];
  /** Upper bound (inclusive) for cookTimeMinutes. */
  maxCookTimeMinutes?: number;
  /** Free-text search over name / description (ILIKE). */
  searchTerm?: string;
  /**
   * Case-insensitive partial match against any ingredient name on the recipe.
   * A recipe matches if at least one of its ingredients' names contains this
   * substring (ILIKE). Empty/undefined means "no ingredient filter".
   */
  ingredientName?: string;
}

export interface PaginationOptions {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface IRecipeRepository {
  /** Persist a new recipe. */
  save(recipe: Recipe): Promise<void>;

  /** Persist changes to an existing recipe. */
  update(recipe: Recipe): Promise<void>;

  /** Remove a recipe by id. */
  delete(id: string): Promise<void>;

  /** Find a single recipe by its id. Returns null when not found. */
  findById(id: string): Promise<Recipe | null>;

  /** Find a single recipe by its slug. Returns null when not found. */
  findBySlug(slug: string): Promise<Recipe | null>;

  /** Find all recipes matching optional filters with pagination. */
  findMany(
    filters: RecipeFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<Recipe>>;

  /** Check whether a recipe with the given id exists. */
  exists(id: string): Promise<boolean>;
}

/** Spec-aligned alias for the repository interface (the AC refers to it as "RecipeRepository"). */
export type RecipeRepository = IRecipeRepository;
