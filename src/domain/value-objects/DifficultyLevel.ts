/**
 * src/domain/value-objects/DifficultyLevel.ts
 *
 * Strongly-typed enumeration value object for recipe difficulty.
 * Using a class rather than a plain TypeScript enum keeps parsing
 * and validation logic inside the domain layer.
 *
 * Imports: domain only.
 */

import { DomainError } from '../errors/DomainError';

export type DifficultyLevelValue = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';

const VALID_LEVELS: ReadonlySet<string> = new Set<DifficultyLevelValue>([
  'EASY',
  'MEDIUM',
  'HARD',
  'EXPERT',
]);

export class DifficultyLevel {
  private readonly _value: DifficultyLevelValue;

  private constructor(value: DifficultyLevelValue) {
    this._value = value;
  }

  static create(raw: string): DifficultyLevel {
    const upper = raw.toUpperCase();
    if (!VALID_LEVELS.has(upper)) {
      throw new DomainError(
        `"${raw}" is not a valid difficulty. Must be one of: ${[...VALID_LEVELS].join(', ')}.`,
      );
    }
    return new DifficultyLevel(upper as DifficultyLevelValue);
  }

  static EASY = new DifficultyLevel('EASY');
  static MEDIUM = new DifficultyLevel('MEDIUM');
  static HARD = new DifficultyLevel('HARD');
  static EXPERT = new DifficultyLevel('EXPERT');

  get value(): DifficultyLevelValue {
    return this._value;
  }

  isEasierThan(other: DifficultyLevel): boolean {
    const order: DifficultyLevelValue[] = ['EASY', 'MEDIUM', 'HARD', 'EXPERT'];
    return order.indexOf(this._value) < order.indexOf(other._value);
  }

  equals(other: DifficultyLevel): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
