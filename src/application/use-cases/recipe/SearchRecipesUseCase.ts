/**
 * src/application/use-cases/recipe/SearchRecipesUseCase.ts
 *
 * Use Case: Search recipes by free-text query, difficulty multiselect,
 * maxCookTime upper bound, and tag set (AND semantics).
 *
 * Every filter is optional and combinable. An empty/whitespace-only query is
 * treated as "no search term" so callers see the full catalog when no filters
 * are supplied. The use case validates and normalises the inputs, then
 * delegates to IRecipeRepository.findMany.
 *
 * Imports: domain + application only (no infrastructure).
 */

import type { Recipe } from '@/domain/entities/Recipe';
import { DomainError } from '@/domain/errors/DomainError';
import type {
  IRecipeRepository,
  RecipeFilters,
} from '@/domain/repositories/IRecipeRepository';
import type { DifficultyLevelValue } from '@/domain/value-objects/DifficultyLevel';

import type {
  RecipeSearchResultItem,
  SearchRecipesQuery,
  SearchRecipesResult,
} from '../../dtos/SearchRecipesDto';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;
const VALID_DIFFICULTIES: ReadonlySet<DifficultyLevelValue> = new Set([
  'easy',
  'medium',
  'hard',
]);

export class SearchRecipesUseCase {
  constructor(private readonly recipeRepository: IRecipeRepository) {}

  async execute(query: SearchRecipesQuery = {}): Promise<SearchRecipesResult> {
    const filters = this.buildFilters(query);
    const page = Math.max(1, query.page ?? DEFAULT_PAGE);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE),
    );

    const result = await this.recipeRepository.findMany(filters, {
      page,
      pageSize,
    });

    return {
      data: result.data.map(toResultItem),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  private buildFilters(query: SearchRecipesQuery): RecipeFilters {
    const filters: RecipeFilters = {};

    if (query.query !== undefined) {
      const trimmed = query.query.trim();
      if (trimmed.length > 0) {
        filters.searchTerm = trimmed;
      }
    }

    if (query.difficulty !== undefined) {
      if (!Array.isArray(query.difficulty)) {
        throw new DomainError('difficulty must be an array of difficulty levels.');
      }
      const deduped: DifficultyLevelValue[] = [];
      for (const level of query.difficulty) {
        if (!VALID_DIFFICULTIES.has(level)) {
          throw new DomainError(
            `"${level}" is not a valid difficulty. Must be one of: easy, medium, hard.`,
          );
        }
        if (!deduped.includes(level)) deduped.push(level);
      }
      if (deduped.length > 0) filters.difficulty = deduped;
    }

    if (query.maxCookTime !== undefined) {
      if (
        typeof query.maxCookTime !== 'number' ||
        !Number.isFinite(query.maxCookTime) ||
        query.maxCookTime <= 0
      ) {
        throw new DomainError('maxCookTime must be a positive number.');
      }
      filters.maxCookTimeMinutes = query.maxCookTime;
    }

    if (query.tags !== undefined) {
      if (!Array.isArray(query.tags)) {
        throw new DomainError('tags must be an array of strings.');
      }
      const deduped: string[] = [];
      for (const raw of query.tags) {
        if (typeof raw !== 'string') {
          throw new DomainError('tags entries must be strings.');
        }
        const trimmed = raw.trim();
        if (trimmed.length === 0) {
          throw new DomainError('tags entries must be non-empty strings.');
        }
        if (!deduped.includes(trimmed)) deduped.push(trimmed);
      }
      if (deduped.length > 0) filters.tags = deduped;
    }

    if (query.ingredient !== undefined) {
      const trimmed = query.ingredient.trim();
      if (trimmed.length > 0) {
        filters.ingredientName = trimmed;
      }
    }

    return filters;
  }
}

function toResultItem(recipe: Recipe): RecipeSearchResultItem {
  return {
    id: recipe.id,
    slug: recipe.slug.value,
    name: recipe.name,
    description: recipe.description,
    cookTimeMinutes: recipe.cookTimeMinutes,
    difficulty: recipe.difficulty.value,
    tags: [...recipe.tags],
    imageUrl: recipe.imageUrl,
  };
}
