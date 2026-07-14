/**
 * src/domain/repositories/ICommentRepository.ts
 *
 * Repository interface for the Comment entity.
 * Describes WHAT persistence operations exist — never HOW.
 *
 * Imports: domain only. Zero infrastructure dependencies.
 */

import type { Comment } from '../entities/Comment';

export interface ICommentRepository {
  /** Persist a new comment. */
  add(comment: Comment): Promise<void>;

  /** Find a comment by its id. Returns null when not found. */
  findById(id: string): Promise<Comment | null>;

  /**
   * Find every comment posted on a recipe.
   * MUST return results ordered by createdAt DESC (newest first).
   */
  findByRecipeId(recipeId: string): Promise<Comment[]>;

  /** Remove a comment by id. Idempotent: no-op when the id does not exist. */
  delete(id: string): Promise<void>;
}

/** Spec-aligned alias (the AC refers to it as "CommentRepository"). */
export type CommentRepository = ICommentRepository;
