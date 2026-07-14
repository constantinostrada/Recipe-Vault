/**
 * src/interfaces/http/helpers/requestId.ts
 *
 * Generates a per-request UUID v4 and stamps it onto outgoing
 * NextResponse instances as the `X-Request-Id` header. Used by the
 * shared apiResponse helpers and the recipes route handlers so every
 * response from /api/recipes/* carries a correlation id clients and
 * logs can match against.
 *
 * Pure interfaces-layer concern — no business logic, no infra access.
 */

import { randomUUID } from 'node:crypto';
import type { NextResponse } from 'next/server';

export const REQUEST_ID_HEADER = 'X-Request-Id';

/** Generate a fresh UUID v4. */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Attach a freshly-generated UUID v4 as `X-Request-Id` on the given
 * response and return the same response. Idempotent — if a request-id
 * is already set (e.g. forwarded from an upstream middleware) it is
 * left untouched.
 */
export function withRequestId<R extends NextResponse>(response: R): R {
  if (!response.headers.has(REQUEST_ID_HEADER)) {
    response.headers.set(REQUEST_ID_HEADER, generateRequestId());
  }
  return response;
}
