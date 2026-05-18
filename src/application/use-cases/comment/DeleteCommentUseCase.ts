/**
 * src/application/use-cases/comment/DeleteCommentUseCase.ts
 *
 * Deletes a comment. Only the original author may delete — any other
 * authenticated user gets UnauthorizedError (mapped to HTTP 403).
 *
 * Imports: domain + application only (no infrastructure).
 */

import {
  CommentNotFoundError,
  DomainError,
  UnauthorizedError,
} from '@/domain/errors/DomainError';
import type { ICommentRepository } from '@/domain/repositories/ICommentRepository';

import type { DeleteCommentInput } from '../../dtos/CommentDto';

export class DeleteCommentUseCase {
  constructor(private readonly commentRepository: ICommentRepository) {}

  async execute(input: DeleteCommentInput): Promise<void> {
    if (
      !input ||
      typeof input.commentId !== 'string' ||
      input.commentId.trim().length === 0
    ) {
      throw new DomainError('commentId must be a non-empty string.');
    }
    if (typeof input.userId !== 'string' || input.userId.trim().length === 0) {
      throw new DomainError('userId must be a non-empty string.');
    }

    const comment = await this.commentRepository.findById(input.commentId);
    if (!comment) {
      throw new CommentNotFoundError(input.commentId);
    }
    if (!comment.isAuthoredBy(input.userId)) {
      throw new UnauthorizedError('delete this comment');
    }

    await this.commentRepository.delete(comment.id);
  }
}
