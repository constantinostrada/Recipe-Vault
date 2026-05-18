/**
 * src/infrastructure/repositories/PrismaCommentRepository.ts
 *
 * Concrete Prisma implementation of ICommentRepository.
 * Maps Prisma rows ↔ Comment domain entity. Outside callers only see
 * the Comment aggregate and the domain interface.
 *
 * Imports: domain + infrastructure (Prisma client). Never imports from
 * interfaces/.
 */

import { Comment } from '@/domain/entities/Comment';
import type { ICommentRepository } from '@/domain/repositories/ICommentRepository';

import { prisma } from '../db/prisma';

interface PrismaCommentRow {
  id: string;
  userId: string;
  recipeId: string;
  body: string;
  createdAt: Date;
}

function toDomain(row: PrismaCommentRow): Comment {
  return Comment.create({
    id: row.id,
    userId: row.userId,
    recipeId: row.recipeId,
    body: row.body,
    createdAt: row.createdAt,
  });
}

export class PrismaCommentRepository implements ICommentRepository {
  async add(comment: Comment): Promise<void> {
    await prisma.comment.create({
      data: {
        id: comment.id,
        userId: comment.userId,
        recipeId: comment.recipeId,
        body: comment.body,
        createdAt: comment.createdAt,
      },
    });
  }

  async findById(id: string): Promise<Comment | null> {
    const row = await prisma.comment.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByRecipeId(recipeId: string): Promise<Comment[]> {
    const rows = await prisma.comment.findMany({
      where: { recipeId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDomain);
  }

  async delete(id: string): Promise<void> {
    // deleteMany is idempotent — never throws when no rows match.
    await prisma.comment.deleteMany({ where: { id } });
  }
}
