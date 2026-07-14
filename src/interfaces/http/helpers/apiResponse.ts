/**
 * src/interfaces/http/helpers/apiResponse.ts
 *
 * Thin helpers for building consistent JSON responses in Next.js
 * App Router route handlers.
 *
 * These helpers decide HTTP status codes — that decision belongs here
 * in the interfaces layer, not in application or domain.
 *
 * Imports: application (for error types), interfaces.
 */

import { NextResponse } from 'next/server';

import {
  DomainError,
  RecipeNotFoundError,
  UserNotFoundError,
  UnauthorizedError,
} from '@/domain/errors/DomainError';

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
  };
}

export function successResponse<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function createdResponse<T>(data: T): NextResponse<ApiSuccessResponse<T>> {
  return successResponse(data, 201);
}

export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

/**
 * Maps domain/application errors to appropriate HTTP status codes.
 * All error-to-status mapping belongs in this layer.
 */
export function errorResponse(err: unknown): NextResponse<ApiErrorResponse> {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json(
      { success: false, error: { message: err.message, code: 'UNAUTHORIZED' } },
      { status: 401 },
    );
  }

  if (err instanceof RecipeNotFoundError || err instanceof UserNotFoundError) {
    return NextResponse.json(
      { success: false, error: { message: err.message, code: 'NOT_FOUND' } },
      { status: 404 },
    );
  }

  if (err instanceof DomainError) {
    return NextResponse.json(
      { success: false, error: { message: err.message, code: 'DOMAIN_ERROR' } },
      { status: 422 },
    );
  }

  // Unknown / unexpected errors
  console.error('[API] Unhandled error:', err);
  return NextResponse.json(
    { success: false, error: { message: 'An unexpected error occurred.', code: 'INTERNAL' } },
    { status: 500 },
  );
}
