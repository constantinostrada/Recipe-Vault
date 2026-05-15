/**
 * scripts/assert-duplicate-recipe-endpoint.ts
 *
 * AC harness for POST /api/recipes/:id/duplicate.
 *
 * Uses an in-memory IRecipeRepository to wire a real DuplicateRecipeUseCase
 * + RecipeController and drives it with a duck-typed NextRequest. The
 * response is the real NextResponse from the controller, inspected via
 * `.status` and `await .json()`.
 *
 * Run all:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-duplicate-recipe-endpoint.ts
 * Run one:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-duplicate-recipe-endpoint.ts <test_name>
 */

import { register as registerTsConfigPaths } from 'tsconfig-paths';

registerTsConfigPaths({
  baseUrl: process.cwd(),
  paths: {
    '@/*': ['src/*'],
    '@/domain/*': ['src/domain/*'],
    '@/application/*': ['src/application/*'],
    '@/infrastructure/*': ['src/infrastructure/*'],
    '@/interfaces/*': ['src/interfaces/*'],
  },
});

import { Recipe } from '../src/domain/entities/Recipe';
import { RecipeIngredient } from '../src/domain/entities/RecipeIngredient';
import { RecipeStep } from '../src/domain/entities/RecipeStep';
import { DifficultyLevel } from '../src/domain/value-objects/DifficultyLevel';
import { Slug } from '../src/domain/value-objects/Slug';
import type {
  IRecipeRepository,
  PaginatedResult,
  PaginationOptions,
  RecipeFilters,
} from '../src/domain/repositories/IRecipeRepository';

import { DuplicateRecipeUseCase } from '../src/application/use-cases/recipe/DuplicateRecipeUseCase';
import { SearchRecipesUseCase } from '../src/application/use-cases/recipe/SearchRecipesUseCase';
import { GetRecipeBySlugUseCase } from '../src/application/use-cases/recipe/GetRecipeBySlugUseCase';

import { RecipeController } from '../src/interfaces/http/controllers/RecipeController';

import type { NextRequest } from 'next/server';

// ── In-memory repository ──────────────────────────────────────────────────

class InMemoryRecipeRepository implements IRecipeRepository {
  public saveCalls: Recipe[] = [];
  private readonly byId = new Map<string, Recipe>();
  private readonly bySlug = new Map<string, Recipe>();

  constructor(seed: Recipe[] = []) {
    for (const r of seed) {
      this.byId.set(r.id, r);
      this.bySlug.set(r.slug.value, r);
    }
  }

  async save(recipe: Recipe): Promise<void> {
    this.saveCalls.push(recipe);
    this.byId.set(recipe.id, recipe);
    this.bySlug.set(recipe.slug.value, recipe);
  }
  async update(recipe: Recipe): Promise<void> {
    this.byId.set(recipe.id, recipe);
    this.bySlug.set(recipe.slug.value, recipe);
  }
  async delete(id: string): Promise<void> {
    const r = this.byId.get(id);
    if (r) {
      this.byId.delete(id);
      this.bySlug.delete(r.slug.value);
    }
  }
  async findById(id: string): Promise<Recipe | null> {
    return this.byId.get(id) ?? null;
  }
  async findBySlug(slug: string): Promise<Recipe | null> {
    return this.bySlug.get(slug) ?? null;
  }
  async findMany(
    _filters: RecipeFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<Recipe>> {
    const data = Array.from(this.byId.values());
    return {
      data,
      total: data.length,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: 1,
    };
  }
  async exists(id: string): Promise<boolean> {
    return this.byId.has(id);
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────

function buildTortilla(): Recipe {
  return Recipe.create({
    id: 'r1',
    slug: Slug.create('tortilla-de-patatas'),
    name: 'Tortilla de patatas',
    description: 'Clásica española',
    cookTimeMinutes: 30,
    difficulty: DifficultyLevel.EASY,
    tags: ['vegetariano', 'español'],
    imageUrl: 'https://example.test/tortilla.jpg',
    ingredients: [
      RecipeIngredient.create({
        id: 'i1',
        recipeId: 'r1',
        name: 'Patata',
        quantity: 4,
        unit: 'unidad',
        order: 1,
      }),
      RecipeIngredient.create({
        id: 'i2',
        recipeId: 'r1',
        name: 'Huevo',
        quantity: 6,
        unit: 'unidad',
        order: 2,
      }),
      RecipeIngredient.create({
        id: 'i3',
        recipeId: 'r1',
        name: 'Aceite',
        quantity: 100,
        unit: 'ml',
        order: 3,
      }),
    ],
    steps: [
      RecipeStep.create({
        id: 's1',
        recipeId: 'r1',
        instruction: 'Pelar y cortar las patatas',
        order: 1,
      }),
      RecipeStep.create({
        id: 's2',
        recipeId: 'r1',
        instruction: 'Batir huevos y mezclar',
        order: 2,
      }),
      RecipeStep.create({
        id: 's3',
        recipeId: 'r1',
        instruction: 'Cuajar en sartén',
        order: 3,
      }),
    ],
  });
}

// ── Test plumbing ─────────────────────────────────────────────────────────

function makeReq(url: string): NextRequest {
  const u = new URL(url);
  return { nextUrl: u } as unknown as NextRequest;
}

function buildController(seed: Recipe[] = [buildTortilla()]): {
  controller: RecipeController;
  repo: InMemoryRecipeRepository;
} {
  const repo = new InMemoryRecipeRepository(seed);
  const controller = new RecipeController(
    new SearchRecipesUseCase(repo),
    new GetRecipeBySlugUseCase(repo),
    new DuplicateRecipeUseCase(repo),
  );
  return { controller, repo };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
}

function assertDeepEqual<T>(actual: T, expected: T, message: string): void {
  const a = canonicalize(actual);
  const e = canonicalize(expected);
  if (a !== e) {
    throw new Error(`Assertion failed (${message}):\n  actual:   ${a}\n  expected: ${e}`);
  }
}

interface DuplicateResponseBody {
  success: true;
  data: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    cookTimeMinutes: number;
    difficulty: string;
    tags: string[];
    imageUrl: string | null;
    ingredients: Array<{
      id: string;
      name: string;
      quantity: number;
      unit: string;
      order: number;
    }>;
    steps: Array<{ id: string; instruction: string; order: number }>;
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

/** AC1: POST /recipes/:id/duplicate returns 201 with the new recipe in the body. */
export async function test_ac1_duplicate_returns_201_with_new_recipe(): Promise<void> {
  const { controller } = buildController();
  const res = await controller.duplicate(
    makeReq('http://localhost/api/recipes/r1/duplicate'),
    { params: { slug: 'r1' } },
  );
  assert(res.status === 201, `expected 201, got ${res.status}`);
  const body = (await res.json()) as DuplicateResponseBody;
  assert(body.success === true, 'response success flag should be true');
  assert(typeof body.data === 'object' && body.data !== null, 'response data should be an object');
  assert(typeof body.data.id === 'string' && body.data.id.length > 0, 'response should include the new recipe id');
  assert(typeof body.data.name === 'string', 'response should include the recipe name');
  assert(Array.isArray(body.data.ingredients), 'response should include ingredients array');
  assert(Array.isArray(body.data.steps), 'response should include steps array');
}

/** AC2: The new recipe's title equals the original's title plus " (copy)". */
export async function test_ac2_title_is_suffixed_with_copy(): Promise<void> {
  const { controller } = buildController();
  const res = await controller.duplicate(
    makeReq('http://localhost/api/recipes/r1/duplicate'),
    { params: { slug: 'r1' } },
  );
  assert(res.status === 201, `expected 201, got ${res.status}`);
  const body = (await res.json()) as DuplicateResponseBody;
  assert(
    body.data.name === 'Tortilla de patatas (copy)',
    `expected name "Tortilla de patatas (copy)", got "${body.data.name}"`,
  );
}

/** AC3: The new recipe has its own unique id (different from the original). */
export async function test_ac3_new_recipe_has_unique_id(): Promise<void> {
  const { controller, repo } = buildController();
  const res = await controller.duplicate(
    makeReq('http://localhost/api/recipes/r1/duplicate'),
    { params: { slug: 'r1' } },
  );
  assert(res.status === 201, `expected 201, got ${res.status}`);
  const body = (await res.json()) as DuplicateResponseBody;
  assert(
    body.data.id !== 'r1',
    `new recipe id must differ from original (got "${body.data.id}")`,
  );
  assert(
    body.data.id.length > 0,
    'new recipe id must be a non-empty string',
  );
  // The new recipe was persisted under its own id (alongside the original).
  const original = await repo.findById('r1');
  const created = await repo.findById(body.data.id);
  assert(original !== null, 'original recipe must still exist after duplication');
  assert(created !== null, 'new recipe must be persisted under the new id');
  assert(repo.saveCalls.length === 1, 'save must be called exactly once for the new recipe');
  assert(
    repo.saveCalls[0].id === body.data.id,
    'persisted recipe id must match the response id',
  );

  // Slug must also be unique (Recipe.slug is unique in storage).
  assert(
    body.data.slug !== 'tortilla-de-patatas',
    `new slug must differ from original (got "${body.data.slug}")`,
  );

  // Calling duplicate again produces another distinct id and slug — no
  // accidental sharing of identity between consecutive duplications.
  const res2 = await controller.duplicate(
    makeReq('http://localhost/api/recipes/r1/duplicate'),
    { params: { slug: 'r1' } },
  );
  assert(res2.status === 201, `second duplicate expected 201, got ${res2.status}`);
  const body2 = (await res2.json()) as DuplicateResponseBody;
  assert(body2.data.id !== body.data.id, 'consecutive duplicates must yield different ids');
  assert(body2.data.slug !== body.data.slug, 'consecutive duplicates must yield different slugs');
}

/** AC4: The new recipe has identical ingredients and steps to the original. */
export async function test_ac4_ingredients_and_steps_match_original(): Promise<void> {
  const { controller } = buildController();
  const res = await controller.duplicate(
    makeReq('http://localhost/api/recipes/r1/duplicate'),
    { params: { slug: 'r1' } },
  );
  assert(res.status === 201, `expected 201, got ${res.status}`);
  const body = (await res.json()) as DuplicateResponseBody;

  // Ingredients: same content (name/quantity/unit/order) as the source.
  const expectedIngredients = [
    { name: 'Patata', quantity: 4, unit: 'unidad', order: 1 },
    { name: 'Huevo', quantity: 6, unit: 'unidad', order: 2 },
    { name: 'Aceite', quantity: 100, unit: 'ml', order: 3 },
  ];
  const actualIngredients = body.data.ingredients
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, order: i.order }));
  assertDeepEqual(
    actualIngredients,
    expectedIngredients,
    'ingredients of the duplicate must match the original (by content)',
  );

  // Steps: same instruction + order.
  const expectedSteps = [
    { instruction: 'Pelar y cortar las patatas', order: 1 },
    { instruction: 'Batir huevos y mezclar', order: 2 },
    { instruction: 'Cuajar en sartén', order: 3 },
  ];
  const actualSteps = body.data.steps
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ instruction: s.instruction, order: s.order }));
  assertDeepEqual(
    actualSteps,
    expectedSteps,
    'steps of the duplicate must match the original (by content)',
  );

  // Child ids must be NEW (each child belongs to the new aggregate).
  const sourceIngredientIds = new Set(['i1', 'i2', 'i3']);
  for (const ing of body.data.ingredients) {
    assert(
      !sourceIngredientIds.has(ing.id),
      `duplicate ingredient id "${ing.id}" must not collide with the source aggregate's child ids`,
    );
  }
  const sourceStepIds = new Set(['s1', 's2', 's3']);
  for (const step of body.data.steps) {
    assert(
      !sourceStepIds.has(step.id),
      `duplicate step id "${step.id}" must not collide with the source aggregate's child ids`,
    );
  }

  // Top-level fields the user expects to carry over unchanged.
  assert(body.data.description === 'Clásica española', 'description must carry over');
  assert(body.data.cookTimeMinutes === 30, 'cookTimeMinutes must carry over');
  assert(body.data.difficulty === 'easy', 'difficulty must carry over');
  assertDeepEqual(
    [...body.data.tags].sort(),
    ['español', 'vegetariano'],
    'tags must carry over',
  );
  assert(
    body.data.imageUrl === 'https://example.test/tortilla.jpg',
    'imageUrl must carry over',
  );
}

/** AC5: If the recipe id doesn't exist, the endpoint returns 404. */
export async function test_ac5_unknown_id_returns_404(): Promise<void> {
  const { controller, repo } = buildController();
  const res = await controller.duplicate(
    makeReq('http://localhost/api/recipes/does-not-exist/duplicate'),
    { params: { slug: 'does-not-exist' } },
  );
  assert(res.status === 404, `unknown id should return 404, got ${res.status}`);
  const body = (await res.json()) as { success: boolean; error: { code: string; message: string } };
  assert(body.success === false, 'unknown id response success must be false');
  assert(body.error.code === 'NOT_FOUND', `expected error.code NOT_FOUND, got ${body.error.code}`);
  assert(
    /not found/i.test(body.error.message),
    `expected "not found" in error message, got: ${body.error.message}`,
  );
  // No persistence should have happened on the not-found path.
  assert(repo.saveCalls.length === 0, 'save must NOT be called when the recipe is not found');
}

// ── Runner ───────────────────────────────────────────────────────────────

const ALL_TESTS: Record<string, () => Promise<void>> = {
  test_ac1_duplicate_returns_201_with_new_recipe,
  test_ac2_title_is_suffixed_with_copy,
  test_ac3_new_recipe_has_unique_id,
  test_ac4_ingredients_and_steps_match_original,
  test_ac5_unknown_id_returns_404,
};

async function main(): Promise<void> {
  const filter = process.argv[2];
  const names = filter ? [filter] : Object.keys(ALL_TESTS);
  let failures = 0;
  for (const name of names) {
    const fn = ALL_TESTS[name];
    if (!fn) {
      console.error(`Unknown test: ${name}`);
      failures += 1;
      continue;
    }
    try {
      await fn();
      console.log(`PASS  ${name}`);
    } catch (err) {
      failures += 1;
      console.error(`FAIL  ${name}`);
      console.error(err instanceof Error ? err.stack ?? err.message : err);
    }
  }
  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(failures);
  }
  console.log(`\nAll ${names.length} test(s) passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
