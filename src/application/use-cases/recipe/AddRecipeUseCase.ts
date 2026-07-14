/**
 * src/application/use-cases/recipe/AddRecipeUseCase.ts
 *
 * Use Case: Create a new recipe aligned with the current Recipe aggregate
 * (id, slug, name, description, cookTimeMinutes, difficulty, tags, imageUrl,
 * ingredients, steps).
 *
 * Built as a parallel-new file rather than rewriting the legacy
 * CreateRecipeUseCase.ts which still references the pre-rewrite Recipe
 * shape (title/servings/prepTimeMin/...) and is tracked for cleanup by a
 * separate realign task.
 *
 * Imports: domain + application only.
 */

import { randomUUID } from 'crypto';

import { Recipe } from '@/domain/entities/Recipe';
import { RecipeIngredient } from '@/domain/entities/RecipeIngredient';
import { RecipeStep } from '@/domain/entities/RecipeStep';
import { DifficultyLevel } from '@/domain/value-objects/DifficultyLevel';
import { Slug } from '@/domain/value-objects/Slug';
import { DomainError } from '@/domain/errors/DomainError';
import type { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';

import type { RecipeDetailDto } from '../../dtos/RecipeDetailDto';

export interface AddRecipeIngredientInput {
  name: string;
  quantity: number;
  unit: string;
}

export interface AddRecipeStepInput {
  instruction: string;
}

export interface AddRecipeInput {
  slug?: string;
  name: string;
  description?: string | null;
  cookTimeMinutes: number;
  difficulty: string;
  tags?: string[];
  imageUrl?: string | null;
  ingredients?: AddRecipeIngredientInput[];
  steps?: AddRecipeStepInput[];
}

export class AddRecipeUseCase {
  constructor(private readonly recipeRepository: IRecipeRepository) {}

  async execute(input: AddRecipeInput): Promise<RecipeDetailDto> {
    if (!input || typeof input !== 'object') {
      throw new DomainError('AddRecipe input must be an object.');
    }

    const recipeId = randomUUID();
    const slug = input.slug
      ? Slug.create(input.slug)
      : Slug.fromTitle(input.name);

    const ingredients = (input.ingredients ?? []).map((raw, idx) =>
      RecipeIngredient.create({
        id: randomUUID(),
        recipeId,
        name: raw.name,
        quantity: raw.quantity,
        unit: raw.unit,
        order: idx + 1,
      }),
    );

    const steps = (input.steps ?? []).map((raw, idx) =>
      RecipeStep.create({
        id: randomUUID(),
        recipeId,
        instruction: raw.instruction,
        order: idx + 1,
      }),
    );

    const tags = normaliseTags(input.tags ?? []);

    const recipe = Recipe.create({
      id: recipeId,
      slug,
      name: input.name,
      description: input.description ?? null,
      cookTimeMinutes: input.cookTimeMinutes,
      difficulty: DifficultyLevel.create(input.difficulty),
      tags,
      imageUrl: input.imageUrl ?? null,
      ingredients,
      steps,
    });

    await this.recipeRepository.save(recipe);

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
