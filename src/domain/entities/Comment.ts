/**
 * src/domain/entities/Comment.ts
 *
 * Comment domain entity. Authored by a User on a Recipe.
 * Invariants (enforced by the factory):
 *   - body is a non-empty string after trimming
 *   - body length is between 1 and 500 characters (after trimming)
 *
 * Imports: domain only — zero third-party dependencies.
 */

import { DomainError } from '../errors/DomainError';

export interface CommentProps {
  id: string;
  userId: string;
  recipeId: string;
  body: string;
  createdAt: Date;
}

export const COMMENT_BODY_MIN = 1;
export const COMMENT_BODY_MAX = 500;

export class Comment {
  private readonly _id: string;
  private readonly _userId: string;
  private readonly _recipeId: string;
  private readonly _body: string;
  private readonly _createdAt: Date;

  private constructor(props: CommentProps) {
    this._id = props.id;
    this._userId = props.userId;
    this._recipeId = props.recipeId;
    this._body = props.body;
    this._createdAt = props.createdAt;
  }

  static create(props: CommentProps): Comment {
    if (typeof props.id !== 'string' || props.id.trim().length === 0) {
      throw new DomainError('Comment id must be a non-empty string.');
    }
    if (typeof props.userId !== 'string' || props.userId.trim().length === 0) {
      throw new DomainError('Comment userId must be a non-empty string.');
    }
    if (typeof props.recipeId !== 'string' || props.recipeId.trim().length === 0) {
      throw new DomainError('Comment recipeId must be a non-empty string.');
    }
    if (typeof props.body !== 'string') {
      throw new DomainError('Comment body must be a string.');
    }
    const trimmed = props.body.trim();
    if (trimmed.length < COMMENT_BODY_MIN) {
      throw new DomainError('Comment body must not be empty.');
    }
    if (trimmed.length > COMMENT_BODY_MAX) {
      throw new DomainError(
        `Comment body must be at most ${COMMENT_BODY_MAX} characters (got ${trimmed.length}).`,
      );
    }
    if (!(props.createdAt instanceof Date) || Number.isNaN(props.createdAt.getTime())) {
      throw new DomainError('Comment createdAt must be a valid Date.');
    }
    return new Comment({ ...props, body: trimmed });
  }

  get id(): string {
    return this._id;
  }
  get userId(): string {
    return this._userId;
  }
  get recipeId(): string {
    return this._recipeId;
  }
  get body(): string {
    return this._body;
  }
  get createdAt(): Date {
    return this._createdAt;
  }

  isAuthoredBy(userId: string): boolean {
    return this._userId === userId;
  }
}
