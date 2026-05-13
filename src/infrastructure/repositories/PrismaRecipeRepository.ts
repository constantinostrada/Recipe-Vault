/**
 * src/infrastructure/repositories/PrismaRecipeRepository.ts
 *
 * Concrete implementation of IRecipeRepository using Prisma + PostgreSQL.
 *
 * Responsibilities:
 *  - Maps Prisma DB rows → domain entities (Recipe, RecipeIngredient, RecipeStep)
 *  - Maps domain entities → Prisma create/update payloads
 *  - Wraps Prisma errors as domain/application errors
 *
 * Imports: domain, application, and infrastructure (Prisma client).
 * Never imports from interfaces/.
 */

import type { Prisma } from '@prisma/client';

import { Recipe } from '@/domain/entities/Recipe';
import { RecipeIngredient } from '@/domain/entities/RecipeIngredient';
import { RecipeStep } from '@/domain/entities/RecipeStep';
import { DifficultyLevel } from '@/domain/value-objects/DifficultyLevel';
import {
  RecipeNotFoundError,
  DomainError,
} from '@/domain/errors/DomainError';
import type {
  IRecipeRepository,
  RecipeFilters,
  PaginationOptions,
  PaginatedResult,
} from '@/domain/repositories/IRecipeRepository';

import { prisma } from '../db/prisma';

// ── Prisma query include shape ─────────────────────────────────────────────

const RECIPE_INCLUDE = {
  ingredients: {
    include: { ingredient: true },
  },
  steps: {
    orderBy: { stepNumber: 'asc' as const },
  },
  tags: {
    include: { tag: true },
  },
} satisfies Prisma.RecipeInclude;

type PrismaRecipeFull = Prisma.RecipeGetPayload<{ include: typeof RECIPE_INCLUDE }>;

// ── Mapper ─────────────────────────────────────────────────────────────────

function toDomain(row: PrismaRecipeFull): Recipe {
  const ingredients = row.ingredients.map(
    (ri) =>
      new RecipeIngredient({
        id: ri.id,
        recipeId: ri.recipeId,
        ingredientId: ri.ingredientId,
        ingredientName: ri.ingredient.name,
        quantity: ri.quantity,
        unit: ri.unit,
        notes: ri.notes,
      }),
  );

  const steps = row.steps.map(
    (s) =>
      new RecipeStep({
        id: s.id,
        recipeId: s.recipeId,
        stepNumber: s.stepNumber,
        instruction: s.instruction,
        durationMin: s.durationMin,
      }),
  );

  const tags = row.tags.map((rt) => rt.tag.name);

  return Recipe.create({
    id: row.id,
    title: row.title,
    description: row.description,
    servings: row.servings,
    prepTimeMin: row.prepTimeMin,
    cookTimeMin: row.cookTimeMin,
    difficulty: DifficultyLevel.create(row.difficulty),
    isPublic: row.isPublic,
    authorId: row.authorId,
    ingredients,
    steps,
    tags,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

// ── Repository implementation ──────────────────────────────────────────────

export class PrismaRecipeRepository implements IRecipeRepository {
  async save(recipe: Recipe): Promise<void> {
    try {
      await prisma.recipe.create({
        data: {
          id: recipe.id,
          title: recipe.title,
          description: recipe.description,
          servings: recipe.servings,
          prepTimeMin: recipe.prepTimeMin,
          cookTimeMin: recipe.cookTimeMin,
          difficulty: recipe.difficulty.value,
          isPublic: recipe.isPublic,
          authorId: recipe.authorId,
          createdAt: recipe.createdAt,
          updatedAt: recipe.updatedAt,
          ingredients: {
            create: recipe.ingredients.map((i) => ({
              id: i.id,
              ingredientId: i.ingredientId,
              quantity: i.quantity,
              unit: i.unit,
              notes: i.notes,
            })),
          },
          steps: {
            create: recipe.steps.map((s) => ({
              id: s.id,
              stepNumber: s.stepNumber,
              instruction: s.instruction,
              durationMin: s.durationMin,
            })),
          },
          tags: {
            create: recipe.tags.map((tagName) => ({
              tag: {
                connectOrCreate: {
                  where: { name: tagName },
                  create: {
                    name: tagName,
                    slug: tagName.toLowerCase().replace(/\s+/g, '-'),
                  },
                },
              },
            })),
          },
        },
      });
    } catch (err) {
      this.handlePrismaError(err, 'save recipe');
    }
  }

  async update(recipe: Recipe): Promise<void> {
    try {
      await prisma.recipe.update({
        where: { id: recipe.id },
        data: {
          title: recipe.title,
          description: recipe.description,
          servings: recipe.servings,
          prepTimeMin: recipe.prepTimeMin,
          cookTimeMin: recipe.cookTimeMin,
          difficulty: recipe.difficulty.value,
          isPublic: recipe.isPublic,
          updatedAt: recipe.updatedAt,
        },
      });
    } catch (err) {
      this.handlePrismaError(err, 'update recipe');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await prisma.recipe.delete({ where: { id } });
    } catch (err) {
      this.handlePrismaError(err, 'delete recipe');
    }
  }

  async findById(id: string): Promise<Recipe | null> {
    const row = await prisma.recipe.findUnique({
      where: { id },
      include: RECIPE_INCLUDE,
    });

    return row ? toDomain(row) : null;
  }

  async findMany(
    filters: RecipeFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<Recipe>> {
    const where: Prisma.RecipeWhereInput = {
      ...(filters.authorId !== undefined && { authorId: filters.authorId }),
      ...(filters.isPublic !== undefined && { isPublic: filters.isPublic }),
      ...(filters.difficulty !== undefined && { difficulty: filters.difficulty }),
      ...(filters.tags !== undefined &&
        filters.tags.length > 0 && {
          tags: {
            some: {
              tag: { name: { in: filters.tags } },
            },
          },
        }),
      ...(filters.searchTerm !== undefined && {
        OR: [
          { title: { contains: filters.searchTerm, mode: 'insensitive' } },
          { description: { contains: filters.searchTerm, mode: 'insensitive' } },
        ],
      }),
    };

    const skip = (pagination.page - 1) * pagination.pageSize;

    const [rows, total] = await prisma.$transaction([
      prisma.recipe.findMany({
        where,
        include: RECIPE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pagination.pageSize,
      }),
      prisma.recipe.count({ where }),
    ]);

    return {
      data: rows.map(toDomain),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize),
    };
  }

  async findByAuthor(
    authorId: string,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<Recipe>> {
    return this.findMany({ authorId }, pagination);
  }

  async exists(id: string): Promise<boolean> {
    const count = await prisma.recipe.count({ where: { id } });
    return count > 0;
  }

  // ── Error handling ───────────────────────────────────────────────────────

  private handlePrismaError(err: unknown, operation: string): never {
    // Prisma known error codes
    if (typeof err === 'object' && err !== null && 'code' in err) {
      const code = (err as { code: string }).code;
      if (code === 'P2025') {
        throw new RecipeNotFoundError('unknown');
      }
      if (code === 'P2002') {
        throw new DomainError(`Duplicate record when trying to ${operation}.`);
      }
    }
    throw new DomainError(`Unexpected error during ${operation}.`);
  }
}
