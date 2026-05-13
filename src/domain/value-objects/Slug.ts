/**
 * src/domain/value-objects/Slug.ts
 *
 * Immutable value object for URL-safe slugs.
 * A slug is lowercase, alphanumeric, with hyphens as separators.
 *
 * Imports: domain only.
 */

import { DomainError } from '../errors/DomainError';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class Slug {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  /** Validates and wraps an existing slug string. */
  static create(raw: string): Slug {
    if (!SLUG_REGEX.test(raw)) {
      throw new DomainError(
        `"${raw}" is not a valid slug. Use only lowercase letters, numbers, and hyphens.`,
      );
    }
    return new Slug(raw);
  }

  /** Generates a slug from a human-readable string (e.g. a recipe title). */
  static fromTitle(title: string): Slug {
    const slug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!SLUG_REGEX.test(slug)) {
      throw new DomainError(`Could not generate a valid slug from title: "${title}".`);
    }
    return new Slug(slug);
  }

  get value(): string {
    return this._value;
  }

  equals(other: Slug): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
