/**
 * src/app/api/users/me/route.ts
 *
 * PATCH /api/users/me → update the authenticated user's profile
 */

import type { NextRequest } from 'next/server';

import { UserController } from '@/interfaces/http/controllers/UserController';

export async function PATCH(req: NextRequest) {
  return UserController.updateProfile(req);
}
