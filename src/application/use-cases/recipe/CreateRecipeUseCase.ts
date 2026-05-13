/**
 * src/application/use-cases/recipe/CreateRecipeUseCase.ts
 *
 * Use Case: Create a new recipe.
 *
 * Single responsibility: orchestrate domain objects to create and persist
 * a new Recipe.  No business rules live here — they live in the domain.
 *
 * Receives its dependencies via constructor (Dependency Inversion).
 * Returns a RecipeDetailDto — never a raw domain entity.
 *
 * Imports: domain + application only.
 */

import { randomUUID } from 'crypto';

import { Recipe } from '@/domain/entities/Recipe';
import { RecipeIngredient } from '@/domain/entities/RecipeIngredient';
import { RecipeStep } from '@/domain/entities/RecipeStep';
import { DifficultyLevel } from '@/domain/value-objects/DifficultyLevel';
import { Slug } from '@/domain/value-objects/Slug';
import type { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';

import type { RecipeDetailDto } from '../../dtos/RecipeDetailDto';

export interface CreateRecipeIngredientInput {
  name: string;
  quantity: number;
  unit: string;
}

export interface CreateRecipeStepInput {
  instruction: string;
}

export interface CreateRecipeInput {
  name: string;
  description?: string | null;
  cookTimeMinutes: number;
  difficulty: string;
  tags?: string[];
  imageUrl?: string | null;
  ingredients: CreateRecipeIngredientInput[];
  steps: CreateRecipeStepInput[];
}

export class CreateRecipeUseCase {
  constructor(private readonly recipeRepository: IRecipeRepository) {}

  async execute(input: CreateRecipeInput): Promise<RecipeDetailDto> {
    const recipeId = randomUUID();

    const ingredients = input.ingredients.map((i, idx) =>
      RecipeIngredient.create({
        id: randomUUID(),
        recipeId,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        order: idx + 1,
      }),
    );

    const steps = input.steps.map((s, idx) =>
      RecipeStep.create({
        id: randomUUID(),
        recipeId,
        instruction: s.instruction,
        order: idx + 1,
      }),
    );

    const recipe = Recipe.create({
      id: recipeId,
      slug: Slug.fromTitle(input.name),
      name: input.name,
      description: input.description ?? null,
      cookTimeMinutes: input.cookTimeMinutes,
      difficulty: DifficultyLevel.create(input.difficulty),
      tags: input.tags ?? [],
      imageUrl: input.imageUrl ?? null,
      ingredients,
      steps,
    });

    await this.recipeRepository.save(recipe);

    return toDetailDto(recipe);
  }
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
