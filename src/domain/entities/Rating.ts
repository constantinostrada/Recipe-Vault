/**
 * src/domain/entities/Rating.ts
 *
 * A single user-submitted rating for a recipe. Multiple Ratings can exist
 * per recipe; the recipe's average is derived from the collection (not
 * stored on Rating itself).
 *
 * Invariants:
 *   - value must be an integer in 1..5 (inclusive)
 *
 * Imports: domain only.
 */

import { DomainError } from '../errors/DomainError';

export interface RatingProps {
  id: string;
  recipeId: string;
  value: number;
  createdAt: Date;
}

export class Rating {
  private readonly _id: string;
  private readonly _recipeId: string;
  private readonly _value: number;
  private readonly _createdAt: Date;

  private constructor(props: RatingProps) {
    this._id = props.id;
    this._recipeId = props.recipeId;
    this._value = props.value;
    this._createdAt = props.createdAt;
  }

  static create(props: RatingProps): Rating {
    Rating.assertValidValue(props.value);
    return new Rating(props);
  }

  get id(): string {
    return this._id;
  }
  get recipeId(): string {
    return this._recipeId;
  }
  get value(): number {
    return this._value;
  }
  get createdAt(): Date {
    return this._createdAt;
  }

  private static assertValidValue(value: unknown): void {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new DomainError('Rating.value must be a finite number.');
    }
    if (!Number.isInteger(value)) {
      throw new DomainError('Rating.value must be an integer.');
    }
    if (value < 1 || value > 5) {
      throw new DomainError('Rating.value must be between 1 and 5.');
    }
  }
}
