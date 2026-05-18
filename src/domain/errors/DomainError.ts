/**
 * src/domain/errors/DomainError.ts
 *
 * Base class for all domain-layer errors.
 * Keeps error hierarchy inside the domain — infrastructure
 * and application layers catch these and re-throw or map them.
 *
 * Imports: domain only (none needed here).
 */

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
    // Maintains proper prototype chain in TypeScript targets < ES2022
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RecipeNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Recipe with id "${id}" was not found.`);
    this.name = 'RecipeNotFoundError';
  }
}

export class CommentNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Comment with id "${id}" was not found.`);
    this.name = 'CommentNotFoundError';
  }
}

export class UserNotFoundError extends DomainError {
  constructor(identifier: string) {
    super(`User "${identifier}" was not found.`);
    this.name = 'UserNotFoundError';
  }
}

export class UnauthorizedError extends DomainError {
  constructor(action = 'perform this action') {
    super(`You are not authorized to ${action}.`);
    this.name = 'UnauthorizedError';
  }
}

export class DuplicateResourceError extends DomainError {
  constructor(resource: string) {
    super(`A ${resource} with the same identifier already exists.`);
    this.name = 'DuplicateResourceError';
  }
}
