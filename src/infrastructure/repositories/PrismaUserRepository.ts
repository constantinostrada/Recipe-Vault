/**
 * src/infrastructure/repositories/PrismaUserRepository.ts
 *
 * Concrete implementation of IUserRepository using Prisma + PostgreSQL.
 *
 * Maps Prisma user rows → User domain entities and vice versa.
 *
 * Imports: domain, application, and infrastructure (Prisma client).
 */

import { User } from '@/domain/entities/User';
import { DomainError, UserNotFoundError } from '@/domain/errors/DomainError';
import type { IUserRepository } from '@/domain/repositories/IUserRepository';

import { prisma } from '../db/prisma';

function toDomain(row: {
  id: string;
  name: string | null;
  email: string | null;
  passwordHash: string | null;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}): User {
  if (!row.email) {
    throw new DomainError(`User ${row.id} has no email address — data integrity issue.`);
  }

  return User.create({
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.passwordHash,
    image: row.image,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class PrismaUserRepository implements IUserRepository {
  async save(user: User): Promise<void> {
    try {
      await prisma.user.create({
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          passwordHash: user.passwordHash,
          image: user.image,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (err) {
      this.handlePrismaError(err, 'save user');
    }
  }

  async update(user: User): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          name: user.name,
          image: user.image,
          updatedAt: user.updatedAt,
        },
      });
    } catch (err) {
      this.handlePrismaError(err, 'update user');
    }
  }

  async findById(id: string): Promise<User | null> {
    const row = await prisma.user.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    return row ? toDomain(row) : null;
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { email: email.toLowerCase().trim() },
    });
    return count > 0;
  }

  private handlePrismaError(err: unknown, operation: string): never {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      const code = (err as { code: string }).code;
      if (code === 'P2025') throw new UserNotFoundError('unknown');
      if (code === 'P2002') throw new DomainError('A user with that email already exists.');
    }
    throw new DomainError(`Unexpected error during ${operation}.`);
  }
}
