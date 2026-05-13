/**
 * src/app/api/users/[id]/route.ts
 *
 * GET /api/users/:id → get a user's public profile
 */

import type { NextRequest } from 'next/server';

import { UserController } from '@/interfaces/http/controllers/UserController';

export async function GET(
  req: NextRequest,
  context: { params: { id: string } },
) {
  return UserController.getProfile(req, context);
}
