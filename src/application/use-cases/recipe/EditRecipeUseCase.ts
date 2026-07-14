/**
 * src/application/use-cases/recipe/EditRecipeUseCase.ts
 *
 * Use Case: Update the metadata of an existing recipe (lookup by slug).
 *
 * Aligned with the current Recipe aggregate. Only changes the fields
 * provided in the input — leaves everything else untouched. Notably
 * supports updating the `tags` array (the primary motivation for this
 * use case in the tags-feature task).
 *
 * Built as a parallel-new file rather than rewriting the legacy
 * UpdateRecipeUseCase.ts which still references the pre-rewrite Recipe
 * shape (title/servings/prepTimeMin/...) and is tracked for cleanup by a
 * separate realign task.
 *
 * Imports: domain + application only.
 */

import { DifficultyLevel } from '@/domain/value-objects/DifficultyLevel';
import { DomainError, RecipeNotFoundError } from '@/domain/errors/DomainError';
import type { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';
import type { Recipe } from '@/domain/entities/Recipe';

import type { RecipeDetailDto } from '../../dtos/RecipeDetailDto';

export interface EditRecipeInput {
  /** Slug of the recipe to update (path identifier). */
  slug: string;
  name?: string;
  description?: string | null;
  cookTimeMinutes?: number;
  difficulty?: string;
  tags?: string[];
  imageUrl?: string | null;
}

export class EditRecipeUseCase {
  constructor(private readonly recipeRepository: IRecipeRepository) {}

  async execute(input: EditRecipeInput): Promise<RecipeDetailDto> {
    if (!input || typeof input !== 'object') {
      throw new DomainError('EditRecipe input must be an object.');
    }
    if (typeof input.slug !== 'string' || input.slug.trim().length === 0) {
      throw new DomainError('slug must be a non-empty string.');
    }

    const recipe = await this.recipeRepository.findBySlug(input.slug);
    if (!recipe) {
      throw new RecipeNotFoundError(input.slug);
    }

    if (input.name !== undefined) {
      recipe.rename(input.name);
    }
    if (input.description !== undefined) {
      recipe.updateDescription(input.description);
    }
    if (input.cookTimeMinutes !== undefined) {
      recipe.updateCookTimeMinutes(input.cookTimeMinutes);
    }
    if (input.difficulty !== undefined) {
      recipe.updateDifficulty(DifficultyLevel.create(input.difficulty));
    }
    if (input.tags !== undefined) {
      recipe.updateTags(normaliseTags(input.tags));
    }
    if (input.imageUrl !== undefined) {
      recipe.updateImageUrl(input.imageUrl);
    }

    await this.recipeRepository.update(recipe);

    return toDetailDto(recipe);
  }
}

function normaliseTags(raw: string[]): string[] {
  if (!Array.isArray(raw)) {
    throw new DomainError('tags must be an array of strings.');
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    if (typeof value !== 'string') {
      throw new DomainError('each tag must be a string.');
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new DomainError('tag entries must be non-empty.');
    }
    const dedupeKey = trimmed.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(trimmed);
  }
  return out;
}

function toDetailDto(recipe: Recipe): RecipeDetailDto {
  return {
    id: recipe.id,
    slug: recipe.slug.value,
    name: recipe.name,
    description: recipe.description,
    cookTimeMinutes: recipe.cookTimeMinutes,
    difficulty: recipe.difficulty.value,
    tags: [...recipe.tags],
    imageUrl: recipe.imageUrl,
    ingredients: recipe.ingredients.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      order: i.order,
    })),
    steps: recipe.steps.map((s) => ({
      id: s.id,
      instruction: s.instruction,
      order: s.order,
    })),
  };
}
