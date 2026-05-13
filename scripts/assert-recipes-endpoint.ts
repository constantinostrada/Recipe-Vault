/**
 * scripts/assert-recipes-endpoint.ts
 *
 * AC harness for GET /api/recipes and GET /api/recipes/:slug.
 *
 * Uses an in-memory IRecipeRepository to wire real
 * SearchRecipesUseCase / GetRecipeBySlugUseCase instances, then drives
 * a freshly-constructed RecipeController with duck-typed NextRequest
 * objects. The response is the real NextResponse from the controller,
 * inspected via `.status` and `await .json()`.
 *
 * Run all:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-recipes-endpoint.ts
 * Run one:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-recipes-endpoint.ts <test_name>
 */

import { register as registerTsConfigPaths } from 'tsconfig-paths';
import * as path from 'path';
import Module from 'module';

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

// Stub authOptions so transitive imports don't drag in @auth/prisma-adapter
// (which lacks CJS "main" and breaks transpile-only ts-node).
const authOptionsPath = path.resolve(
  process.cwd(),
  'src/infrastructure/auth/authOptions.ts',
);
const stubModule = new Module(authOptionsPath, undefined);
stubModule.filename = authOptionsPath;
stubModule.loaded = true;
(stubModule as unknown as { exports: unknown }).exports = { authOptions: {} };
require.cache[authOptionsPath] = stubModule;

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

import { SearchRecipesUseCase } from '../src/application/use-cases/recipe/SearchRecipesUseCase';
import { GetRecipeBySlugUseCase } from '../src/application/use-cases/recipe/GetRecipeBySlugUseCase';
import { CreateRecipeUseCase } from '../src/application/use-cases/recipe/CreateRecipeUseCase';

import { RecipeController } from '../src/interfaces/http/controllers/RecipeController';

// ── Mock repository ──────────────────────────────────────────────────────────

interface FindManyCall {
  filters: RecipeFilters;
  pagination: PaginationOptions;
}

class InMemoryRecipeRepository implements IRecipeRepository {
  public findManyCalls: FindManyCall[] = [];
  constructor(private readonly recipes: Recipe[] = []) {}

  async save(): Promise<void> {}
  async update(): Promise<void> {}
  async delete(): Promise<void> {}

  async findById(id: string): Promise<Recipe | null> {
    return this.recipes.find((r) => r.id === id) ?? null;
  }
  async findBySlug(slug: string): Promise<Recipe | null> {
    return this.recipes.find((r) => r.slug.value === slug) ?? null;
  }
  async findMany(
    filters: RecipeFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<Recipe>> {
    this.findManyCalls.push({
      filters: JSON.parse(JSON.stringify(filters)) as RecipeFilters,
      pagination: { ...pagination },
    });

    let data = [...this.recipes];
    if (filters.searchTerm) {
      const needle = filters.searchTerm.toLowerCase();
      data = data.filter(
        (r) =>
          r.name.toLowerCase().includes(needle) ||
          (r.description ?? '').toLowerCase().includes(needle),
      );
    }
    if (filters.difficulty && filters.difficulty.length > 0) {
      data = data.filter((r) => filters.difficulty!.includes(r.difficulty.value));
    }
    if (typeof filters.maxCookTimeMinutes === 'number') {
      data = data.filter((r) => r.cookTimeMinutes <= filters.maxCookTimeMinutes!);
    }
    if (filters.tags && filters.tags.length > 0) {
      data = data.filter((r) => filters.tags!.every((t) => r.tags.includes(t)));
    }
    const total = data.length;
    const start = (pagination.page - 1) * pagination.pageSize;
    const paged = data.slice(start, start + pagination.pageSize);
    return {
      data: paged,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
    };
  }
  async exists(id: string): Promise<boolean> {
    return this.recipes.some((r) => r.id === id);
  }
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

function buildRecipe(opts: {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  cookTimeMinutes: number;
  difficulty: DifficultyLevel;
  tags?: string[];
  imageUrl?: string | null;
  ingredients?: Array<{ id: string; name: string; quantity: number; unit: string; order: number }>;
  steps?: Array<{ id: string; instruction: string; order: number }>;
}): Recipe {
  return Recipe.create({
    id: opts.id,
    slug: Slug.create(opts.slug),
    name: opts.name,
    description: opts.description ?? null,
    cookTimeMinutes: opts.cookTimeMinutes,
    difficulty: opts.difficulty,
    tags: opts.tags ?? [],
    imageUrl: opts.imageUrl ?? null,
    ingredients: (opts.ingredients ?? []).map((i) =>
      RecipeIngredient.create({ ...i, recipeId: opts.id }),
    ),
    steps: (opts.steps ?? []).map((s) => RecipeStep.create({ ...s, recipeId: opts.id })),
  });
}

const FIXTURES: Recipe[] = [
  buildRecipe({
    id: 'r1',
    slug: 'tortilla',
    name: 'Tortilla de patatas',
    description: 'Clásica española',
    cookTimeMinutes: 30,
    difficulty: DifficultyLevel.EASY,
    tags: ['vegetariano', 'español'],
    ingredients: [
      { id: 'i1', name: 'Patata', quantity: 4, unit: 'unidad', order: 1 },
      { id: 'i2', name: 'Huevo', quantity: 6, unit: 'unidad', order: 2 },
    ],
    steps: [
      { id: 's1', instruction: 'Pelar y cortar las patatas', order: 1 },
      { id: 's2', instruction: 'Batir huevos y mezclar', order: 2 },
      { id: 's3', instruction: 'Cuajar en sartén', order: 3 },
    ],
  }),
  buildRecipe({
    id: 'r2',
    slug: 'paella',
    name: 'Paella valenciana',
    description: 'Arroz con conejo y pollo',
    cookTimeMinutes: 60,
    difficulty: DifficultyLevel.HARD,
    tags: ['arroz', 'español'],
  }),
  buildRecipe({
    id: 'r3',
    slug: 'gazpacho',
    name: 'Gazpacho andaluz',
    description: 'Sopa fría',
    cookTimeMinutes: 15,
    difficulty: DifficultyLevel.EASY,
    tags: ['vegano', 'frío', 'sopa'],
  }),
  buildRecipe({
    id: 'r4',
    slug: 'cocido',
    name: 'Cocido madrileño',
    description: 'Garbanzos y carne',
    cookTimeMinutes: 120,
    difficulty: DifficultyLevel.MEDIUM,
    tags: ['carne', 'madrileño'],
  }),
];

// ── Test helpers ─────────────────────────────────────────────────────────────

import type { NextRequest } from 'next/server';

function makeReq(url: string): NextRequest {
  const u = new URL(url);
  // Duck-type: the controller only touches `req.nextUrl.searchParams`.
  return { nextUrl: u } as unknown as NextRequest;
}

function buildController(recipes: Recipe[] = FIXTURES): {
  controller: RecipeController;
  repo: InMemoryRecipeRepository;
} {
  const repo = new InMemoryRecipeRepository(recipes);
  const controller = new RecipeController(
    new SearchRecipesUseCase(repo),
    new GetRecipeBySlugUseCase(repo),
    new CreateRecipeUseCase(repo),
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

// ── Tests ────────────────────────────────────────────────────────────────────

/** AC-1: GET /recipes without params returns every recipe with 200. */
export async function test_ac1_get_recipes_no_params_returns_all_200(): Promise<void> {
  const { controller, repo } = buildController();
  const res = await controller.list(makeReq('http://localhost/api/recipes'));
  assert(res.status === 200, `expected 200, got ${res.status}`);
  const body = (await res.json()) as { success: boolean; data: unknown };
  assert(body.success === true, 'success flag should be true');
  assert(Array.isArray(body.data), 'data should be an array');
  assert(
    (body.data as unknown[]).length === FIXTURES.length,
    `expected ${FIXTURES.length} recipes, got ${(body.data as unknown[]).length}`,
  );
  // Repo was called once with empty filters (no leakage of "" / [] etc).
  assert(repo.findManyCalls.length === 1, 'findMany should be called exactly once');
  assertDeepEqual(repo.findManyCalls[0].filters, {}, 'filters must be empty when no params provided');
}

/** AC-2: invalid params (e.g. maxCookTime=-1) return 400 with a clear message. */
export async function test_ac2_invalid_params_return_400_with_clear_message(): Promise<void> {
  const cases: Array<{ url: string; matches: RegExp; label: string }> = [
    {
      url: 'http://localhost/api/recipes?maxCookTime=-1',
      matches: /maxCookTime/i,
      label: 'maxCookTime=-1',
    },
    {
      url: 'http://localhost/api/recipes?maxCookTime=0',
      matches: /maxCookTime/i,
      label: 'maxCookTime=0',
    },
    {
      url: 'http://localhost/api/recipes?maxCookTime=not-a-number',
      matches: /maxCookTime/i,
      label: 'maxCookTime non-numeric',
    },
    {
      url: 'http://localhost/api/recipes?difficulty=EXPERT',
      matches: /difficulty/i,
      label: 'invalid difficulty',
    },
    {
      url: 'http://localhost/api/recipes?pageSize=999',
      matches: /pageSize/i,
      label: 'pageSize over max',
    },
    {
      url: 'http://localhost/api/recipes?page=0',
      matches: /page/i,
      label: 'page=0',
    },
  ];

  for (const c of cases) {
    const { controller } = buildController();
    const res = await controller.list(makeReq(c.url));
    assert(res.status === 400, `${c.label}: expected 400, got ${res.status}`);
    const body = (await res.json()) as { success: boolean; error: { message: string; code: string } };
    assert(body.success === false, `${c.label}: success should be false`);
    assert(
      typeof body.error?.message === 'string' && body.error.message.length > 0,
      `${c.label}: error message should be a non-empty string`,
    );
    assert(
      c.matches.test(body.error.message),
      `${c.label}: error message "${body.error.message}" should mention the offending field (${c.matches})`,
    );
    assert(body.error.code === 'VALIDATION_ERROR', `${c.label}: error code should be VALIDATION_ERROR`);
  }
}

/** AC-3: difficulty and tags accept multiple values via repeated query string keys. */
export async function test_ac3_difficulty_and_tags_repeatable(): Promise<void> {
  // difficulty repeated
  {
    const { controller, repo } = buildController();
    const res = await controller.list(
      makeReq('http://localhost/api/recipes?difficulty=easy&difficulty=hard'),
    );
    assert(res.status === 200, `difficulty repeated: expected 200, got ${res.status}`);
    assertDeepEqual(
      repo.findManyCalls[0].filters.difficulty,
      ['easy', 'hard'],
      'difficulty repeated should be parsed as array',
    );
    const body = (await res.json()) as { data: Array<{ difficulty: string }> };
    // From fixtures: easy = r1, r3; hard = r2 → 3 results.
    assert(body.data.length === 3, `expected 3 recipes for easy+hard, got ${body.data.length}`);
    for (const item of body.data) {
      assert(
        item.difficulty === 'easy' || item.difficulty === 'hard',
        `unexpected difficulty in result: ${item.difficulty}`,
      );
    }
  }

  // tags repeated → AND semantics
  {
    const { controller, repo } = buildController();
    const res = await controller.list(
      makeReq('http://localhost/api/recipes?tags=español&tags=vegetariano'),
    );
    assert(res.status === 200, `tags repeated: expected 200, got ${res.status}`);
    assertDeepEqual(
      repo.findManyCalls[0].filters.tags,
      ['español', 'vegetariano'],
      'tags repeated should be parsed as array',
    );
    const body = (await res.json()) as { data: Array<{ slug: string }> };
    // Only r1 (tortilla) has BOTH tags.
    assert(body.data.length === 1, `expected 1 recipe with both tags, got ${body.data.length}`);
    assert(body.data[0].slug === 'tortilla', `expected slug=tortilla, got ${body.data[0].slug}`);
  }

  // Mixed: 2 difficulties + 1 tag together
  {
    const { controller, repo } = buildController();
    const res = await controller.list(
      makeReq(
        'http://localhost/api/recipes?difficulty=easy&difficulty=medium&tags=carne',
      ),
    );
    assert(res.status === 200, 'mixed multi-value should be 200');
    assertDeepEqual(
      repo.findManyCalls[0].filters.difficulty,
      ['easy', 'medium'],
      'difficulty array',
    );
    assertDeepEqual(repo.findManyCalls[0].filters.tags, ['carne'], 'tags array (1 element)');
  }
}

/** AC-4: response is an array of RecipeSummaryDTO — no internal aggregate fields. */
export async function test_ac4_response_is_array_of_summary_dto(): Promise<void> {
  const { controller } = buildController();
  const res = await controller.list(makeReq('http://localhost/api/recipes'));
  const body = (await res.json()) as { data: unknown };

  assert(Array.isArray(body.data), 'top-level data must be an array');
  const items = body.data as Array<Record<string, unknown>>;

  const ALLOWED_KEYS = new Set([
    'id',
    'slug',
    'name',
    'description',
    'cookTimeMinutes',
    'difficulty',
    'tags',
    'imageUrl',
  ]);
  const FORBIDDEN_INTERNAL_KEYS = [
    'ingredients',
    'steps',
    '_slug',
    '_difficulty',
    '_ingredients',
    '_steps',
    'authorId',
    'isPublic',
    'createdAt',
    'updatedAt',
  ];

  for (const item of items) {
    const keys = Object.keys(item);
    assertDeepEqual(
      [...keys].sort(),
      [...ALLOWED_KEYS].sort(),
      `summary item keys exactly match the catalog-card contract (got: [${keys.join(',')}])`,
    );
    for (const forbidden of FORBIDDEN_INTERNAL_KEYS) {
      assert(
        !(forbidden in item),
        `summary item must NOT expose internal aggregate field "${forbidden}"`,
      );
    }
    // Difficulty is the lowercase enum value, not a DifficultyLevel instance.
    assert(
      typeof item.difficulty === 'string',
      `difficulty must be a plain string, got ${typeof item.difficulty}`,
    );
    // Slug is the string value, not a Slug instance.
    assert(typeof item.slug === 'string', 'slug must be a plain string');
    // Tags is a plain array of strings.
    assert(Array.isArray(item.tags), 'tags must be an array');
    for (const t of item.tags as unknown[]) {
      assert(typeof t === 'string', 'each tag must be a string');
    }
  }
}

/** AC-5: GET /recipes/:slug returns the full detail (ingredients + steps). */
export async function test_ac5_get_recipe_by_slug_returns_detail(): Promise<void> {
  const { controller } = buildController();

  // Happy path: existing slug returns 200 with ingredients + steps.
  const res = await controller.getBySlug(makeReq('http://localhost/api/recipes/tortilla'), {
    params: { slug: 'tortilla' },
  });
  assert(res.status === 200, `expected 200, got ${res.status}`);
  const body = (await res.json()) as {
    success: boolean;
    data: {
      id: string;
      slug: string;
      name: string;
      description: string | null;
      cookTimeMinutes: number;
      difficulty: string;
      tags: string[];
      imageUrl: string | null;
      ingredients: Array<{ id: string; name: string; quantity: number; unit: string; order: number }>;
      steps: Array<{ id: string; instruction: string; order: number }>;
    };
  };
  assert(body.success === true, 'success should be true');
  assert(body.data.slug === 'tortilla', 'slug field should match');
  assert(body.data.name === 'Tortilla de patatas', 'name field should match');
  assert(body.data.difficulty === 'easy', 'difficulty should be lowercase enum value');
  assert(Array.isArray(body.data.ingredients), 'ingredients must be an array');
  assert(body.data.ingredients.length === 2, `expected 2 ingredients, got ${body.data.ingredients.length}`);
  assertDeepEqual(
    body.data.ingredients.map((i) => i.name),
    ['Patata', 'Huevo'],
    'ingredient names + ordering',
  );
  assert(Array.isArray(body.data.steps), 'steps must be an array');
  assert(body.data.steps.length === 3, `expected 3 steps, got ${body.data.steps.length}`);
  assertDeepEqual(
    body.data.steps.map((s) => s.order),
    [1, 2, 3],
    'step ordering must be contiguous 1..N',
  );

  // Unknown slug → 404 NOT_FOUND
  const missing = await controller.getBySlug(
    makeReq('http://localhost/api/recipes/no-such-slug'),
    { params: { slug: 'no-such-slug' } },
  );
  assert(missing.status === 404, `unknown slug should return 404, got ${missing.status}`);
  const missingBody = (await missing.json()) as { success: boolean; error: { code: string } };
  assert(missingBody.success === false, 'unknown slug success should be false');
  assert(missingBody.error.code === 'NOT_FOUND', 'unknown slug error code should be NOT_FOUND');

  // Empty slug → 400 VALIDATION_ERROR
  const empty = await controller.getBySlug(makeReq('http://localhost/api/recipes/'), {
    params: { slug: '' },
  });
  assert(empty.status === 400, `empty slug should return 400, got ${empty.status}`);
}

// ── Runner ───────────────────────────────────────────────────────────────────

const ALL_TESTS: Record<string, () => Promise<void>> = {
  test_ac1_get_recipes_no_params_returns_all_200,
  test_ac2_invalid_params_return_400_with_clear_message,
  test_ac3_difficulty_and_tags_repeatable,
  test_ac4_response_is_array_of_summary_dto,
  test_ac5_get_recipe_by_slug_returns_detail,
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
