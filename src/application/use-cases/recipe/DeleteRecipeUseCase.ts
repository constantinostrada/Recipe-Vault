/**
 * src/application/use-cases/recipe/DeleteRecipeUseCase.ts
 *
 * Use Case: Delete a recipe.
 *
 * Only the recipe's author may delete it.
 *
 * Imports: domain + application only.
 */

import { RecipeNotFoundError, UnauthorizedError } from '@/domain/errors/DomainError';
import type { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';

import type { DeleteRecipeInput } from '../../dtos/RecipeDto';

export class DeleteRecipeUseCase {
  constructor(private readonly recipeRepository: IRecipeRepository) {}

  async execute(input: DeleteRecipeInput): Promise<void> {
    const recipe = await this.recipeRepository.findById(input.recipeId);

    if (!recipe) {
      throw new RecipeNotFoundError(input.recipeId);
    }

    if (!recipe.isOwnedBy(input.requestingUserId)) {
      throw new UnauthorizedError('delete this recipe');
    }

    await this.recipeRepository.delete(input.recipeId);
  }
}
