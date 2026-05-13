/**
 * src/interfaces/http/controllers/UserController.ts
 *
 * Thin controller for User HTTP operations.
 *
 * Imports: application (via container), interfaces helpers.
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { container } from '@/infrastructure/container';

import { errorResponse, successResponse } from '../helpers/apiResponse';
import { requireAuth } from '../helpers/authGuard';

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  image: z.string().url().nullable().optional(),
});

export class UserController {
  /**
   * GET /api/users/:id
   * Get a user's public profile.
   */
  static async getProfile(
    _req: NextRequest,
    { params }: { params: { id: string } },
  ) {
    try {
      const result = await container.getUserProfileUseCase.execute({
        userId: params.id,
      });

      return successResponse(result);
    } catch (err) {
      return errorResponse(err);
    }
  }

  /**
   * PATCH /api/users/me
   * Update the authenticated user's profile.
   */
  static async updateProfile(req: NextRequest) {
    try {
      const currentUser = await requireAuth();
      const body = await req.json();
      const validated = updateProfileSchema.parse(body);

      const result = await container.updateUserProfileUseCase.execute({
        userId: currentUser.id,
        ...validated,
      });

      return successResponse(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return errorResponse(
          Object.assign(new Error(err.errors.map((e) => e.message).join(', ')), {
            name: 'ValidationError',
          }),
        );
      }
      return errorResponse(err);
    }
  }
}
