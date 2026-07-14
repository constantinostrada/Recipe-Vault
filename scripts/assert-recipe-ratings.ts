/**
 * scripts/assert-recipe-ratings.ts
 *
 * AC harness for the recipe ratings feature:
 *   - POST /api/recipes/:slug/rate
 *   - GET  /api/recipes               (includes averageRating)
 *   - GET  /api/recipes/:slug         (includes averageRating)
 *
 * Drives the real RecipeController with an in-memory IRecipeRepository
 * that stores ratings in a Map keyed by recipeId. Inspects real
 * NextResponse instances via `.status` and `await .json()`.
 *
 * Run all:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-recipe-ratings.ts
 * Run one:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-recipe-ratings.ts <test_name>
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

import { Rating } from '../src/domain/entities/Rating';
import { Recipe } from '../src/domain/entities/Recipe';
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
import { RateRecipeUseCase } from '../src/application/use-cases/recipe/RateRecipeUseCase';

import { RecipeController } from '../src/interfaces/http/controllers/RecipeController';

import type { NextRequest } from 'next/server';

// ── In-memory repository ────────────────────────────────────────────────────

class InMemoryRecipeRepository implements IRecipeRepository {
  private readonly ratings = new Map<string, Rating[]>();
  private ratingSeq = 0;

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
  async saveRating(rating: Rating): Promise<void> {
    this.ratingSeq += 1;
    const arr = this.ratings.get(rating.recipeId) ?? [];
    arr.push(rating);
    this.ratings.set(rating.recipeId, arr);
  }
  async getAverageRatingsByRecipeIds(
    recipeIds: string[],
  ): Promise<Map<string, number | null>> {
    const out = new Map<string, number | null>();
    for (const id of recipeIds) {
      const arr = this.ratings.get(id);
      if (!arr || arr.length === 0) {
        out.set(id, null);
      } else {
        const sum = arr.reduce((acc, r) => acc + r.value, 0);
        out.set(id, sum / arr.length);
      }
    }
    return out;
  }

  // Test helpers (not part of the interface) ─────────────────────────────
  countRatings(recipeId: string): number {
    return this.ratings.get(recipeId)?.length ?? 0;
  }
  nextRatingNumber(): number {
    return this.ratingSeq;
  }
}

// ── Fixtures ────────────────────────────────────────────────────────────────

function buildRecipe(opts: {
  id: string;
  slug: string;
  name: string;
  cookTimeMinutes: number;
  difficulty: DifficultyLevel;
}): Recipe {
  return Recipe.create({
    id: opts.id,
    slug: Slug.create(opts.slug),
    name: opts.name,
    description: null,
    cookTimeMinutes: opts.cookTimeMinutes,
    difficulty: opts.difficulty,
    tags: [],
    imageUrl: null,
    ingredients: [],
    steps: [],
  });
}

function makeRecipes(): Recipe[] {
  return [
    buildRecipe({
      id: 'r1',
      slug: 'tortilla',
      name: 'Tortilla de patatas',
      cookTimeMinutes: 30,
      difficulty: DifficultyLevel.EASY,
    }),
    buildRecipe({
      id: 'r2',
      slug: 'paella',
      name: 'Paella valenciana',
      cookTimeMinutes: 60,
      difficulty: DifficultyLevel.HARD,
    }),
    buildRecipe({
      id: 'r3',
      slug: 'gazpacho',
      name: 'Gazpacho andaluz',
      cookTimeMinutes: 15,
      difficulty: DifficultyLevel.EASY,
    }),
  ];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildController(): {
  controller: RecipeController;
  repo: InMemoryRecipeRepository;
} {
  const repo = new InMemoryRecipeRepository(makeRecipes());
  let idCounter = 0;
  const idFactory = (): string => `rating-${++idCounter}`;
  const clock = (): Date => new Date('2026-05-15T12:00:00.000Z');

  const controller = new RecipeController(
    new SearchRecipesUseCase(repo),
    new GetRecipeBySlugUseCase(repo),
    new RateRecipeUseCase(repo, idFactory, clock),
  );
  return { controller, repo };
}

function makeJsonReq(url: string, body: unknown): NextRequest {
  const u = new URL(url);
  return {
    nextUrl: u,
    json: async () => body,
  } as unknown as NextRequest;
}

function makeReqNoBody(url: string): NextRequest {
  const u = new URL(url);
  return {
    nextUrl: u,
    json: async () => {
      throw new SyntaxError('Unexpected end of JSON input');
    },
  } as unknown as NextRequest;
}

function makeGetReq(url: string): NextRequest {
  const u = new URL(url);
  return { nextUrl: u } as unknown as NextRequest;
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

// ── Tests ───────────────────────────────────────────────────────────────────

/** AC1: POST /recipes/:slug/rate with body {rating: 4} returns 201. */
export async function test_ac1_post_rate_valid_returns_201(): Promise<void> {
  const { controller, repo } = buildController();
  const res = await controller.rate(
    makeJsonReq('http://localhost/api/recipes/tortilla/rate', { rating: 4 }),
    { params: { slug: 'tortilla' } },
  );
  assert(res.status === 201, `expected 201, got ${res.status}`);
  const body = (await res.json()) as {
    success: boolean;
    data: { id: string; recipeId: string; value: number; createdAt: string };
  };
  assert(body.success === true, 'success flag must be true');
  assert(body.data.value === 4, `expected rating value 4, got ${body.data.value}`);
  assert(body.data.recipeId === 'r1', `expected recipeId r1, got ${body.data.recipeId}`);
  assert(typeof body.data.id === 'string' && body.data.id.length > 0, 'id should be a non-empty string');
  assert(typeof body.data.createdAt === 'string', 'createdAt should be an ISO string');
  assert(repo.countRatings('r1') === 1, 'one rating should be persisted on r1');
}

/** AC2: Invalid ratings (out of 1-5, non-integer, missing) return 400. */
export async function test_ac2_invalid_rating_returns_400(): Promise<void> {
  const cases: Array<{ body: unknown; label: string; matches: RegExp }> = [
    { body: { rating: 0 }, label: 'rating=0', matches: /(rating|1|5|between)/i },
    { body: { rating: 6 }, label: 'rating=6', matches: /(rating|1|5|between)/i },
    { body: { rating: -1 }, label: 'rating=-1', matches: /(rating|1|5|between)/i },
    { body: { rating: 3.5 }, label: 'rating=3.5 (non-integer)', matches: /(integer|rating)/i },
    { body: { rating: 'four' }, label: 'rating="four"', matches: /(rating|number)/i },
    { body: { rating: null }, label: 'rating=null', matches: /(rating|number)/i },
    { body: {}, label: 'rating missing (empty object)', matches: /(rating|required)/i },
  ];

  for (const c of cases) {
    const { controller, repo } = buildController();
    const res = await controller.rate(
      makeJsonReq('http://localhost/api/recipes/tortilla/rate', c.body),
      { params: { slug: 'tortilla' } },
    );
    assert(res.status === 400, `${c.label}: expected 400, got ${res.status}`);
    const body = (await res.json()) as {
      success: boolean;
      error: { message: string; code: string };
    };
    assert(body.success === false, `${c.label}: success should be false`);
    assert(
      typeof body.error?.message === 'string' && body.error.message.length > 0,
      `${c.label}: error message should be a non-empty string`,
    );
    assert(
      c.matches.test(body.error.message),
      `${c.label}: error message "${body.error.message}" should mention the offending field`,
    );
    assert(body.error.code === 'VALIDATION_ERROR', `${c.label}: error code should be VALIDATION_ERROR`);
    assert(repo.countRatings('r1') === 0, `${c.label}: no rating should be persisted`);
  }

  // Missing body entirely (no JSON) — should still 400 with a validation error.
  {
    const { controller, repo } = buildController();
    const res = await controller.rate(
      makeReqNoBody('http://localhost/api/recipes/tortilla/rate'),
      { params: { slug: 'tortilla' } },
    );
    assert(res.status === 400, `no-body: expected 400, got ${res.status}`);
    assert(repo.countRatings('r1') === 0, 'no-body: no rating should be persisted');
  }
}

/** AC3: GET /recipes includes averageRating per recipe (null if no ratings). */
export async function test_ac3_list_includes_average_rating(): Promise<void> {
  const { controller, repo } = buildController();

  // Initial state: no ratings → all averages should be null.
  {
    const res = await controller.list(makeGetReq('http://localhost/api/recipes'));
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const body = (await res.json()) as {
      data: Array<{ slug: string; averageRating: number | null }>;
    };
    assert(Array.isArray(body.data), 'data must be an array');
    assert(body.data.length === 3, `expected 3 recipes, got ${body.data.length}`);
    for (const item of body.data) {
      assert(
        'averageRating' in item,
        `each summary must expose averageRating (got keys: ${Object.keys(item).join(',')})`,
      );
      assert(
        item.averageRating === null,
        `expected averageRating null for unrated ${item.slug}, got ${item.averageRating}`,
      );
    }
  }

  // Add one 5-star rating to tortilla; recheck.
  {
    const rateRes = await controller.rate(
      makeJsonReq('http://localhost/api/recipes/tortilla/rate', { rating: 5 }),
      { params: { slug: 'tortilla' } },
    );
    assert(rateRes.status === 201, `rate setup: expected 201, got ${rateRes.status}`);

    const res = await controller.list(makeGetReq('http://localhost/api/recipes'));
    assert(res.status === 200, `re-list: expected 200, got ${res.status}`);
    const body = (await res.json()) as {
      data: Array<{ slug: string; averageRating: number | null }>;
    };
    const tortilla = body.data.find((d) => d.slug === 'tortilla');
    const paella = body.data.find((d) => d.slug === 'paella');
    assert(tortilla !== undefined, 'tortilla must appear in list');
    assert(paella !== undefined, 'paella must appear in list');
    assert(tortilla!.averageRating === 5, `tortilla avg should be 5, got ${tortilla!.averageRating}`);
    assert(paella!.averageRating === null, `paella (unrated) should be null, got ${paella!.averageRating}`);
  }

  // Also verify the per-slug detail endpoint exposes averageRating.
  {
    const res = await controller.getBySlug(
      makeGetReq('http://localhost/api/recipes/tortilla'),
      { params: { slug: 'tortilla' } },
    );
    assert(res.status === 200, `detail: expected 200, got ${res.status}`);
    const body = (await res.json()) as {
      data: { slug: string; averageRating: number | null };
    };
    assert(body.data.averageRating === 5, `detail avg should be 5, got ${body.data.averageRating}`);

    // Unrated recipe detail → null
    const unrated = await controller.getBySlug(
      makeGetReq('http://localhost/api/recipes/paella'),
      { params: { slug: 'paella' } },
    );
    const unratedBody = (await unrated.json()) as {
      data: { averageRating: number | null };
    };
    assert(
      unratedBody.data.averageRating === null,
      `unrated detail avg should be null, got ${unratedBody.data.averageRating}`,
    );
  }

  // Re-affirm that the persisted count matches what we submitted.
  assert(repo.countRatings('r1') === 1, 'exactly one rating should be on r1');
}

/** AC4: Average rounded to 1 decimal. */
export async function test_ac4_average_rounded_to_one_decimal(): Promise<void> {
  const { controller } = buildController();

  // Submit 3 ratings producing a non-terminating decimal: (4 + 4 + 3) / 3 = 3.666…
  for (const rating of [4, 4, 3]) {
    const res = await controller.rate(
      makeJsonReq('http://localhost/api/recipes/tortilla/rate', { rating }),
      { params: { slug: 'tortilla' } },
    );
    assert(res.status === 201, `setup rate ${rating}: expected 201, got ${res.status}`);
  }

  // List endpoint exposes rounded value.
  const listRes = await controller.list(makeGetReq('http://localhost/api/recipes'));
  const listBody = (await listRes.json()) as {
    data: Array<{ slug: string; averageRating: number | null }>;
  };
  const tortillaListed = listBody.data.find((d) => d.slug === 'tortilla');
  assert(tortillaListed !== undefined, 'tortilla must be in the list');
  assert(
    tortillaListed!.averageRating === 3.7,
    `list avg should be 3.7 (rounded from 3.666…), got ${tortillaListed!.averageRating}`,
  );

  // Detail endpoint exposes the same rounded value.
  const detailRes = await controller.getBySlug(
    makeGetReq('http://localhost/api/recipes/tortilla'),
    { params: { slug: 'tortilla' } },
  );
  const detailBody = (await detailRes.json()) as {
    data: { averageRating: number | null };
  };
  assert(
    detailBody.data.averageRating === 3.7,
    `detail avg should be 3.7, got ${detailBody.data.averageRating}`,
  );

  // Edge case: a 2-decimal average that should round to exactly 1 decimal.
  // (2 + 2 + 2 + 3) / 4 = 2.25 → 2.3 (banker-or-half-away-from-zero, we use the latter).
  {
    const { controller: c2 } = buildController();
    for (const rating of [2, 2, 2, 3]) {
      await c2.rate(
        makeJsonReq('http://localhost/api/recipes/paella/rate', { rating }),
        { params: { slug: 'paella' } },
      );
    }
    const res = await c2.getBySlug(
      makeGetReq('http://localhost/api/recipes/paella'),
      { params: { slug: 'paella' } },
    );
    const body = (await res.json()) as {
      data: { averageRating: number | null };
    };
    assert(
      body.data.averageRating === 2.3,
      `2.25 should round to 2.3, got ${body.data.averageRating}`,
    );
  }
}

/** AC5: Multiple ratings for the same recipe get averaged. */
export async function test_ac5_multiple_ratings_get_averaged(): Promise<void> {
  const { controller, repo } = buildController();

  // 1, 5 → average 3 (exact).
  const ratings = [1, 5];
  for (const r of ratings) {
    const res = await controller.rate(
      makeJsonReq('http://localhost/api/recipes/tortilla/rate', { rating: r }),
      { params: { slug: 'tortilla' } },
    );
    assert(res.status === 201, `setup rate ${r}: expected 201, got ${res.status}`);
  }
  assert(repo.countRatings('r1') === 2, `expected 2 ratings persisted, got ${repo.countRatings('r1')}`);

  const detailRes = await controller.getBySlug(
    makeGetReq('http://localhost/api/recipes/tortilla'),
    { params: { slug: 'tortilla' } },
  );
  assert(detailRes.status === 200, `detail: expected 200, got ${detailRes.status}`);
  const detailBody = (await detailRes.json()) as {
    data: { averageRating: number | null };
  };
  assert(
    detailBody.data.averageRating === 3,
    `average of [1,5] should be 3, got ${detailBody.data.averageRating}`,
  );

  // Add a third rating: 1, 5, 4 → average 3.333… → rounded 3.3
  {
    const res = await controller.rate(
      makeJsonReq('http://localhost/api/recipes/tortilla/rate', { rating: 4 }),
      { params: { slug: 'tortilla' } },
    );
    assert(res.status === 201, `third rate: expected 201, got ${res.status}`);
  }
  const second = await controller.getBySlug(
    makeGetReq('http://localhost/api/recipes/tortilla'),
    { params: { slug: 'tortilla' } },
  );
  const secondBody = (await second.json()) as {
    data: { averageRating: number | null };
  };
  assert(
    secondBody.data.averageRating === 3.3,
    `average of [1,5,4] should be 3.3 (rounded from 3.333…), got ${secondBody.data.averageRating}`,
  );

  // Sanity: another recipe's average is independent.
  const paella = await controller.getBySlug(
    makeGetReq('http://localhost/api/recipes/paella'),
    { params: { slug: 'paella' } },
  );
  const paellaBody = (await paella.json()) as {
    data: { averageRating: number | null };
  };
  assert(
    paellaBody.data.averageRating === null,
    `paella should remain unrated (null), got ${paellaBody.data.averageRating}`,
  );
}

// ── Runner ──────────────────────────────────────────────────────────────────

const ALL_TESTS: Record<string, () => Promise<void>> = {
  test_ac1_post_rate_valid_returns_201,
  test_ac2_invalid_rating_returns_400,
  test_ac3_list_includes_average_rating,
  test_ac4_average_rounded_to_one_decimal,
  test_ac5_multiple_ratings_get_averaged,
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
