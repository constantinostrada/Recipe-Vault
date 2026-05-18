/**
 * src/application/use-cases/comment/ListRecipeCommentsUseCase.ts
 *
 * Lists every comment on a recipe (resolved by slug) ordered by
 * createdAt DESC. Public — no authentication required.
 *
 * Imports: domain + application only (no infrastructure).
 */

import { DomainError, RecipeNotFoundError } from '@/domain/errors/DomainError';
import type { ICommentRepository } from '@/domain/repositories/ICommentRepository';
import type { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';

import type { CommentDto, ListRecipeCommentsInput } from '../../dtos/CommentDto';

export class ListRecipeCommentsUseCase {
  constructor(
    private readonly commentRepository: ICommentRepository,
    private readonly recipeRepository: IRecipeRepository,
  ) {}

  async execute(input: ListRecipeCommentsInput): Promise<CommentDto[]> {
    if (!input || typeof input.slug !== 'string' || input.slug.trim().length === 0) {
      throw new DomainError('slug must be a non-empty string.');
    }

    const recipe = await this.recipeRepository.findBySlug(input.slug);
    if (!recipe) {
      throw new RecipeNotFoundError(input.slug);
    }

    const comments = await this.commentRepository.findByRecipeId(recipe.id);

    return comments.map((c) => ({
      id: c.id,
      userId: c.userId,
      recipeId: c.recipeId,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
    }));
  }
}
