/**
 * src/infrastructure/repositories/PrismaRecipeRepository.ts
 *
 * Concrete implementation of IRecipeRepository using Prisma + PostgreSQL.
 *
 * Responsibilities:
 *  - Translate domain operations into Prisma queries
 *  - Map Prisma rows ↔ Recipe domain entities (delegated to RecipePrismaMapper)
 *  - Wrap Prisma errors as domain/application errors
 *
 * Imports: domain + infrastructure (Prisma client, mapper). Never imports
 * from interfaces/.  The mapping is the only place where Prisma types touch
 * the Recipe domain entity — the domain itself has zero Prisma awareness.
 */

import type { Prisma } from '@prisma/client';

import type { Rating } from '@/domain/entities/Rating';
import { Recipe } from '@/domain/entities/Recipe';
import {
  DomainError,
  DuplicateResourceError,
  RecipeNotFoundError,
} from '@/domain/errors/DomainError';
import type {
  IRecipeRepository,
  PaginatedResult,
  PaginationOptions,
  RecipeFilters,
} from '@/domain/repositories/IRecipeRepository';

import { prisma } from '../db/prisma';

import {
  RECIPE_INCLUDE,
  RecipePrismaMapper,
} from './RecipePrismaMapper';

export class PrismaRecipeRepository implements IRecipeRepository {
  async save(recipe: Recipe): Promise<void> {
    try {
      await prisma.recipe.create({
        data: RecipePrismaMapper.toCreateInput(recipe),
      });
    } catch (err) {
      this.handlePrismaError(err, recipe.id, 'save recipe');
    }
  }

  async update(recipe: Recipe): Promise<void> {
    try {
      await prisma.$transaction([
        prisma.recipeIngredient.deleteMany({ where: { recipeId: recipe.id } }),
        prisma.recipeStep.deleteMany({ where: { recipeId: recipe.id } }),
        prisma.recipe.update({
          where: { id: recipe.id },
          data: RecipePrismaMapper.toUpdateRootData(recipe),
        }),
        prisma.recipeIngredient.createMany({
          data: recipe.ingredients.map((i) =>
            RecipePrismaMapper.ingredientCreatePayload(i),
          ),
        }),
        prisma.recipeStep.createMany({
          data: recipe.steps.map((s) => RecipePrismaMapper.stepCreatePayload(s)),
        }),
      ]);
    } catch (err) {
      this.handlePrismaError(err, recipe.id, 'update recipe');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await prisma.recipe.delete({ where: { id } });
    } catch (err) {
      this.handlePrismaError(err, id, 'delete recipe');
    }
  }

  async findById(id: string): Promise<Recipe | null> {
    const row = await prisma.recipe.findUnique({
      where: { id },
      include: RECIPE_INCLUDE,
    });
    return row ? RecipePrismaMapper.toDomain(row) : null;
  }

  async findBySlug(slug: string): Promise<Recipe | null> {
    const row = await prisma.recipe.findUnique({
      where: { slug },
      include: RECIPE_INCLUDE,
    });
    return row ? RecipePrismaMapper.toDomain(row) : null;
  }

  async findMany(
    filters: RecipeFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<Recipe>> {
    const and: Prisma.RecipeWhereInput[] = [];

    if (filters.difficulty !== undefined && filters.difficulty.length > 0) {
      and.push({ difficulty: { in: filters.difficulty } });
    }

    if (filters.maxCookTimeMinutes !== undefined) {
      and.push({ cookTimeMinutes: { lte: filters.maxCookTimeMinutes } });
    }

    if (filters.searchTerm !== undefined && filters.searchTerm.trim().length > 0) {
      and.push({
        OR: [
          { name: { contains: filters.searchTerm, mode: 'insensitive' } },
          { description: { contains: filters.searchTerm, mode: 'insensitive' } },
        ],
      });
    }

    if (filters.tags !== undefined && filters.tags.length > 0) {
      // tags column is a JSON array. The interface contract says
      // "recipe must contain ALL listed tags" — AND of array_contains
      // per requested tag.
      for (const tag of filters.tags) {
        and.push({ tags: { array_contains: tag } });
      }
    }

    const where: Prisma.RecipeWhereInput = and.length > 0 ? { AND: and } : {};

    const skip = (pagination.page - 1) * pagination.pageSize;

    const [rows, total] = await prisma.$transaction([
      prisma.recipe.findMany({
        where,
        include: RECIPE_INCLUDE,
        orderBy: { name: 'asc' },
        skip,
        take: pagination.pageSize,
      }),
      prisma.recipe.count({ where }),
    ]);

    return {
      data: rows.map(RecipePrismaMapper.toDomain),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
    };
  }

  async exists(id: string): Promise<boolean> {
    const count = await prisma.recipe.count({ where: { id } });
    return count > 0;
  }

  async saveRating(rating: Rating): Promise<void> {
    try {
      await prisma.recipeRating.create({
        data: {
          id: rating.id,
          recipeId: rating.recipeId,
          value: rating.value,
          createdAt: rating.createdAt,
        },
      });
    } catch (err) {
      this.handlePrismaError(err, rating.id, 'save rating');
    }
  }

  async getAverageRatingsByRecipeIds(
    recipeIds: string[],
  ): Promise<Map<string, number | null>> {
    const out = new Map<string, number | null>();
    if (recipeIds.length === 0) return out;

    // Initialise every requested id to null so unrated recipes are explicit.
    for (const id of recipeIds) out.set(id, null);

    const grouped = await prisma.recipeRating.groupBy({
      by: ['recipeId'],
      where: { recipeId: { in: recipeIds } },
      _avg: { value: true },
    });

    for (const row of grouped) {
      const avg = row._avg.value;
      out.set(row.recipeId, typeof avg === 'number' ? avg : null);
    }
    return out;
  }

  private handlePrismaError(err: unknown, id: string, operation: string): never {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      const code = (err as { code: string }).code;
      if (code === 'P2025') {
        throw new RecipeNotFoundError(id);
      }
      if (code === 'P2002') {
        throw new DuplicateResourceError('recipe');
      }
    }
    if (err instanceof DomainError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new DomainError(`Unexpected error while ${operation}: ${msg}`);
  }
}
