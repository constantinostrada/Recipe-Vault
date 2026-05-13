/**
 * src/application/dtos/UserDto.ts
 *
 * Data Transfer Objects for User use-case inputs and outputs.
 *
 * Imports: application only (no domain entities exposed outside use cases).
 */

// ── Output DTOs ─────────────────────────────────────────────────────────────

export interface UserDto {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  displayName: string;
  createdAt: string; // ISO 8601
}

// ── Input DTOs ──────────────────────────────────────────────────────────────

export interface GetUserInput {
  userId: string;
}

export interface UpdateUserProfileInput {
  userId: string;
  name?: string;
  image?: string | null;
}
