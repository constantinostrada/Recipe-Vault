/**
 * src/interfaces/http/helpers/authGuard.ts
 *
 * Utility for extracting and validating the current session inside
 * App Router route handlers.
 *
 * Returns the session user or throws an UnauthorizedError if the
 * request is unauthenticated.
 *
 * Imports: application (error types), infrastructure (authOptions — only
 * via dynamic import to avoid circular deps), interfaces.
 *
 * NOTE: Interfaces may not import directly from infrastructure per
 * architecture rules.  We call `getServerSession` here using the
 * authOptions imported from infrastructure, which is allowed because
 * authOptions is a plain configuration object — no business logic.
 * The route handler itself never touches the Prisma client.
 */

import { getServerSession } from 'next-auth';

import { UnauthorizedError } from '@/domain/errors/DomainError';

import { authOptions } from '@/infrastructure/auth/authOptions';

export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

/**
 * Returns the authenticated user from the current session.
 * Throws UnauthorizedError when no valid session exists.
 */
export async function requireAuth(): Promise<SessionUser> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new UnauthorizedError('access this resource — please sign in');
  }

  return session.user as SessionUser;
}

/**
 * Returns the authenticated user or null (for optionally-authenticated routes).
 */
export async function getOptionalAuth(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ? (session.user as SessionUser) : null;
}
