/**
 * src/domain/entities/RecipeStep.ts
 *
 * A single numbered instruction step belonging to a Recipe.
 *
 * Imports: domain only.
 */

import { DomainError } from '../errors/DomainError';

export interface RecipeStepProps {
  id: string;
  recipeId: string;
  stepNumber: number;
  instruction: string;
  durationMin: number | null;
}

export class RecipeStep {
  readonly id: string;
  readonly recipeId: string;
  readonly stepNumber: number;
  private _instruction: string;
  private _durationMin: number | null;

  constructor(props: RecipeStepProps) {
    if (!Number.isInteger(props.stepNumber) || props.stepNumber < 1) {
      throw new DomainError('Step number must be a positive integer.');
    }
    if (props.instruction.trim().length < 5) {
      throw new DomainError('Step instruction must be at least 5 characters.');
    }
    if (props.durationMin !== null && props.durationMin < 0) {
      throw new DomainError('Step duration must be non-negative.');
    }

    this.id = props.id;
    this.recipeId = props.recipeId;
    this.stepNumber = props.stepNumber;
    this._instruction = props.instruction;
    this._durationMin = props.durationMin;
  }

  get instruction(): string {
    return this._instruction;
  }

  get durationMin(): number | null {
    return this._durationMin;
  }
}
