/**
 * src/domain/repositories/IRecipeRepository.ts
 *
 * Repository interface for the Recipe aggregate.
 * Describes WHAT persistence operations exist — not HOW they are implemented.
 * The concrete implementation lives in src/infrastructure/.
 *
 * Imports: domain only.
 */

import type { Recipe } from '../entities/Recipe';

export interface RecipeFilters {
  authorId?: string;
  isPublic?: boolean;
  tags?: string[];
  difficulty?: string;
  searchTerm?: string;
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

  /** Find all recipes matching optional filters with pagination. */
  findMany(
    filters: RecipeFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<Recipe>>;

  /** Find all recipes authored by a specific user. */
  findByAuthor(
    authorId: string,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<Recipe>>;

  /** Check whether a recipe with the given id exists. */
  exists(id: string): Promise<boolean>;
}
