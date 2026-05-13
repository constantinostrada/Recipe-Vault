/**
 * src/domain/entities/RecipeIngredient.ts
 *
 * Child entity of the Recipe aggregate. Lives only inside a Recipe's lifecycle;
 * persistence/identity is owned by the aggregate root.
 *
 * Imports: domain only.
 */

import { DomainError } from '../errors/DomainError';

export interface RecipeIngredientProps {
  id: string;
  recipeId: string;
  name: string;
  quantity: number;
  unit: string;
  order: number;
}

export class RecipeIngredient {
  readonly id: string;
  readonly recipeId: string;
  readonly name: string;
  readonly quantity: number;
  readonly unit: string;
  readonly order: number;

  private constructor(props: RecipeIngredientProps) {
    this.id = props.id;
    this.recipeId = props.recipeId;
    this.name = props.name;
    this.quantity = props.quantity;
    this.unit = props.unit;
    this.order = props.order;
  }

  static create(props: RecipeIngredientProps): RecipeIngredient {
    if (typeof props.name !== 'string' || props.name.trim().length === 0) {
      throw new DomainError('RecipeIngredient.name must be a non-empty string.');
    }
    if (typeof props.quantity !== 'number' || !Number.isFinite(props.quantity) || props.quantity <= 0) {
      throw new DomainError(
        `RecipeIngredient.quantity must be a positive number, got ${props.quantity}.`,
      );
    }
    if (typeof props.unit !== 'string' || props.unit.trim().length === 0) {
      throw new DomainError('RecipeIngredient.unit must be a non-empty string.');
    }
    if (!Number.isInteger(props.order) || props.order < 1) {
      throw new DomainError(
        `RecipeIngredient.order must be a positive integer (>= 1), got ${props.order}.`,
      );
    }
    return new RecipeIngredient(props);
  }

  /** Returns a copy of this ingredient with a new order. Used by the aggregate when reordering. */
  withOrder(newOrder: number): RecipeIngredient {
    return RecipeIngredient.create({
      id: this.id,
      recipeId: this.recipeId,
      name: this.name,
      quantity: this.quantity,
      unit: this.unit,
      order: newOrder,
    });
  }
}
