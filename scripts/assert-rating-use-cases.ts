/**
 * scripts/assert-rating-use-cases.ts
 *
 * AC harness for the three rating use cases:
 *   - RateRecipeUseCase
 *   - RemoveRatingUseCase
 *   - GetRecipeRatingStatsUseCase
 *
 * Uses inline in-memory implementations of IRecipeRepository and
 * IRatingRepository (the project's "in-memory repository pattern", as
 * in scripts/assert-search-recipes-use-case.ts) — no DB needed.
 *
 * Run all:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-rating-use-cases.ts
 * Run one:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-rating-use-cases.ts <test_name>
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
import { DomainError, RecipeNotFoundError } from '../src/domain/errors/DomainError';
import { DifficultyLevel } from '../src/domain/value-objects/DifficultyLevel';
import { Slug } from '../src/domain/value-objects/Slug';
import type {
  IRecipeRepository,
  PaginatedResult,
  PaginationOptions,
  RecipeFilters,
} from '../src/domain/repositories/IRecipeRepository';
import type {
  IRatingRepository,
  RecipeRatingStats,
} from '../src/domain/repositories/IRatingRepository';

import { GetRecipeRatingStatsUseCase } from '../src/application/use-cases/rating/GetRecipeRatingStatsUseCase';
import { RateRecipeUseCase } from '../src/application/use-cases/rating/RateRecipeUseCase';
import { RemoveRatingUseCase } from '../src/application/use-cases/rating/RemoveRatingUseCase';

// ── In-memory repositories ──────────────────────────────────────────────────

class InMemoryRecipeRepository implements IRecipeRepository {
  public recipes = new Map<string, Recipe>();

  store(recipe: Recipe): void {
    this.recipes.set(recipe.slug.value, recipe);
  }

  async save(): Promise<void> {}
  async update(): Promise<void> {}
  async delete(): Promise<void> {}
  async findById(): Promise<Recipe | null> {
    return null;
  }
  async findBySlug(slug: string): Promise<Recipe | null> {
    return this.recipes.get(slug) ?? null;
  }
  async findMany(
    _filters: RecipeFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<Recipe>> {
    return {
      data: [],
      total: 0,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: 1,
    };
  }
  async exists(): Promise<boolean> {
    return false;
  }
}

interface UpsertCall {
  userId: string;
  recipeId: string;
  stars: number;
}

interface RemoveCall {
  userId: string;
  recipeId: string;
}

class InMemoryRatingRepository implements IRatingRepository {
  public upsertCalls: UpsertCall[] = [];
  public removeCalls: RemoveCall[] = [];
  /** Map keyed by `${userId}|${recipeId}` -> stars. */
  public ratings = new Map<string, number>();

  async upsert(userId: string, recipeId: string, stars: number): Promise<void> {
    this.upsertCalls.push({ userId, recipeId, stars });
    this.ratings.set(this.key(userId, recipeId), stars);
  }

  async remove(userId: string, recipeId: string): Promise<void> {
    this.removeCalls.push({ userId, recipeId });
    this.ratings.delete(this.key(userId, recipeId));
  }

  async getStats(recipeId: string): Promise<RecipeRatingStats> {
    const stars: number[] = [];
    for (const [k, v] of this.ratings.entries()) {
      const [, rid] = k.split('|');
      if (rid === recipeId) stars.push(v);
    }
    if (stars.length === 0) return { average: 0, count: 0 };
    const sum = stars.reduce((acc, s) => acc + s, 0);
    return { average: sum / stars.length, count: stars.length };
  }

  private key(userId: string, recipeId: string): string {
    return `${userId}|${recipeId}`;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildRecipe(slug: string, id?: string): Recipe {
  return Recipe.create({
    id: id ?? `recipe-${slug}`,
    slug: Slug.create(slug),
    name: 'Test Recipe',
    description: null,
    cookTimeMinutes: 30,
    difficulty: DifficultyLevel.EASY,
    tags: [],
    imageUrl: null,
    ingredients: [],
    steps: [],
  });
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function expectThrows<E extends Error>(
  fn: () => Promise<unknown>,
  errorClass: new (...args: never[]) => E,
  matcher: RegExp | null,
  message: string,
): Promise<void> {
  let threw = false;
  try {
    await fn();
  } catch (err) {
    threw = true;
    if (!(err instanceof errorClass)) {
      throw new Error(
        `${message}: expected ${errorClass.name}, got ${
          err instanceof Error ? err.constructor.name : typeof err
        }`,
      );
    }
    if (matcher && !matcher.test(err.message)) {
      throw new Error(
        `${message}: error message "${err.message}" did not match ${matcher}`,
      );
    }
  }
  if (!threw) throw new Error(`${message}: expected to throw, but did not`);
}

// ── Tests ───────────────────────────────────────────────────────────────────

export async function test_rate_recipe_use_case(): Promise<void> {
  const recipeRepo = new InMemoryRecipeRepository();
  const ratingRepo = new InMemoryRatingRepository();
  const recipe = buildRecipe('pasta', 'r-pasta');
  recipeRepo.store(recipe);

  const uc = new RateRecipeUseCase(recipeRepo, ratingRepo);

  // Happy path: 4 stars
  await uc.execute({ slug: 'pasta', userId: 'u1', stars: 4 });
  assert(ratingRepo.upsertCalls.length === 1, 'upsert called once');
  assert(
    ratingRepo.upsertCalls[0].userId === 'u1' &&
      ratingRepo.upsertCalls[0].recipeId === 'r-pasta' &&
      ratingRepo.upsertCalls[0].stars === 4,
    'upsert received correct (userId, recipeId, stars)',
  );
  assert(ratingRepo.ratings.get('u1|r-pasta') === 4, 'rating persisted as 4');

  // Upsert: same user re-rates → previous stars overwritten
  await uc.execute({ slug: 'pasta', userId: 'u1', stars: 2 });
  assert(ratingRepo.upsertCalls.length === 2, 'second upsert call recorded');
  assert(ratingRepo.ratings.get('u1|r-pasta') === 2, 'rating overwritten to 2');

  // Each integer 1..5 is accepted
  for (const stars of [1, 2, 3, 4, 5]) {
    const r2 = new InMemoryRatingRepository();
    const uc2 = new RateRecipeUseCase(recipeRepo, r2);
    await uc2.execute({ slug: 'pasta', userId: `u-${stars}`, stars });
    assert(r2.upsertCalls[0].stars === stars, `accepts stars=${stars}`);
  }

  // Validation: out-of-range stars
  for (const bad of [0, 6, -1, 10]) {
    await expectThrows(
      () => uc.execute({ slug: 'pasta', userId: 'u1', stars: bad }),
      DomainError,
      /between 1 and 5/i,
      `stars=${bad} must throw`,
    );
  }
  // Validation: non-integer stars
  for (const bad of [1.5, 3.2, Number.NaN, Number.POSITIVE_INFINITY]) {
    await expectThrows(
      () => uc.execute({ slug: 'pasta', userId: 'u1', stars: bad }),
      DomainError,
      /integer/i,
      `stars=${bad} (non-integer) must throw`,
    );
  }
  // Validation: missing/empty slug
  await expectThrows(
    () => uc.execute({ slug: '', userId: 'u1', stars: 3 }),
    DomainError,
    /slug/i,
    'empty slug must throw',
  );
  // Validation: missing user
  await expectThrows(
    () => uc.execute({ slug: 'pasta', userId: '', stars: 3 }),
    DomainError,
    /userId/i,
    'empty userId must throw',
  );

  // Recipe not found
  await expectThrows(
    () => uc.execute({ slug: 'unknown', userId: 'u1', stars: 3 }),
    RecipeNotFoundError,
    /unknown/,
    'unknown slug must throw RecipeNotFoundError',
  );
}

export async function test_remove_rating_use_case(): Promise<void> {
  const recipeRepo = new InMemoryRecipeRepository();
  const ratingRepo = new InMemoryRatingRepository();
  const recipe = buildRecipe('paella', 'r-paella');
  recipeRepo.store(recipe);

  // Seed an existing rating
  await ratingRepo.upsert('u1', 'r-paella', 5);
  assert(ratingRepo.ratings.has('u1|r-paella'), 'seed: rating present');

  const uc = new RemoveRatingUseCase(recipeRepo, ratingRepo);

  // Happy path: remove existing rating
  await uc.execute({ slug: 'paella', userId: 'u1' });
  assert(ratingRepo.removeCalls.length === 1, 'remove called once');
  assert(
    ratingRepo.removeCalls[0].userId === 'u1' &&
      ratingRepo.removeCalls[0].recipeId === 'r-paella',
    'remove received correct (userId, recipeId)',
  );
  assert(!ratingRepo.ratings.has('u1|r-paella'), 'rating removed');

  // Idempotent: removing again does NOT throw
  await uc.execute({ slug: 'paella', userId: 'u1' });
  assert(ratingRepo.removeCalls.length === 2, 'idempotent second call still recorded');
  assert(!ratingRepo.ratings.has('u1|r-paella'), 'still removed');

  // Idempotent: removing a rating the user never had does NOT throw
  await uc.execute({ slug: 'paella', userId: 'u-never-rated' });

  // Validation: empty slug / empty user
  await expectThrows(
    () => uc.execute({ slug: '', userId: 'u1' }),
    DomainError,
    /slug/i,
    'empty slug must throw',
  );
  await expectThrows(
    () => uc.execute({ slug: 'paella', userId: '' }),
    DomainError,
    /userId/i,
    'empty userId must throw',
  );

  // Recipe not found
  await expectThrows(
    () => uc.execute({ slug: 'no-such-recipe', userId: 'u1' }),
    RecipeNotFoundError,
    /no-such-recipe/,
    'unknown slug must throw RecipeNotFoundError',
  );
}

export async function test_get_recipe_rating_stats_use_case(): Promise<void> {
  const recipeRepo = new InMemoryRecipeRepository();
  const ratingRepo = new InMemoryRatingRepository();
  const recipe = buildRecipe('sopa', 'r-sopa');
  recipeRepo.store(recipe);

  const uc = new GetRecipeRatingStatsUseCase(recipeRepo, ratingRepo);

  // No ratings → { average: 0, count: 0 }
  const empty = await uc.execute({ slug: 'sopa' });
  assert(empty.average === 0, 'no ratings: average is 0');
  assert(empty.count === 0, 'no ratings: count is 0');

  // Three ratings (2, 4, 5 → avg 11/3 ≈ 3.6667)
  await ratingRepo.upsert('u1', 'r-sopa', 2);
  await ratingRepo.upsert('u2', 'r-sopa', 4);
  await ratingRepo.upsert('u3', 'r-sopa', 5);
  const stats = await uc.execute({ slug: 'sopa' });
  assert(stats.count === 3, 'count should be 3');
  assert(
    Math.abs(stats.average - 11 / 3) < 1e-9,
    `average should be 11/3, got ${stats.average}`,
  );

  // Ratings for OTHER recipes do not leak into this recipe's stats
  const otherRecipe = buildRecipe('arroz', 'r-arroz');
  recipeRepo.store(otherRecipe);
  await ratingRepo.upsert('u9', 'r-arroz', 1);
  const stats2 = await uc.execute({ slug: 'sopa' });
  assert(stats2.count === 3, 'isolation: sopa count unaffected by arroz rating');

  // Recipe not found
  await expectThrows(
    () => uc.execute({ slug: 'ghost' }),
    RecipeNotFoundError,
    /ghost/,
    'unknown slug must throw RecipeNotFoundError',
  );

  // Validation: empty slug
  await expectThrows(
    () => uc.execute({ slug: '' }),
    DomainError,
    /slug/i,
    'empty slug must throw',
  );
}

export async function test_all(): Promise<void> {
  // Umbrella test that runs all three — handy for `chiron task ac assert` to
  // bind a single AC to the complete suite.
  await test_rate_recipe_use_case();
  await test_remove_rating_use_case();
  await test_get_recipe_rating_stats_use_case();
}

// ── Runner ──────────────────────────────────────────────────────────────────

const ALL_TESTS: Record<string, () => Promise<void>> = {
  test_rate_recipe_use_case,
  test_remove_rating_use_case,
  test_get_recipe_rating_stats_use_case,
  test_all,
};

async function main(): Promise<void> {
  const filter = process.argv[2];
  const names = filter ? [filter] : Object.keys(ALL_TESTS).filter((n) => n !== 'test_all');
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
