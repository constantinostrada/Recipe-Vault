/**
 * src/application/use-cases/recipe/UpdateRecipeUseCase.ts
 *
 * Use Case: Update recipe metadata.
 *
 * Only the recipe author may update their own recipe.
 * Delegates all invariant checks to the Recipe entity.
 *
 * Imports: domain + application only.
 */

import { DifficultyLevel } from '@/domain/value-objects/DifficultyLevel';
import { RecipeNotFoundError, UnauthorizedError } from '@/domain/errors/DomainError';
import type { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';

import type { UpdateRecipeInput, RecipeDto } from '../../dtos/RecipeDto';
import { RecipeMapper } from '../../mappers/RecipeMapper';

export class UpdateRecipeUseCase {
  constructor(private readonly recipeRepository: IRecipeRepository) {}

  async execute(input: UpdateRecipeInput): Promise<RecipeDto> {
    const recipe = await this.recipeRepository.findById(input.recipeId);

    if (!recipe) {
      throw new RecipeNotFoundError(input.recipeId);
    }

    if (!recipe.isOwnedBy(input.requestingUserId)) {
      throw new UnauthorizedError('edit this recipe');
    }

    if (input.title !== undefined) {
      recipe.updateTitle(input.title);
    }

    if (input.description !== undefined) {
      recipe.updateDescription(input.description);
    }

    if (input.servings !== undefined) {
      recipe.updateServings(input.servings);
    }

    if (input.prepTimeMin !== undefined || input.cookTimeMin !== undefined) {
      recipe.updateTimes(
        input.prepTimeMin ?? recipe.prepTimeMin,
        input.cookTimeMin ?? recipe.cookTimeMin,
      );
    }

    if (input.difficulty !== undefined) {
      recipe.updateDifficulty(DifficultyLevel.create(input.difficulty));
    }

    await this.recipeRepository.update(recipe);

    return RecipeMapper.toDto(recipe);
  }
}
