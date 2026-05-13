/**
 * src/infrastructure/db/prisma.ts
 *
 * Singleton Prisma client for the application.
 *
 * In development, Next.js hot reload would create multiple client instances
 * without this pattern.  The global singleton ensures only one connection
 * pool is maintained.
 *
 * process.env is intentionally accessed here — this is infrastructure.
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
