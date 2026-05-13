/**
 * src/domain/entities/Recipe.ts
 *
 * The Recipe aggregate root.
 * Owns and enforces all invariants related to a recipe.
 *
 * Rules (enforced in constructor / mutators):
 *  - title must be 3–120 characters
 *  - servings must be >= 1
 *  - prepTimeMin and cookTimeMin must be >= 0
 *  - at least one step is required before a recipe can be "published"
 *
 * Imports: domain only — zero third-party dependencies.
 */

import type { DifficultyLevel } from '../value-objects/DifficultyLevel';
import type { RecipeIngredient } from './RecipeIngredient';
import type { RecipeStep } from './RecipeStep';
import { DomainError } from '../errors/DomainError';

export interface RecipeProps {
  id: string;
  title: string;
  description: string | null;
  servings: number;
  prepTimeMin: number;
  cookTimeMin: number;
  difficulty: DifficultyLevel;
  isPublic: boolean;
  authorId: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class Recipe {
  private readonly _id: string;
  private _title: string;
  private _description: string | null;
  private _servings: number;
  private _prepTimeMin: number;
  private _cookTimeMin: number;
  private _difficulty: DifficultyLevel;
  private _isPublic: boolean;
  private readonly _authorId: string;
  private _ingredients: RecipeIngredient[];
  private _steps: RecipeStep[];
  private _tags: string[];
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: RecipeProps) {
    Recipe.assertValidTitle(props.title);
    Recipe.assertPositiveServings(props.servings);
    Recipe.assertNonNegativeDuration('prepTimeMin', props.prepTimeMin);
    Recipe.assertNonNegativeDuration('cookTimeMin', props.cookTimeMin);

    this._id = props.id;
    this._title = props.title;
    this._description = props.description;
    this._servings = props.servings;
    this._prepTimeMin = props.prepTimeMin;
    this._cookTimeMin = props.cookTimeMin;
    this._difficulty = props.difficulty;
    this._isPublic = props.isPublic;
    this._authorId = props.authorId;
    this._ingredients = [...props.ingredients];
    this._steps = [...props.steps];
    this._tags = [...props.tags];
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  // ── Factory ──────────────────────────────────────────────────────────────

  static create(props: RecipeProps): Recipe {
    return new Recipe(props);
  }

  // ── Getters ──────────────────────────────────────────────────────────────

  get id(): string {
    return this._id;
  }

  get title(): string {
    return this._title;
  }

  get description(): string | null {
    return this._description;
  }

  get servings(): number {
    return this._servings;
  }

  get prepTimeMin(): number {
    return this._prepTimeMin;
  }

  get cookTimeMin(): number {
    return this._cookTimeMin;
  }

  get totalTimeMin(): number {
    return this._prepTimeMin + this._cookTimeMin;
  }

  get difficulty(): DifficultyLevel {
    return this._difficulty;
  }

  get isPublic(): boolean {
    return this._isPublic;
  }

  get authorId(): string {
    return this._authorId;
  }

  get ingredients(): ReadonlyArray<RecipeIngredient> {
    return this._ingredients;
  }

  get steps(): ReadonlyArray<RecipeStep> {
    return this._steps;
  }

  get tags(): ReadonlyArray<string> {
    return this._tags;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // ── Domain Mutators ──────────────────────────────────────────────────────

  updateTitle(title: string): void {
    Recipe.assertValidTitle(title);
    this._title = title;
    this.touch();
  }

  updateDescription(description: string | null): void {
    this._description = description;
    this.touch();
  }

  updateServings(servings: number): void {
    Recipe.assertPositiveServings(servings);
    this._servings = servings;
    this.touch();
  }

  updateTimes(prepTimeMin: number, cookTimeMin: number): void {
    Recipe.assertNonNegativeDuration('prepTimeMin', prepTimeMin);
    Recipe.assertNonNegativeDuration('cookTimeMin', cookTimeMin);
    this._prepTimeMin = prepTimeMin;
    this._cookTimeMin = cookTimeMin;
    this.touch();
  }

  updateDifficulty(difficulty: DifficultyLevel): void {
    this._difficulty = difficulty;
    this.touch();
  }

  /**
   * Publish the recipe so other users can discover it.
   * At least one step must exist before publishing.
   */
  publish(): void {
    if (this._steps.length === 0) {
      throw new DomainError(
        'A recipe must have at least one step before it can be published.',
      );
    }
    this._isPublic = true;
    this.touch();
  }

  unpublish(): void {
    this._isPublic = false;
    this.touch();
  }

  isOwnedBy(userId: string): boolean {
    return this._authorId === userId;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private touch(): void {
    this._updatedAt = new Date();
  }

  private static assertValidTitle(title: string): void {
    if (title.trim().length < 3 || title.trim().length > 120) {
      throw new DomainError('Recipe title must be between 3 and 120 characters.');
    }
  }

  private static assertPositiveServings(servings: number): void {
    if (!Number.isInteger(servings) || servings < 1) {
      throw new DomainError('Servings must be a positive integer.');
    }
  }

  private static assertNonNegativeDuration(field: string, value: number): void {
    if (!Number.isInteger(value) || value < 0) {
      throw new DomainError(`${field} must be a non-negative integer.`);
    }
  }
}
