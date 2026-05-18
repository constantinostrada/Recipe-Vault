/**
 * src/application/dtos/CommentDto.ts
 *
 * Input / output DTOs for the comment use cases. DTOs cross the
 * application boundary as plain serialisable objects — never expose
 * domain entities directly to interfaces.
 */

export interface CommentDto {
  id: string;
  userId: string;
  recipeId: string;
  body: string;
  createdAt: string;
}

export interface AddCommentInput {
  /** Recipe slug from the URL path. */
  slug: string;
  /** Authenticated user id. */
  userId: string;
  /** Raw comment body (will be trimmed and validated). */
  body: string;
}

export interface DeleteCommentInput {
  /** Comment id from the URL path. */
  commentId: string;
  /** Authenticated user id attempting the delete. */
  userId: string;
}

export interface ListRecipeCommentsInput {
  /** Recipe slug from the URL path. */
  slug: string;
}
