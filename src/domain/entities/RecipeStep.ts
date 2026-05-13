/**
 * src/domain/entities/RecipeStep.ts
 *
 * Child entity of the Recipe aggregate. Lives only inside a Recipe's lifecycle.
 *
 * Imports: domain only.
 */

import { DomainError } from '../errors/DomainError';

export interface RecipeStepProps {
  id: string;
  recipeId: string;
  instruction: string;
  order: number;
}

export class RecipeStep {
  readonly id: string;
  readonly recipeId: string;
  readonly instruction: string;
  readonly order: number;

  private constructor(props: RecipeStepProps) {
    this.id = props.id;
    this.recipeId = props.recipeId;
    this.instruction = props.instruction;
    this.order = props.order;
  }

  static create(props: RecipeStepProps): RecipeStep {
    if (typeof props.instruction !== 'string' || props.instruction.trim().length === 0) {
      throw new DomainError('RecipeStep.instruction must be a non-empty string.');
    }
    if (!Number.isInteger(props.order) || props.order < 1) {
      throw new DomainError(
        `RecipeStep.order must be a positive integer (>= 1), got ${props.order}.`,
      );
    }
    return new RecipeStep(props);
  }

  /** Returns a copy of this step with a new order. Used by the aggregate when reordering. */
  withOrder(newOrder: number): RecipeStep {
    return RecipeStep.create({
      id: this.id,
      recipeId: this.recipeId,
      instruction: this.instruction,
      order: newOrder,
    });
  }
}
