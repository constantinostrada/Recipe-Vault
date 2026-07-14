/**
 * src/infrastructure/repositories/PrismaRatingRepository.ts
 *
 * Concrete IRatingRepository using Prisma + PostgreSQL.
 *
 * Translates domain operations into Prisma queries against the `ratings`
 * table. The composite @@unique([userId, recipeId]) doubles as the upsert
 * key — Prisma exposes it as `where: { userId_recipeId: { userId, recipeId } }`.
 *
 * Imports: domain + infrastructure (Prisma client). Never imports from
 * interfaces/.
 */

import type {
  IRatingRepository,
  RecipeRatingStats,
} from '@/domain/repositories/IRatingRepository';

import { prisma } from '../db/prisma';

export class PrismaRatingRepository implements IRatingRepository {
  async upsert(userId: string, recipeId: string, stars: number): Promise<void> {
    await prisma.rating.upsert({
      where: { userId_recipeId: { userId, recipeId } },
      update: { stars },
      create: { userId, recipeId, stars },
    });
  }

  async remove(userId: string, recipeId: string): Promise<void> {
    await prisma.rating.deleteMany({
      where: { userId, recipeId },
    });
  }

  async getStats(recipeId: string): Promise<RecipeRatingStats> {
    const result = await prisma.rating.aggregate({
      where: { recipeId },
      _avg: { stars: true },
      _count: { _all: true },
    });
    return {
      average: result._avg.stars ?? 0,
      count: result._count._all,
    };
  }
}
