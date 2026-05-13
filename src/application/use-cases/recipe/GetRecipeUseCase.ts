/**
 * src/application/use-cases/recipe/GetRecipeUseCase.ts
 *
 * Use Case: Retrieve a single recipe by id.
 *
 * Access rules:
 *  - Public recipes are visible to everyone.
 *  - Private recipes are only visible to their author.
 *
 * Imports: domain + application only.
 */

import { RecipeNotFoundError, UnauthorizedError } from '@/domain/errors/DomainError';
import type { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';

import type { GetRecipeInput, RecipeDto } from '../../dtos/RecipeDto';
import { RecipeMapper } from '../../mappers/RecipeMapper';

export class GetRecipeUseCase {
  constructor(private readonly recipeRepository: IRecipeRepository) {}

  async execute(input: GetRecipeInput): Promise<RecipeDto> {
    const recipe = await this.recipeRepository.findById(input.recipeId);

    if (!recipe) {
      throw new RecipeNotFoundError(input.recipeId);
    }

    // Private recipes are only visible to the author
    if (!recipe.isPublic && recipe.authorId !== input.requestingUserId) {
      throw new UnauthorizedError('view this recipe');
    }

    return RecipeMapper.toDto(recipe);
  }
}
