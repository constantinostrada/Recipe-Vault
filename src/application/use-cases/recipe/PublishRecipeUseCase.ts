/**
 * src/application/use-cases/recipe/PublishRecipeUseCase.ts
 *
 * Use Case: Publish a recipe (make it publicly visible).
 *
 * The domain entity enforces the rule that at least one step must exist.
 * The use case enforces the ownership rule.
 *
 * Imports: domain + application only.
 */

import { RecipeNotFoundError, UnauthorizedError } from '@/domain/errors/DomainError';
import type { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';

import type { PublishRecipeInput, RecipeDto } from '../../dtos/RecipeDto';
import { RecipeMapper } from '../../mappers/RecipeMapper';

export class PublishRecipeUseCase {
  constructor(private readonly recipeRepository: IRecipeRepository) {}

  async execute(input: PublishRecipeInput): Promise<RecipeDto> {
    const recipe = await this.recipeRepository.findById(input.recipeId);

    if (!recipe) {
      throw new RecipeNotFoundError(input.recipeId);
    }

    if (!recipe.isOwnedBy(input.requestingUserId)) {
      throw new UnauthorizedError('publish this recipe');
    }

    // Business rule enforced by domain entity: must have at least one step
    recipe.publish();

    await this.recipeRepository.update(recipe);

    return RecipeMapper.toDto(recipe);
  }
}
