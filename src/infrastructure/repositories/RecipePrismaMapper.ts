/**
 * src/infrastructure/repositories/RecipePrismaMapper.ts
 *
 * Explicit mapper between Prisma rows for the Recipe aggregate and the
 * domain Recipe entity.  Keeping it here (infrastructure) — not in the
 * domain — is what stops Prisma types from leaking inward.
 *
 * The domain entity has zero knowledge of Prisma; everything that mentions
 * `@prisma/client` lives in this file (and in PrismaRecipeRepository).
 */

import type { Prisma, RecipeIngredient as PrismaRecipeIngredientRow, RecipeStep as PrismaRecipeStepRow } from '@prisma/client';

import { Recipe } from '@/domain/entities/Recipe';
import { RecipeIngredient } from '@/domain/entities/RecipeIngredient';
import { RecipeStep } from '@/domain/entities/RecipeStep';
import { DifficultyLevel } from '@/domain/value-objects/DifficultyLevel';
import { Slug } from '@/domain/value-objects/Slug';
import { DomainError } from '@/domain/errors/DomainError';

export const RECIPE_INCLUDE = {
  ingredients: true,
  steps: true,
} satisfies Prisma.RecipeInclude;

export type PrismaRecipeRow = Prisma.RecipeGetPayload<{
  include: typeof RECIPE_INCLUDE;
}>;

export class RecipePrismaMapper {
  static toDomain(row: PrismaRecipeRow): Recipe {
    const ingredients = [...row.ingredients]
      .sort((a, b) => a.order - b.order)
      .map(RecipePrismaMapper.ingredientToDomain);

    const steps = [...row.steps]
      .sort((a, b) => a.order - b.order)
      .map(RecipePrismaMapper.stepToDomain);

    return Recipe.create({
      id: row.id,
      slug: Slug.create(row.slug),
      name: row.name,
      description: row.description,
      cookTimeMinutes: row.cookTimeMinutes,
      difficulty: DifficultyLevel.create(row.difficulty),
      tags: RecipePrismaMapper.tagsFromJson(row.tags),
      imageUrl: row.imageUrl,
      ingredients,
      steps,
    });
  }

  static toCreateInput(recipe: Recipe): Prisma.RecipeCreateInput {
    return {
      id: recipe.id,
      slug: recipe.slug.value,
      name: recipe.name,
      description: recipe.description,
      cookTimeMinutes: recipe.cookTimeMinutes,
      difficulty: recipe.difficulty.value,
      tags: [...recipe.tags] as Prisma.InputJsonValue,
      imageUrl: recipe.imageUrl,
      ingredients: {
        create: recipe.ingredients.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          order: i.order,
        })),
      },
      steps: {
        create: recipe.steps.map((s) => ({
          id: s.id,
          instruction: s.instruction,
          order: s.order,
        })),
      },
    };
  }

  /**
   * Update payload for the root row only.  Child collections are replaced
   * wholesale by the repository (delete + create within a transaction) to
   * keep the aggregate's contiguous order invariant intact without having
   * to reason about diffs.
   */
  static toUpdateRootData(recipe: Recipe): Prisma.RecipeUpdateInput {
    return {
      slug: recipe.slug.value,
      name: recipe.name,
      description: recipe.description,
      cookTimeMinutes: recipe.cookTimeMinutes,
      difficulty: recipe.difficulty.value,
      tags: [...recipe.tags] as Prisma.InputJsonValue,
      imageUrl: recipe.imageUrl,
    };
  }

  static ingredientCreatePayload(
    i: RecipeIngredient,
  ): Prisma.RecipeIngredientCreateManyInput {
    return {
      id: i.id,
      recipeId: i.recipeId,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      order: i.order,
    };
  }

  static stepCreatePayload(s: RecipeStep): Prisma.RecipeStepCreateManyInput {
    return {
      id: s.id,
      recipeId: s.recipeId,
      instruction: s.instruction,
      order: s.order,
    };
  }

  private static ingredientToDomain(row: PrismaRecipeIngredientRow): RecipeIngredient {
    return RecipeIngredient.create({
      id: row.id,
      recipeId: row.recipeId,
      name: row.name,
      quantity: row.quantity,
      unit: row.unit,
      order: row.order,
    });
  }

  private static stepToDomain(row: PrismaRecipeStepRow): RecipeStep {
    return RecipeStep.create({
      id: row.id,
      recipeId: row.recipeId,
      instruction: row.instruction,
      order: row.order,
    });
  }

  private static tagsFromJson(raw: Prisma.JsonValue): string[] {
    if (Array.isArray(raw)) {
      const result: string[] = [];
      for (const item of raw) {
        if (typeof item !== 'string') {
          throw new DomainError(
            `Recipe.tags must contain only strings; got ${JSON.stringify(item)}.`,
          );
        }
        result.push(item);
      }
      return result;
    }
    if (raw === null) return [];
    throw new DomainError(
      `Recipe.tags must be a JSON array, got ${JSON.stringify(raw)}.`,
    );
  }
}
