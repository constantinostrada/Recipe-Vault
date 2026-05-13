/**
 * src/application/use-cases/recipe/CreateRecipeUseCase.ts
 *
 * Use Case: Create a new recipe.
 *
 * Single responsibility: orchestrate domain objects to create and persist
 * a new Recipe.  No business rules live here — they live in the domain.
 *
 * Receives its dependencies via constructor (Dependency Inversion).
 * Returns a DTO — never a raw domain entity.
 *
 * Imports: domain + application only.
 */

import { randomUUID } from 'crypto';

import { RecipeIngredient } from '@/domain/entities/RecipeIngredient';
import { RecipeStep } from '@/domain/entities/RecipeStep';
import { Recipe } from '@/domain/entities/Recipe';
import { DifficultyLevel } from '@/domain/value-objects/DifficultyLevel';
import type { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';

import type { CreateRecipeInput, RecipeDto } from '../../dtos/RecipeDto';
import { RecipeMapper } from '../../mappers/RecipeMapper';

export class CreateRecipeUseCase {
  constructor(private readonly recipeRepository: IRecipeRepository) {}

  async execute(input: CreateRecipeInput): Promise<RecipeDto> {
    const now = new Date();
    const recipeId = randomUUID();

    const ingredients = input.ingredients.map(
      (i) =>
        new RecipeIngredient({
          id: randomUUID(),
          recipeId,
          ingredientId: i.ingredientId,
          ingredientName: i.ingredientName,
          quantity: i.quantity,
          unit: i.unit,
          notes: i.notes ?? null,
        }),
    );

    const steps = input.steps.map(
      (s) =>
        new RecipeStep({
          id: randomUUID(),
          recipeId,
          stepNumber: s.stepNumber,
          instruction: s.instruction,
          durationMin: s.durationMin ?? null,
        }),
    );

    const recipe = Recipe.create({
      id: recipeId,
      title: input.title,
      description: input.description ?? null,
      servings: input.servings,
      prepTimeMin: input.prepTimeMin,
      cookTimeMin: input.cookTimeMin,
      difficulty: DifficultyLevel.create(input.difficulty),
      isPublic: input.isPublic ?? false,
      authorId: input.authorId,
      ingredients,
      steps,
      tags: input.tags ?? [],
      createdAt: now,
      updatedAt: now,
    });

    await this.recipeRepository.save(recipe);

    return RecipeMapper.toDto(recipe);
  }
}
