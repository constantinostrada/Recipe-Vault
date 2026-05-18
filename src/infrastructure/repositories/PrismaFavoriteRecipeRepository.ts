/**
 * src/infrastructure/repositories/PrismaFavoriteRecipeRepository.ts
 *
 * Concrete implementation of IFavoriteRecipeRepository using Prisma + PostgreSQL.
 *
 * - `add` uses upsert semantics over the composite (userId, recipeId) unique key
 *   so retrying a favorite is a no-op.
 * - `remove` swallows the "record not found" P2025 case so un-favoriting is
 *   idempotent.
 * - `findRecipesByUser` hydrates full Recipe aggregates by reusing the existing
 *   RecipePrismaMapper so the same domain entity shape flows everywhere.
 *
 * Imports: domain + infrastructure (Prisma client, mapper). Never imports
 * from interfaces/.
 */

import type { Recipe } from '@/domain/entities/Recipe';
import { DomainError } from '@/domain/errors/DomainError';
import type { IFavoriteRecipeRepository } from '@/domain/repositories/IFavoriteRecipeRepository';

import { prisma } from '../db/prisma';

import { RECIPE_INCLUDE, RecipePrismaMapper } from './RecipePrismaMapper';

export class PrismaFavoriteRecipeRepository implements IFavoriteRecipeRepository {
  async add(userId: string, recipeId: string): Promise<void> {
    try {
      await prisma.userFavorite.upsert({
        where: { userId_recipeId: { userId, recipeId } },
        create: { userId, recipeId },
        update: {},
      });
    } catch (err) {
      this.rethrow(err, 'add favorite');
    }
  }

  async remove(userId: string, recipeId: string): Promise<void> {
    try {
      await prisma.userFavorite.deleteMany({
        where: { userId, recipeId },
      });
    } catch (err) {
      this.rethrow(err, 'remove favorite');
    }
  }

  async exists(userId: string, recipeId: string): Promise<boolean> {
    const count = await prisma.userFavorite.count({
      where: { userId, recipeId },
    });
    return count > 0;
  }

  async findRecipesByUser(userId: string): Promise<Recipe[]> {
    const rows = await prisma.userFavorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { recipe: { include: RECIPE_INCLUDE } },
    });
    return rows.map((row) => RecipePrismaMapper.toDomain(row.recipe));
  }

  private rethrow(err: unknown, operation: string): never {
    if (err instanceof DomainError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new DomainError(`Unexpected error while ${operation}: ${msg}`);
  }
}
