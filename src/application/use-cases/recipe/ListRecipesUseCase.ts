/**
 * src/application/use-cases/recipe/ListRecipesUseCase.ts
 *
 * Use Case: List recipes with filtering and pagination.
 *
 * When no requestingUserId is provided, only public recipes are returned.
 * When a requestingUserId is provided, that user's private recipes are
 * also included if the authorId filter matches them.
 *
 * Imports: domain + application only.
 */

import type { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';

import type { ListRecipesInput, PaginatedRecipesDto } from '../../dtos/RecipeDto';
import { RecipeMapper } from '../../mappers/RecipeMapper';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;

export class ListRecipesUseCase {
  constructor(private readonly recipeRepository: IRecipeRepository) {}

  async execute(input: ListRecipesInput): Promise<PaginatedRecipesDto> {
    const page = Math.max(1, input.page ?? DEFAULT_PAGE);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE),
    );

    // Only show public recipes unless the request is scoped to the author themselves
    const showPrivate =
      input.authorId !== undefined &&
      input.requestingUserId !== undefined &&
      input.authorId === input.requestingUserId;

    const isPublicFilter = showPrivate ? undefined : true;

    const result = await this.recipeRepository.findMany(
      {
        authorId: input.authorId,
        isPublic: isPublicFilter,
        tags: input.tags,
        difficulty: input.difficulty,
        searchTerm: input.searchTerm,
      },
      { page, pageSize },
    );

    return {
      data: result.data.map(RecipeMapper.toSummaryDto),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }
}
