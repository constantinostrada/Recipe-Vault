/**
 * src/application/use-cases/comment/AddCommentUseCase.ts
 *
 * Resolves the recipe by slug, validates the body via Comment.create,
 * persists the new comment, and returns its DTO.
 *
 * Imports: domain + application only (no infrastructure).
 */

import { randomUUID } from 'crypto';

import { Comment } from '@/domain/entities/Comment';
import { DomainError, RecipeNotFoundError } from '@/domain/errors/DomainError';
import type { ICommentRepository } from '@/domain/repositories/ICommentRepository';
import type { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';

import type { AddCommentInput, CommentDto } from '../../dtos/CommentDto';

export class AddCommentUseCase {
  constructor(
    private readonly commentRepository: ICommentRepository,
    private readonly recipeRepository: IRecipeRepository,
  ) {}

  async execute(input: AddCommentInput): Promise<CommentDto> {
    if (!input || typeof input.slug !== 'string' || input.slug.trim().length === 0) {
      throw new DomainError('slug must be a non-empty string.');
    }
    if (typeof input.userId !== 'string' || input.userId.trim().length === 0) {
      throw new DomainError('userId must be a non-empty string.');
    }

    const recipe = await this.recipeRepository.findBySlug(input.slug);
    if (!recipe) {
      throw new RecipeNotFoundError(input.slug);
    }

    const comment = Comment.create({
      id: randomUUID(),
      userId: input.userId,
      recipeId: recipe.id,
      body: input.body,
      createdAt: new Date(),
    });

    await this.commentRepository.add(comment);

    return {
      id: comment.id,
      userId: comment.userId,
      recipeId: comment.recipeId,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
    };
  }
}
