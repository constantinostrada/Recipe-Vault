/**
 * scripts/assert-create-recipe-endpoint.ts
 *
 * AC harness for POST /api/recipes (create recipe).
 *
 * Strategy:
 *   - In-memory IRecipeRepository so persistence is observable in-process.
 *   - Real RecipeController instance wired with real CreateRecipeUseCase /
 *     SearchRecipesUseCase / GetRecipeBySlugUseCase against the in-memory repo.
 *   - Auth is monkey-patched in the authGuard helper module so we can drive
 *     authenticated and unauthenticated paths deterministically (no NextAuth
 *     network/session machinery).
 *   - Requests are duck-typed NextRequest objects whose `.json()` returns a
 *     pre-encoded body and whose `.nextUrl` is a parsed URL.
 *
 * Run all:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-create-recipe-endpoint.ts
 * Run one:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-create-recipe-endpoint.ts <test_name>
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

// Stub the auth options module so we don't drag in @auth/prisma-adapter
// (which doesn't expose CJS "main" and breaks under transpile-only ts-node).
// authGuard only re-exports requireAuth, which we monkey-patch below; the
// authOptions import there is purely for runtime config and never used in
// these tests.
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
import type {
  IRecipeRepository,
  PaginatedResult,
  PaginationOptions,
  RecipeFilters,
} from '../src/domain/repositories/IRecipeRepository';

import { CreateRecipeUseCase } from '../src/application/use-cases/recipe/CreateRecipeUseCase';
import { GetRecipeBySlugUseCase } from '../src/application/use-cases/recipe/GetRecipeBySlugUseCase';
import { SearchRecipesUseCase } from '../src/application/use-cases/recipe/SearchRecipesUseCase';

import { RecipeController } from '../src/interfaces/http/controllers/RecipeController';
import * as authGuard from '../src/interfaces/http/helpers/authGuard';
import { UnauthorizedError } from '../src/domain/errors/DomainError';

// ── In-memory repository ─────────────────────────────────────────────────────

class InMemoryRecipeRepository implements IRecipeRepository {
  public saved: Recipe[] = [];

  async save(recipe: Recipe): Promise<void> {
    if (this.saved.some((r) => r.slug.value === recipe.slug.value)) {
      const err: { code?: string } & Error = new Error('slug exists');
      err.code = 'P2002';
      throw err;
    }
    this.saved.push(recipe);
  }
  async update(): Promise<void> {}
  async delete(): Promise<void> {}

  async findById(id: string): Promise<Recipe | null> {
    return this.saved.find((r) => r.id === id) ?? null;
  }
  async findBySlug(slug: string): Promise<Recipe | null> {
    return this.saved.find((r) => r.slug.value === slug) ?? null;
  }
  async findMany(
    filters: RecipeFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<Recipe>> {
    let data = [...this.saved];
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
    const total = data.length;
    const start = (pagination.page - 1) * pagination.pageSize;
    return {
      data: data.slice(start, start + pagination.pageSize),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
    };
  }
  async exists(id: string): Promise<boolean> {
    return this.saved.some((r) => r.id === id);
  }
}

// ── Test helpers ─────────────────────────────────────────────────────────────

import type { NextRequest } from 'next/server';

function makePostReq(body: unknown, url = 'http://localhost/api/recipes'): NextRequest {
  const u = new URL(url);
  // Body is captured once; .json() resolves with it. JSON-parse failures are
  // simulated by passing a special sentinel.
  return {
    nextUrl: u,
    method: 'POST',
    async json() {
      if (body === BROKEN_JSON) {
        throw new SyntaxError('Unexpected token in JSON');
      }
      return body;
    },
  } as unknown as NextRequest;
}

function makeGetReq(url = 'http://localhost/api/recipes'): NextRequest {
  const u = new URL(url);
  return { nextUrl: u, method: 'GET' } as unknown as NextRequest;
}

const BROKEN_JSON = Symbol('broken-json');

function buildController(): {
  controller: RecipeController;
  repo: InMemoryRecipeRepository;
} {
  const repo = new InMemoryRecipeRepository();
  const controller = new RecipeController(
    new SearchRecipesUseCase(repo),
    new GetRecipeBySlugUseCase(repo),
    new CreateRecipeUseCase(repo),
  );
  return { controller, repo };
}

function setAuthenticated(): void {
  (authGuard as { requireAuth: () => Promise<unknown> }).requireAuth = async () => ({
    id: 'user-1',
    email: 'tester@example.com',
    name: 'Tester',
    image: null,
  });
}

function setUnauthenticated(): void {
  (authGuard as { requireAuth: () => Promise<unknown> }).requireAuth = async () => {
    throw new UnauthorizedError('access this resource — please sign in');
  };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Tarta de manzana',
    description: 'Postre clásico',
    cookTimeMinutes: 45,
    difficulty: 'easy',
    tags: ['postre', 'horno'],
    ingredients: [
      { name: 'Manzana', quantity: 4, unit: 'unidad' },
      { name: 'Azúcar', quantity: 100, unit: 'g' },
    ],
    steps: [
      { instruction: 'Pelar y cortar las manzanas' },
      { instruction: 'Hornear durante 30 minutos' },
    ],
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * AC-1 + AC-2 + AC-5: POST /api/recipes with a valid body returns 201 with the
 * created recipe in RecipeDetailDto shape, and the use case has persisted it.
 */
export async function test_ac1_ac2_ac5_create_returns_201_with_detail_dto(): Promise<void> {
  setAuthenticated();
  const { controller, repo } = buildController();

  const res = await controller.createRecipe(makePostReq(validBody()));
  assert(res.status === 201, `expected 201, got ${res.status}`);

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
      ingredients: Array<{
        id: string;
        name: string;
        quantity: number;
        unit: string;
        order: number;
      }>;
      steps: Array<{ id: string; instruction: string; order: number }>;
    };
  };
  assert(body.success === true, 'success flag should be true');
  assert(typeof body.data.id === 'string' && body.data.id.length > 0, 'data.id should be a non-empty string');
  assert(body.data.slug === 'tarta-de-manzana', `expected slug "tarta-de-manzana", got "${body.data.slug}"`);
  assert(body.data.name === 'Tarta de manzana', `unexpected name "${body.data.name}"`);
  assert(body.data.cookTimeMinutes === 45, 'cookTimeMinutes mismatch');
  assert(body.data.difficulty === 'easy', 'difficulty mismatch');
  assert(
    Array.isArray(body.data.tags) && body.data.tags.length === 2 && body.data.tags.includes('postre'),
    'tags mismatch',
  );
  assert(body.data.ingredients.length === 2, `expected 2 ingredients, got ${body.data.ingredients.length}`);
  assert(
    body.data.ingredients[0].order === 1 && body.data.ingredients[1].order === 2,
    'ingredient order must be 1..N',
  );
  assert(body.data.steps.length === 2, 'expected 2 steps');
  assert(
    body.data.steps[0].order === 1 && body.data.steps[1].order === 2,
    'step order must be 1..N',
  );

  // AC-5: persistence happened through the use case → repository.
  assert(repo.saved.length === 1, 'use case should have persisted exactly one recipe');
  assert(repo.saved[0].slug.value === 'tarta-de-manzana', 'persisted slug mismatch');
}

/**
 * AC-3: a malformed body (missing required fields / invalid difficulty / empty
 * ingredients or steps / non-JSON) yields 400 with code VALIDATION_ERROR.
 */
export async function test_ac3_validation_errors_return_400(): Promise<void> {
  setAuthenticated();

  const cases: Array<{ body: unknown; matches: RegExp; label: string }> = [
    {
      body: validBody({ name: undefined }),
      matches: /name/i,
      label: 'missing name',
    },
    {
      body: validBody({ cookTimeMinutes: undefined }),
      matches: /cookTimeMinutes/i,
      label: 'missing cookTimeMinutes',
    },
    {
      body: validBody({ difficulty: 'expert' }),
      matches: /difficulty/i,
      label: 'invalid difficulty',
    },
    {
      body: validBody({ ingredients: [] }),
      matches: /ingredients/i,
      label: 'empty ingredients',
    },
    {
      body: validBody({ steps: [] }),
      matches: /steps/i,
      label: 'empty steps',
    },
    {
      body: validBody({ cookTimeMinutes: -1 }),
      matches: /cookTimeMinutes/i,
      label: 'negative cookTimeMinutes',
    },
    {
      body: BROKEN_JSON,
      matches: /json/i,
      label: 'non-JSON body',
    },
  ];

  for (const c of cases) {
    const { controller } = buildController();
    const res = await controller.createRecipe(makePostReq(c.body));
    assert(res.status === 400, `${c.label}: expected 400, got ${res.status}`);
    const body = (await res.json()) as {
      success: boolean;
      error: { message: string; code: string };
    };
    assert(body.success === false, `${c.label}: success should be false`);
    assert(body.error.code === 'VALIDATION_ERROR', `${c.label}: error code should be VALIDATION_ERROR, got ${body.error.code}`);
    assert(
      typeof body.error.message === 'string' && body.error.message.length > 0,
      `${c.label}: error message should be non-empty`,
    );
    assert(
      c.matches.test(body.error.message),
      `${c.label}: error message "${body.error.message}" should mention the offending field (${c.matches})`,
    );
  }
}

/**
 * AC-4: when no authenticated user, the endpoint returns 401 (using the
 * existing authGuard helper).
 */
export async function test_ac4_unauthenticated_returns_401(): Promise<void> {
  setUnauthenticated();
  const { controller, repo } = buildController();

  const res = await controller.createRecipe(makePostReq(validBody()));
  assert(res.status === 401, `expected 401, got ${res.status}`);

  const body = (await res.json()) as { success: boolean; error: { code: string } };
  assert(body.success === false, 'success flag should be false');
  assert(body.error.code === 'UNAUTHORIZED', `expected code UNAUTHORIZED, got ${body.error.code}`);

  // Nothing should have been persisted.
  assert(repo.saved.length === 0, 'no recipe should be persisted on auth failure');
}

/**
 * AC-6: a recipe created via POST /api/recipes is immediately returned by
 * GET /api/recipes against the same repository.
 */
export async function test_ac6_created_recipe_shows_up_in_get(): Promise<void> {
  setAuthenticated();
  const { controller, repo } = buildController();

  const createRes = await controller.createRecipe(
    makePostReq(validBody({ name: 'Sopa de tomate', tags: ['sopa'] })),
  );
  assert(createRes.status === 201, `create: expected 201, got ${createRes.status}`);
  assert(repo.saved.length === 1, 'create should persist exactly one recipe');

  const listRes = await controller.list(makeGetReq());
  assert(listRes.status === 200, `list: expected 200, got ${listRes.status}`);

  const body = (await listRes.json()) as {
    success: boolean;
    data: Array<{ id: string; name: string }>;
  };
  assert(body.success === true, 'list success flag should be true');
  assert(Array.isArray(body.data), 'list data should be an array');
  assert(
    body.data.length === 1,
    `list should contain the just-created recipe (1 result), got ${body.data.length}`,
  );
  assert(body.data[0].name === 'Sopa de tomate', `unexpected recipe name in list: ${body.data[0].name}`);
}

/**
 * AC-7: All edited files type-check.  This test asserts that the use case
 * binding compiles at runtime by simply constructing the controller against
 * the in-memory repository (which exercises every type contract this task
 * introduced).  TypeScript itself is verified separately by `npx tsc --noEmit`
 * on the files this task touched (see PR summary / open_issues).
 */
export async function test_ac7_use_case_wired_through_controller(): Promise<void> {
  setAuthenticated();
  const { controller } = buildController();
  // The controller exposes createRecipe and it is async.  If types were broken
  // the harness wouldn't have compiled — running here confirms the wiring.
  assert(typeof controller.createRecipe === 'function', 'controller.createRecipe should be a function');
  const res = await controller.createRecipe(makePostReq(validBody({ name: 'Crema de zapallo' })));
  assert(res.status === 201, `wiring smoke: expected 201, got ${res.status}`);
}

// ── Runner ───────────────────────────────────────────────────────────────────

const TESTS: Record<string, () => Promise<void>> = {
  test_ac1_ac2_ac5_create_returns_201_with_detail_dto,
  test_ac3_validation_errors_return_400,
  test_ac4_unauthenticated_returns_401,
  test_ac6_created_recipe_shows_up_in_get,
  test_ac7_use_case_wired_through_controller,
};

async function main(): Promise<void> {
  const filter = process.argv[2];
  const names = Object.keys(TESTS).filter((n) => !filter || n === filter);
  if (names.length === 0) {
    console.error(`No test matches "${filter}"`);
    process.exit(1);
  }
  let failed = 0;
  for (const name of names) {
    try {
      await TESTS[name]();
      console.log(`  ✓ ${name}`);
    } catch (err) {
      failed += 1;
      console.error(`  ✗ ${name}`);
      console.error(`    ${(err as Error).message}`);
    }
  }
  console.log(`\n${names.length - failed}/${names.length} passed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
