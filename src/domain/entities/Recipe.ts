/**
 * src/domain/entities/Recipe.ts
 *
 * The Recipe aggregate root.
 * Owns RecipeIngredient and RecipeStep as embedded children; outside callers
 * never instantiate or mutate them directly — every mutation goes through the
 * root and is constrained by aggregate invariants:
 *
 *   - cookTimeMinutes must be an integer >= 1
 *   - name must be a non-empty string
 *   - ingredient.order values must form a contiguous 1..N permutation
 *   - step.order values must form a contiguous 1..N permutation
 *
 * Imports: domain only — zero third-party dependencies.
 */

import { DomainError } from '../errors/DomainError';
import { DifficultyLevel } from '../value-objects/DifficultyLevel';
import { Slug } from '../value-objects/Slug';
import { RecipeIngredient } from './RecipeIngredient';
import { RecipeStep } from './RecipeStep';

export interface RecipeProps {
  id: string;
  slug: Slug;
  name: string;
  description: string | null;
  cookTimeMinutes: number;
  difficulty: DifficultyLevel;
  tags: string[];
  imageUrl: string | null;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
}

export interface AddIngredientInput {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface AddStepInput {
  id: string;
  instruction: string;
}

export class Recipe {
  private readonly _id: string;
  private _slug: Slug;
  private _name: string;
  private _description: string | null;
  private _cookTimeMinutes: number;
  private _difficulty: DifficultyLevel;
  private _tags: string[];
  private _imageUrl: string | null;
  private _ingredients: RecipeIngredient[];
  private _steps: RecipeStep[];

  private constructor(props: RecipeProps) {
    this._id = props.id;
    this._slug = props.slug;
    this._name = props.name;
    this._description = props.description;
    this._cookTimeMinutes = props.cookTimeMinutes;
    this._difficulty = props.difficulty;
    this._tags = [...props.tags];
    this._imageUrl = props.imageUrl;
    this._ingredients = [...props.ingredients].sort((a, b) => a.order - b.order);
    this._steps = [...props.steps].sort((a, b) => a.order - b.order);
  }

  // ── Factory ────────────────────────────────────────────────────────────────

  static create(props: RecipeProps): Recipe {
    Recipe.assertValidName(props.name);
    Recipe.assertValidCookTime(props.cookTimeMinutes);
    Recipe.assertContiguousOrder('ingredients', props.ingredients);
    Recipe.assertContiguousOrder('steps', props.steps);
    Recipe.assertChildrenBelongToRecipe(props.id, props.ingredients, props.steps);
    return new Recipe(props);
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  get id(): string {
    return this._id;
  }
  get slug(): Slug {
    return this._slug;
  }
  get name(): string {
    return this._name;
  }
  get description(): string | null {
    return this._description;
  }
  get cookTimeMinutes(): number {
    return this._cookTimeMinutes;
  }
  get difficulty(): DifficultyLevel {
    return this._difficulty;
  }
  get tags(): ReadonlyArray<string> {
    return this._tags;
  }
  get imageUrl(): string | null {
    return this._imageUrl;
  }
  get ingredients(): ReadonlyArray<RecipeIngredient> {
    return this._ingredients;
  }
  get steps(): ReadonlyArray<RecipeStep> {
    return this._steps;
  }

  // ── Recipe-level mutators ─────────────────────────────────────────────────

  rename(name: string): void {
    Recipe.assertValidName(name);
    this._name = name;
  }

  updateDescription(description: string | null): void {
    this._description = description;
  }

  updateCookTimeMinutes(value: number): void {
    Recipe.assertValidCookTime(value);
    this._cookTimeMinutes = value;
  }

  updateDifficulty(difficulty: DifficultyLevel): void {
    this._difficulty = difficulty;
  }

  updateTags(tags: string[]): void {
    this._tags = [...tags];
  }

  updateImageUrl(imageUrl: string | null): void {
    this._imageUrl = imageUrl;
  }

  // ── Ingredient operations ─────────────────────────────────────────────────

  /**
   * Appends a new ingredient at the next contiguous order slot.
   * Order is assigned by the aggregate (not by the caller) so contiguity holds.
   */
  addIngredient(input: AddIngredientInput): RecipeIngredient {
    const nextOrder = this._ingredients.length + 1;
    const ingredient = RecipeIngredient.create({
      id: input.id,
      recipeId: this._id,
      name: input.name,
      quantity: input.quantity,
      unit: input.unit,
      order: nextOrder,
    });
    this._ingredients = [...this._ingredients, ingredient];
    Recipe.assertContiguousOrder('ingredients', this._ingredients);
    return ingredient;
  }

  /**
   * Reorders ingredients to match the given id sequence (length == current count).
   * Assigns order = 1..N in that order. Throws if the id set doesn't match.
   */
  reorderIngredients(orderedIds: string[]): void {
    this._ingredients = Recipe.reorderChildren(
      'ingredients',
      this._ingredients,
      orderedIds,
      (child, newOrder) => child.withOrder(newOrder),
    );
    Recipe.assertContiguousOrder('ingredients', this._ingredients);
  }

  /** Removes the ingredient with the given id and renumbers the rest to 1..N. */
  removeIngredient(id: string): void {
    const idx = this._ingredients.findIndex((i) => i.id === id);
    if (idx === -1) {
      throw new DomainError(
        `Cannot remove ingredient: no ingredient with id "${id}" in this recipe.`,
      );
    }
    const filtered = this._ingredients.filter((i) => i.id !== id);
    this._ingredients = filtered.map((child, i) => child.withOrder(i + 1));
    Recipe.assertContiguousOrder('ingredients', this._ingredients);
  }

  // ── Step operations ───────────────────────────────────────────────────────

  /**
   * Appends a new step at the next contiguous order slot.
   * Order is assigned by the aggregate (not by the caller).
   */
  addStep(input: AddStepInput): RecipeStep {
    const nextOrder = this._steps.length + 1;
    const step = RecipeStep.create({
      id: input.id,
      recipeId: this._id,
      instruction: input.instruction,
      order: nextOrder,
    });
    this._steps = [...this._steps, step];
    Recipe.assertContiguousOrder('steps', this._steps);
    return step;
  }

  /**
   * Reorders steps to match the given id sequence (length == current count).
   * Assigns order = 1..N in that order. Throws if the id set doesn't match.
   */
  reorderSteps(orderedIds: string[]): void {
    this._steps = Recipe.reorderChildren(
      'steps',
      this._steps,
      orderedIds,
      (child, newOrder) => child.withOrder(newOrder),
    );
    Recipe.assertContiguousOrder('steps', this._steps);
  }

  /** Removes the step with the given id and renumbers the rest to 1..N. */
  removeStep(id: string): void {
    const idx = this._steps.findIndex((s) => s.id === id);
    if (idx === -1) {
      throw new DomainError(
        `Cannot remove step: no step with id "${id}" in this recipe.`,
      );
    }
    const filtered = this._steps.filter((s) => s.id !== id);
    this._steps = filtered.map((child, i) => child.withOrder(i + 1));
    Recipe.assertContiguousOrder('steps', this._steps);
  }

  // ── Invariant guards ──────────────────────────────────────────────────────

  private static assertValidName(name: string): void {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new DomainError('Recipe.name must be a non-empty string.');
    }
  }

  private static assertValidCookTime(value: number): void {
    if (!Number.isInteger(value) || value < 1) {
      throw new DomainError(
        `Recipe.cookTimeMinutes must be an integer >= 1, got ${value}.`,
      );
    }
  }

  private static assertContiguousOrder(
    label: 'ingredients' | 'steps',
    children: ReadonlyArray<{ readonly order: number; readonly id: string }>,
  ): void {
    if (children.length === 0) return;
    const orders = children.map((c) => c.order).sort((a, b) => a - b);
    for (let i = 0; i < orders.length; i += 1) {
      const expected = i + 1;
      if (orders[i] !== expected) {
        throw new DomainError(
          `Recipe ${label} order must be contiguous starting at 1 (1,2,3,…). ` +
            `Expected ${expected} at position ${i}, got ${orders[i]}. Full order set: [${orders.join(',')}].`,
        );
      }
    }
  }

  private static assertChildrenBelongToRecipe(
    recipeId: string,
    ingredients: ReadonlyArray<RecipeIngredient>,
    steps: ReadonlyArray<RecipeStep>,
  ): void {
    for (const i of ingredients) {
      if (i.recipeId !== recipeId) {
        throw new DomainError(
          `Ingredient "${i.id}" belongs to recipe "${i.recipeId}", not "${recipeId}".`,
        );
      }
    }
    for (const s of steps) {
      if (s.recipeId !== recipeId) {
        throw new DomainError(
          `Step "${s.id}" belongs to recipe "${s.recipeId}", not "${recipeId}".`,
        );
      }
    }
  }

  private static reorderChildren<C extends { readonly id: string }>(
    label: 'ingredients' | 'steps',
    current: ReadonlyArray<C>,
    orderedIds: string[],
    withOrder: (child: C, newOrder: number) => C,
  ): C[] {
    if (!Array.isArray(orderedIds)) {
      throw new DomainError(`Recipe.reorder${label}: orderedIds must be an array.`);
    }
    if (orderedIds.length !== current.length) {
      throw new DomainError(
        `Recipe.reorder${label}: expected ${current.length} ids, got ${orderedIds.length}.`,
      );
    }
    const knownIds = new Set(current.map((c) => c.id));
    const seen = new Set<string>();
    for (const id of orderedIds) {
      if (!knownIds.has(id)) {
        throw new DomainError(
          `Recipe.reorder${label}: id "${id}" does not belong to this recipe.`,
        );
      }
      if (seen.has(id)) {
        throw new DomainError(
          `Recipe.reorder${label}: id "${id}" appears more than once in orderedIds.`,
        );
      }
      seen.add(id);
    }
    const byId = new Map(current.map((c) => [c.id, c] as const));
    return orderedIds.map((id, i) => withOrder(byId.get(id)!, i + 1));
  }
}
