import { DomainError } from '../errors/DomainError';

export type DifficultyLevelValue = 'easy' | 'medium' | 'hard';

const ORDER: readonly DifficultyLevelValue[] = ['easy', 'medium', 'hard'];
const VALID_LEVELS: ReadonlySet<DifficultyLevelValue> = new Set(ORDER);

function isDifficultyLevelValue(raw: string): raw is DifficultyLevelValue {
  return (VALID_LEVELS as ReadonlySet<string>).has(raw);
}

export class DifficultyLevel {
  private readonly _value: DifficultyLevelValue;

  private constructor(value: DifficultyLevelValue) {
    this._value = value;
  }

  static create(raw: string): DifficultyLevel {
    if (typeof raw !== 'string' || !isDifficultyLevelValue(raw)) {
      throw new DomainError(
        `"${raw}" is not a valid difficulty. Must be one of: ${ORDER.join(', ')}.`,
      );
    }
    return new DifficultyLevel(raw);
  }

  static readonly EASY = new DifficultyLevel('easy');
  static readonly MEDIUM = new DifficultyLevel('medium');
  static readonly HARD = new DifficultyLevel('hard');

  get value(): DifficultyLevelValue {
    return this._value;
  }

  equals(other: DifficultyLevel): boolean {
    return other instanceof DifficultyLevel && this._value === other._value;
  }

  isHarderThan(other: DifficultyLevel): boolean {
    return ORDER.indexOf(this._value) > ORDER.indexOf(other._value);
  }

  toString(): string {
    return this._value;
  }
}
