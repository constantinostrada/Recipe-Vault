/**
 * src/application/use-cases/recipe/DuplicateRecipeUseCase.ts
 *
 * Use Case: Duplicate an existing recipe.
 *
 * Loads a Recipe by its id, builds a brand-new aggregate with:
 *   - a fresh recipe id
 *   - the original name + " (copy)"
 *   - a derived, collision-free slug
 *   - fresh ids for every ingredient and step (each child belongs to the new
 *     aggregate, so it must carry the new recipeId — child ids are part of
 *     the aggregate's identity invariants)
 *   - identical ingredient/step content and ordering
 *
 * Persists the new recipe via IRecipeRepository.save and returns a
 * RecipeDetailDto. If no recipe exists with the given id, throws
 * RecipeNotFoundError (which the HTTP layer maps to 404).
 *
 * Imports: domain + application only.
 */

import { randomUUID } from 'crypto';

import { Recipe } from '@/domain/entities/Recipe';
import { RecipeIngredient } from '@/domain/entities/RecipeIngredient';
import { RecipeStep } from '@/domain/entities/RecipeStep';
import { DomainError, RecipeNotFoundError } from '@/domain/errors/DomainError';
import type { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';
import { Slug } from '@/domain/value-objects/Slug';

import type { RecipeDetailDto } from '../../dtos/RecipeDetailDto';

export interface DuplicateRecipeInput {
  recipeId: string;
}

const COPY_SUFFIX = ' (copy)';

export class DuplicateRecipeUseCase {
  constructor(private readonly recipeRepository: IRecipeRepository) {}

  async execute(input: DuplicateRecipeInput): Promise<RecipeDetailDto> {
    if (
      typeof input?.recipeId !== 'string' ||
      input.recipeId.trim().length === 0
    ) {
      throw new DomainError('recipeId must be a non-empty string.');
    }

    const source = await this.recipeRepository.findById(input.recipeId);
    if (!source) {
      throw new RecipeNotFoundError(input.recipeId);
    }

    const newId = randomUUID();
    const newName = source.name + COPY_SUFFIX;
    const newSlug = buildDuplicateSlug(source.slug.value, newName, newId);

    const ingredients = source.ingredients.map((i) =>
      RecipeIngredient.create({
        id: randomUUID(),
        recipeId: newId,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        order: i.order,
      }),
    );

    const steps = source.steps.map((s) =>
      RecipeStep.create({
        id: randomUUID(),
        recipeId: newId,
        instruction: s.instruction,
        order: s.order,
      }),
    );

    const duplicate = Recipe.create({
      id: newId,
      slug: newSlug,
      name: newName,
      description: source.description,
      cookTimeMinutes: source.cookTimeMinutes,
      difficulty: source.difficulty,
      tags: [...source.tags],
      imageUrl: source.imageUrl,
      ingredients,
      steps,
    });

    await this.recipeRepository.save(duplicate);

    return toDetailDto(duplicate);
  }
}

/**
 * Builds a slug that is unique even when the same recipe is duplicated
 * repeatedly. Strategy: derive a base slug from the new title and append a
 * short suffix taken from the new id. Falls back to deriving from the
 * original slug if title-derivation fails (e.g. exotic unicode names).
 */
function buildDuplicateSlug(
  originalSlug: string,
  newName: string,
  newId: string,
): Slug {
  const idSuffix = newId.replace(/-/g, '').slice(0, 8).toLowerCase();
  let base: string;
  try {
    base = Slug.fromTitle(newName).value;
  } catch {
    base = `${originalSlug}-copy`;
  }
  return Slug.create(`${base}-${idSuffix}`);
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
