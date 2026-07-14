/**
 * scripts/assert-request-id-header.ts
 *
 * AC harness for task RveiSTUEW7OKxBHJtH5T:
 * every response from /api/recipes/* must include an `X-Request-Id`
 * header whose value is a UUID v4, and each request must produce a
 * fresh id.
 *
 * Run all:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-request-id-header.ts
 * Run one:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-request-id-header.ts <test_name>
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

import { SearchRecipesUseCase } from '../src/application/use-cases/recipe/SearchRecipesUseCase';
import { GetRecipeBySlugUseCase } from '../src/application/use-cases/recipe/GetRecipeBySlugUseCase';

import { RecipeController } from '../src/interfaces/http/controllers/RecipeController';
import { REQUEST_ID_HEADER } from '../src/interfaces/http/helpers/requestId';

// ── Mock repository (subset of the recipes-endpoint harness) ────────────────

class InMemoryRecipeRepository implements IRecipeRepository {
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
    _filters: RecipeFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<Recipe>> {
    const data = [...this.recipes];
    return {
      data,
      total: data.length,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: 1,
    };
  }
  async exists(id: string): Promise<boolean> {
    return this.recipes.some((r) => r.id === id);
  }
  async saveRating(): Promise<void> {}
  async getAverageRatingsByRecipeIds(
    recipeIds: string[],
  ): Promise<Map<string, number | null>> {
    const out = new Map<string, number | null>();
    for (const id of recipeIds) out.set(id, null);
    return out;
  }
}

function buildRecipe(): Recipe {
  return Recipe.create({
    id: 'r1',
    slug: Slug.create('tortilla'),
    name: 'Tortilla de patatas',
    description: 'Clásica española',
    cookTimeMinutes: 30,
    difficulty: DifficultyLevel.EASY,
    tags: ['vegetariano'],
    imageUrl: null,
    ingredients: [
      RecipeIngredient.create({
        id: 'i1',
        recipeId: 'r1',
        name: 'Patata',
        quantity: 4,
        unit: 'unidad',
        order: 1,
      }),
    ],
    steps: [
      RecipeStep.create({ id: 's1', recipeId: 'r1', instruction: 'Pelar patatas', order: 1 }),
    ],
  });
}

// ── Test helpers ─────────────────────────────────────────────────────────────

import type { NextRequest } from 'next/server';

function makeReq(url: string): NextRequest {
  const u = new URL(url);
  // Duck-type: the controller only touches `req.nextUrl.searchParams`.
  return { nextUrl: u, url } as unknown as NextRequest;
}

function buildController(): RecipeController {
  const repo = new InMemoryRecipeRepository([buildRecipe()]);
  return new RecipeController(new SearchRecipesUseCase(repo), new GetRecipeBySlugUseCase(repo));
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

// RFC 4122 / 9562 §4.4 UUID v4 — version nibble = 4, variant nibble ∈ {8,9,a,b}.
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuidV4(value: string | null, label: string): asserts value is string {
  assert(value !== null && value !== undefined, `${label}: header missing`);
  assert(
    typeof value === 'string' && UUID_V4_RE.test(value),
    `${label}: "${value}" is not a UUID v4 (expected pattern ${UUID_V4_RE})`,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** AC-1: GET /recipes response has X-Request-Id header with UUID v4 format. */
export async function test_ac1_get_recipes_has_uuid_v4_request_id(): Promise<void> {
  const controller = buildController();
  const res = await controller.list(makeReq('http://localhost/api/recipes'));
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assertUuidV4(res.headers.get(REQUEST_ID_HEADER), 'GET /recipes X-Request-Id');
}

/** AC-2: GET /recipes/:slug response has X-Request-Id header with UUID v4 format. */
export async function test_ac2_get_recipe_by_slug_has_uuid_v4_request_id(): Promise<void> {
  const controller = buildController();
  const res = await controller.getBySlug(makeReq('http://localhost/api/recipes/tortilla'), {
    params: { slug: 'tortilla' },
  });
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assertUuidV4(res.headers.get(REQUEST_ID_HEADER), 'GET /recipes/:slug X-Request-Id');

  // Error branches (404, 400) must also carry the header.
  const notFound = await controller.getBySlug(makeReq('http://localhost/api/recipes/missing'), {
    params: { slug: 'missing' },
  });
  assert(notFound.status === 404, `expected 404 for unknown slug, got ${notFound.status}`);
  assertUuidV4(
    notFound.headers.get(REQUEST_ID_HEADER),
    'GET /recipes/:slug X-Request-Id (404 branch)',
  );

  const badSlug = await controller.getBySlug(makeReq('http://localhost/api/recipes/'), {
    params: { slug: '' },
  });
  assert(badSlug.status === 400, `expected 400 for empty slug, got ${badSlug.status}`);
  assertUuidV4(
    badSlug.headers.get(REQUEST_ID_HEADER),
    'GET /recipes/:slug X-Request-Id (validation branch)',
  );
}

/** AC-3: POST /recipes response has X-Request-Id header with UUID v4 format. */
export async function test_ac3_post_recipes_has_uuid_v4_request_id(): Promise<void> {
  const controller = buildController();
  const res = await controller.create(makeReq('http://localhost/api/recipes'));
  // Stub returns 501 today; the header contract is what matters for AC3.
  assert(
    res.status === 501,
    `POST /recipes stub should respond 501 NOT_IMPLEMENTED, got ${res.status}`,
  );
  assertUuidV4(res.headers.get(REQUEST_ID_HEADER), 'POST /recipes X-Request-Id');
}

/** AC-4: Each request gets a unique UUID (verify via 2 sequential requests). */
export async function test_ac4_each_request_gets_unique_uuid(): Promise<void> {
  const controller = buildController();

  // Two sequential GET /recipes calls.
  const a = await controller.list(makeReq('http://localhost/api/recipes'));
  const b = await controller.list(makeReq('http://localhost/api/recipes'));
  const idA = a.headers.get(REQUEST_ID_HEADER);
  const idB = b.headers.get(REQUEST_ID_HEADER);
  assertUuidV4(idA, 'AC4 GET A');
  assertUuidV4(idB, 'AC4 GET B');
  assert(idA !== idB, `AC4: ids must differ across calls, both were ${idA}`);

  // Cross-endpoint uniqueness too, since the AC speaks of "each request".
  const c = await controller.getBySlug(makeReq('http://localhost/api/recipes/tortilla'), {
    params: { slug: 'tortilla' },
  });
  const d = await controller.create(makeReq('http://localhost/api/recipes'));
  const idC = c.headers.get(REQUEST_ID_HEADER);
  const idD = d.headers.get(REQUEST_ID_HEADER);
  assertUuidV4(idC, 'AC4 getBySlug');
  assertUuidV4(idD, 'AC4 POST');
  const all = new Set([idA, idB, idC, idD]);
  assert(all.size === 4, `AC4: 4 calls produced ${all.size} unique ids, expected 4`);
}

// ── Runner ───────────────────────────────────────────────────────────────────

const ALL_TESTS: Record<string, () => Promise<void>> = {
  test_ac1_get_recipes_has_uuid_v4_request_id,
  test_ac2_get_recipe_by_slug_has_uuid_v4_request_id,
  test_ac3_post_recipes_has_uuid_v4_request_id,
  test_ac4_each_request_gets_unique_uuid,
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
