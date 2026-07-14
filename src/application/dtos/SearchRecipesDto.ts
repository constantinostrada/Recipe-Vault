/**
 * src/application/dtos/SearchRecipesDto.ts
 *
 * Input / output DTOs for SearchRecipesUseCase.
 *
 * Kept in a dedicated file so it does not depend on the legacy RecipeDto.ts,
 * which still references the pre-rewrite Recipe shape (title/servings/etc).
 */

import type { DifficultyLevelValue } from '@/domain/value-objects/DifficultyLevel';

export interface SearchRecipesQuery {
  /** Free-text search over recipe name and description (ILIKE on the repo side). */
  query?: string;
  /** Multiselect over difficulty levels. OR semantics. */
  difficulty?: DifficultyLevelValue[];
  /** Upper bound (inclusive) for cookTimeMinutes. */
  maxCookTime?: number;
  /** All listed tags must be present on the recipe. AND semantics. */
  tags?: string[];
  /**
   * Case-insensitive partial match against any ingredient name. Empty or
   * whitespace-only is treated as "no ingredient filter".
   */
  ingredient?: string;
  /** Pagination (1-indexed page). Defaults applied by the use case. */
  page?: number;
  pageSize?: number;
}

export interface RecipeSearchResultItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cookTimeMinutes: number;
  difficulty: DifficultyLevelValue;
  tags: string[];
  imageUrl: string | null;
}

export interface SearchRecipesResult {
  data: RecipeSearchResultItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
