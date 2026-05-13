/**
 * src/domain/entities/RecipeIngredient.ts
 *
 * A line item in a recipe's ingredient list.
 * Identity comes from the combination of recipeId + ingredientId.
 *
 * Imports: domain only.
 */

import { DomainError } from '../errors/DomainError';

export interface RecipeIngredientProps {
  id: string;
  recipeId: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  notes: string | null;
}

export class RecipeIngredient {
  readonly id: string;
  readonly recipeId: string;
  readonly ingredientId: string;
  readonly ingredientName: string;
  private _quantity: number;
  private _unit: string;
  private _notes: string | null;

  constructor(props: RecipeIngredientProps) {
    if (props.quantity <= 0) {
      throw new DomainError('Ingredient quantity must be greater than zero.');
    }
    if (props.unit.trim().length === 0) {
      throw new DomainError('Ingredient unit must not be empty.');
    }

    this.id = props.id;
    this.recipeId = props.recipeId;
    this.ingredientId = props.ingredientId;
    this.ingredientName = props.ingredientName;
    this._quantity = props.quantity;
    this._unit = props.unit;
    this._notes = props.notes;
  }

  get quantity(): number {
    return this._quantity;
  }

  get unit(): string {
    return this._unit;
  }

  get notes(): string | null {
    return this._notes;
  }

  /** Scale the quantity (e.g. when adjusting serving size). */
  scale(factor: number): RecipeIngredient {
    if (factor <= 0) {
      throw new DomainError('Scale factor must be greater than zero.');
    }
    return new RecipeIngredient({
      id: this.id,
      recipeId: this.recipeId,
      ingredientId: this.ingredientId,
      ingredientName: this.ingredientName,
      quantity: this._quantity * factor,
      unit: this._unit,
      notes: this._notes,
    });
  }
}
