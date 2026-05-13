/**
 * src/domain/value-objects/Email.ts
 *
 * Immutable value object that guarantees a string is a valid email address.
 * Equality is determined by value, not reference.
 *
 * Imports: domain only — zero third-party deps.
 */

import { DomainError } from '../errors/DomainError';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

export class Email {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value.toLowerCase().trim();
  }

  static create(raw: string): Email {
    const normalized = raw.toLowerCase().trim();
    if (!EMAIL_REGEX.test(normalized)) {
      throw new DomainError(`"${raw}" is not a valid email address.`);
    }
    return new Email(normalized);
  }

  get value(): string {
    return this._value;
  }

  /** Returns the local-part (everything before the @). */
  get localPart(): string {
    return this._value.split('@')[0];
  }

  /** Returns the domain part (everything after the @). */
  get domain(): string {
    return this._value.split('@')[1];
  }

  equals(other: Email): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
