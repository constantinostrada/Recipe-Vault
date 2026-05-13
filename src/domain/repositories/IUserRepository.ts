/**
 * src/domain/repositories/IUserRepository.ts
 *
 * Repository interface for the User entity.
 * Defines persistence contracts only — no implementation details.
 *
 * Imports: domain only.
 */

import type { User } from '../entities/User';

export interface IUserRepository {
  /** Persist a new user. */
  save(user: User): Promise<void>;

  /** Persist changes to an existing user. */
  update(user: User): Promise<void>;

  /** Find a user by their internal id. Returns null when not found. */
  findById(id: string): Promise<User | null>;

  /** Find a user by email address. Returns null when not found. */
  findByEmail(email: string): Promise<User | null>;

  /** Check whether a user with the given email already exists. */
  existsByEmail(email: string): Promise<boolean>;
}
