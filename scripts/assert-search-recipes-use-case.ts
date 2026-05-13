/**
 * scripts/assert-search-recipes-use-case.ts
 *
 * AC harness for SearchRecipesUseCase. Uses an inline mock IRecipeRepository
 * to assert that the use case composes the filters correctly before
 * delegating to the repository.
 *
 * Run all:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-search-recipes-use-case.ts
 * Run one:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-search-recipes-use-case.ts <test_name>
 *
 * The CommonJS override is required because the project tsconfig is
 * `module: esnext` / `moduleResolution: bundler`.
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
import { DomainError } from '../src/domain/errors/DomainError';
import type {
  IRecipeRepository,
  PaginatedResult,
  PaginationOptions,
  RecipeFilters,
} from '../src/domain/repositories/IRecipeRepository';
import { DifficultyLevel } from '../src/domain/value-objects/DifficultyLevel';
import { Slug } from '../src/domain/value-objects/Slug';
import { SearchRecipesUseCase } from '../src/application/use-cases/recipe/SearchRecipesUseCase';
import type { SearchRecipesQuery } from '../src/application/dtos/SearchRecipesDto';

// ── Helpers ─────────────────────────────────────────────────────────────

interface MockCall {
  filters: RecipeFilters;
  pagination: PaginationOptions;
}

class MockRecipeRepository implements IRecipeRepository {
  public calls: MockCall[] = [];
  public response: PaginatedResult<Recipe> = {
    data: [],
    total: 0,
    page: 1,
    pageSize: 12,
    totalPages: 1,
  };

  async save(): Promise<void> {}
  async update(): Promise<void> {}
  async delete(): Promise<void> {}
  async findById(): Promise<Recipe | null> {
    return null;
  }
  async findBySlug(): Promise<Recipe | null> {
    return null;
  }
  async findMany(
    filters: RecipeFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<Recipe>> {
    this.calls.push({
      filters: JSON.parse(JSON.stringify(filters)),
      pagination: { ...pagination },
    });
    return this.response;
  }
  async exists(): Promise<boolean> {
    return false;
  }
}

function buildRecipe(overrides: Partial<{
  id: string;
  slug: string;
  name: string;
  cookTimeMinutes: number;
  difficulty: DifficultyLevel;
  tags: string[];
}> = {}): Recipe {
  const id = overrides.id ?? 'r1';
  return Recipe.create({
    id,
    slug: Slug.create(overrides.slug ?? 'test-recipe'),
    name: overrides.name ?? 'Test Recipe',
    description: null,
    cookTimeMinutes: overrides.cookTimeMinutes ?? 30,
    difficulty: overrides.difficulty ?? DifficultyLevel.EASY,
    tags: overrides.tags ?? [],
    imageUrl: null,
    ingredients: [] as RecipeIngredient[],
    steps: [] as RecipeStep[],
  });
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
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

async function expectThrowsDomainError(
  fn: () => Promise<unknown>,
  matcher: RegExp,
  message: string,
): Promise<void> {
  let threw = false;
  try {
    await fn();
  } catch (err) {
    threw = true;
    if (!(err instanceof DomainError)) {
      throw new Error(`${message}: expected DomainError, got ${err instanceof Error ? err.constructor.name : typeof err}`);
    }
    if (!matcher.test(err.message)) {
      throw new Error(`${message}: error message "${err.message}" did not match ${matcher}`);
    }
  }
  if (!threw) throw new Error(`${message}: expected to throw, but did not`);
}

// ── Tests ───────────────────────────────────────────────────────────────

export async function test_all_filters_optional_and_combinable(): Promise<void> {
  // (a) No filters at all → repo receives an empty filters object
  const repoA = new MockRecipeRepository();
  const ucA = new SearchRecipesUseCase(repoA);
  await ucA.execute({});
  assert(repoA.calls.length === 1, 'expected findMany to be called once for empty query');
  assertDeepEqual(repoA.calls[0].filters, {}, 'empty query should produce empty filters');

  // (b) Each filter individually → only that filter appears
  const tests: Array<{ q: SearchRecipesQuery; expected: RecipeFilters; label: string }> = [
    { q: { query: 'pasta' }, expected: { searchTerm: 'pasta' }, label: 'query alone' },
    { q: { difficulty: ['easy'] }, expected: { difficulty: ['easy'] }, label: 'difficulty alone' },
    { q: { maxCookTime: 45 }, expected: { maxCookTimeMinutes: 45 }, label: 'maxCookTime alone' },
    { q: { tags: ['vegano'] }, expected: { tags: ['vegano'] }, label: 'tags alone' },
  ];
  for (const t of tests) {
    const repo = new MockRecipeRepository();
    const uc = new SearchRecipesUseCase(repo);
    await uc.execute(t.q);
    assertDeepEqual(repo.calls[0].filters, t.expected, t.label);
  }

  // (c) Filters combine — all four together pass through together
  const repoC = new MockRecipeRepository();
  const ucC = new SearchRecipesUseCase(repoC);
  await ucC.execute({
    query: 'pasta',
    difficulty: ['easy', 'medium'],
    maxCookTime: 45,
    tags: ['vegano', 'rápido'],
  });
  assertDeepEqual(
    repoC.calls[0].filters,
    {
      searchTerm: 'pasta',
      difficulty: ['easy', 'medium'],
      maxCookTimeMinutes: 45,
      tags: ['vegano', 'rápido'],
    },
    'all filters combined',
  );
}

export async function test_tags_uses_and_semantics(): Promise<void> {
  const repo = new MockRecipeRepository();
  const uc = new SearchRecipesUseCase(repo);
  await uc.execute({ tags: ['vegano', 'rápido'] });

  // The use case forwards tags as an array — the repo contract documents AND
  // semantics (every tag must be present).
  assertDeepEqual(repo.calls[0].filters.tags, ['vegano', 'rápido'], 'tags forwarded');

  // The IRecipeRepository.RecipeFilters contract documents the AND meaning.
  const { readFileSync } = await import('fs');
  const { join } = await import('path');
  const interfaceSrc = readFileSync(
    join(process.cwd(), 'src/domain/repositories/IRecipeRepository.ts'),
    'utf8',
  );
  assert(
    /AND semantics[\s\S]*tags array contains[\s\S]*EVERY tag/i.test(interfaceSrc),
    'RecipeFilters.tags must document AND semantics ("EVERY tag")',
  );

  // Whitespace duplicates are deduped and trimmed (AND filter shouldn't be
  // weakened by accidental duplicates).
  const repo2 = new MockRecipeRepository();
  const uc2 = new SearchRecipesUseCase(repo2);
  await uc2.execute({ tags: ['vegano', '  vegano  ', 'rápido'] });
  assertDeepEqual(
    repo2.calls[0].filters.tags,
    ['vegano', 'rápido'],
    'duplicate / whitespace tags should be deduped',
  );
}

export async function test_max_cook_time_filters_upper_bound(): Promise<void> {
  const repo = new MockRecipeRepository();
  const uc = new SearchRecipesUseCase(repo);
  await uc.execute({ maxCookTime: 30 });
  assert(
    repo.calls[0].filters.maxCookTimeMinutes === 30,
    'maxCookTime should be forwarded as maxCookTimeMinutes <= value',
  );

  // The IRecipeRepository contract must document that maxCookTimeMinutes
  // is an inclusive upper bound (cook_time_minutes <= value).
  const { readFileSync } = await import('fs');
  const { join } = await import('path');
  const interfaceSrc = readFileSync(
    join(process.cwd(), 'src/domain/repositories/IRecipeRepository.ts'),
    'utf8',
  );
  assert(
    /Upper bound \(inclusive\) for cookTimeMinutes/.test(interfaceSrc),
    'RecipeFilters.maxCookTimeMinutes must document inclusive upper bound',
  );

  // The Prisma implementation must use the `lte` predicate on cookTimeMinutes.
  const repoSrc = readFileSync(
    join(process.cwd(), 'src/infrastructure/repositories/PrismaRecipeRepository.ts'),
    'utf8',
  );
  assert(
    /cookTimeMinutes:\s*\{\s*lte:\s*filters\.maxCookTimeMinutes\s*\}/.test(repoSrc),
    'PrismaRecipeRepository must filter cookTimeMinutes with `lte`',
  );

  // Validation: maxCookTime must be a positive number.
  await expectThrowsDomainError(
    () => new SearchRecipesUseCase(new MockRecipeRepository()).execute({ maxCookTime: 0 }),
    /positive/,
    'maxCookTime=0 must throw',
  );
  await expectThrowsDomainError(
    () => new SearchRecipesUseCase(new MockRecipeRepository()).execute({ maxCookTime: -5 }),
    /positive/,
    'negative maxCookTime must throw',
  );
}

export async function test_difficulty_accepts_multiselect_or(): Promise<void> {
  const repo = new MockRecipeRepository();
  const uc = new SearchRecipesUseCase(repo);
  await uc.execute({ difficulty: ['easy', 'medium'] });
  assertDeepEqual(
    repo.calls[0].filters.difficulty,
    ['easy', 'medium'],
    'difficulty array should be forwarded as-is',
  );

  // single value still works
  const repo2 = new MockRecipeRepository();
  const uc2 = new SearchRecipesUseCase(repo2);
  await uc2.execute({ difficulty: ['hard'] });
  assertDeepEqual(repo2.calls[0].filters.difficulty, ['hard'], 'single difficulty value');

  // invalid value rejected
  await expectThrowsDomainError(
    () =>
      new SearchRecipesUseCase(new MockRecipeRepository()).execute({
        // @ts-expect-error - intentionally bad value
        difficulty: ['EASY'],
      }),
    /not a valid difficulty/,
    'uppercase difficulty must throw',
  );
  await expectThrowsDomainError(
    () =>
      new SearchRecipesUseCase(new MockRecipeRepository()).execute({
        // @ts-expect-error - intentionally bad value
        difficulty: ['expert'],
      }),
    /not a valid difficulty/,
    'expert difficulty must throw',
  );

  // OR semantics is documented at the contract level.
  const { readFileSync } = await import('fs');
  const { join } = await import('path');
  const interfaceSrc = readFileSync(
    join(process.cwd(), 'src/domain/repositories/IRecipeRepository.ts'),
    'utf8',
  );
  assert(
    /OR semantics[\s\S]*difficulty is in this set/i.test(interfaceSrc),
    'RecipeFilters.difficulty must document OR semantics',
  );
  // The Prisma implementation must use `in` on the difficulty column.
  const repoSrc = readFileSync(
    join(process.cwd(), 'src/infrastructure/repositories/PrismaRecipeRepository.ts'),
    'utf8',
  );
  assert(
    /difficulty:\s*\{\s*in:\s*filters\.difficulty\s*\}/.test(repoSrc),
    'PrismaRecipeRepository must filter difficulty with `in`',
  );
}

export async function test_empty_query_returns_full_catalog(): Promise<void> {
  // The repo returns 3 recipes; the use case should pass them through with NO
  // filters set, regardless of how the empty query is expressed.
  const allRecipes = [
    buildRecipe({ id: 'r1', slug: 'a-recipe', name: 'A' }),
    buildRecipe({ id: 'r2', slug: 'b-recipe', name: 'B' }),
    buildRecipe({ id: 'r3', slug: 'c-recipe', name: 'C' }),
  ];

  const variants: SearchRecipesQuery[] = [
    {},
    { query: '' },
    { query: '   ' },
    { query: undefined, difficulty: undefined, maxCookTime: undefined, tags: undefined },
    { tags: [] },
    { difficulty: [] },
  ];
  for (const q of variants) {
    const repo = new MockRecipeRepository();
    repo.response = {
      data: allRecipes,
      total: 3,
      page: 1,
      pageSize: 12,
      totalPages: 1,
    };
    const uc = new SearchRecipesUseCase(repo);
    const result = await uc.execute(q);
    assertDeepEqual(
      repo.calls[0].filters,
      {},
      `variant ${JSON.stringify(q)} should produce empty filters`,
    );
    assert(result.data.length === 3, 'all 3 recipes should be returned');
    assert(result.total === 3, 'total must be 3');
  }
}

export async function test_unit_tests_with_mock_cover_combinations(): Promise<void> {
  // This umbrella AC asserts that the test suite exercises COMBINATIONS of
  // filters (not just one-at-a-time). The other tests above already cover
  // both single-filter and all-four-combined cases, plus the validation paths.
  // Here we add explicit pairwise/triple combinations to make the coverage
  // mechanically visible.
  const combos: Array<{ q: SearchRecipesQuery; expected: RecipeFilters; label: string }> = [
    {
      q: { query: 'pasta', tags: ['vegano'] },
      expected: { searchTerm: 'pasta', tags: ['vegano'] },
      label: 'query + tags',
    },
    {
      q: { difficulty: ['easy', 'medium'], maxCookTime: 20 },
      expected: { difficulty: ['easy', 'medium'], maxCookTimeMinutes: 20 },
      label: 'difficulty + maxCookTime',
    },
    {
      q: { tags: ['vegano', 'rápido'], maxCookTime: 15 },
      expected: { tags: ['vegano', 'rápido'], maxCookTimeMinutes: 15 },
      label: 'tags AND + maxCookTime',
    },
    {
      q: { query: 'sopa', difficulty: ['hard'], tags: ['vegano'] },
      expected: { searchTerm: 'sopa', difficulty: ['hard'], tags: ['vegano'] },
      label: 'query + difficulty + tags',
    },
  ];

  for (const c of combos) {
    const repo = new MockRecipeRepository();
    const uc = new SearchRecipesUseCase(repo);
    await uc.execute(c.q);
    assert(
      repo.calls.length === 1,
      `${c.label}: expected exactly one findMany call`,
    );
    assertDeepEqual(repo.calls[0].filters, c.expected, c.label);
  }

  // Tag with empty entry must reject (preserves AND semantics from accidental
  // empty-string tag).
  await expectThrowsDomainError(
    () => new SearchRecipesUseCase(new MockRecipeRepository()).execute({ tags: ['vegano', ''] }),
    /non-empty/,
    'empty tag must throw',
  );

  // Tags non-array rejected
  await expectThrowsDomainError(
    () =>
      new SearchRecipesUseCase(new MockRecipeRepository()).execute({
        // @ts-expect-error
        tags: 'vegano',
      }),
    /array/,
    'non-array tags must throw',
  );

  // Result mapping smoke test (proves the use case returns a DTO, not raw entity)
  const recipe = buildRecipe({
    id: 'r-smoke',
    slug: 'paella',
    name: 'Paella',
    cookTimeMinutes: 40,
    difficulty: DifficultyLevel.MEDIUM,
    tags: ['arroz'],
  });
  const repo = new MockRecipeRepository();
  repo.response = { data: [recipe], total: 1, page: 1, pageSize: 12, totalPages: 1 };
  const uc = new SearchRecipesUseCase(repo);
  const result = await uc.execute({});
  assert(result.data.length === 1, 'one result expected');
  const item = result.data[0];
  assert(item.id === 'r-smoke', 'id mapped');
  assert(item.slug === 'paella', 'slug mapped');
  assert(item.name === 'Paella', 'name mapped');
  assert(item.cookTimeMinutes === 40, 'cookTimeMinutes mapped');
  assert(item.difficulty === 'medium', 'difficulty mapped to enum value');
  assertDeepEqual([...item.tags], ['arroz'], 'tags mapped');
}

// ── Runner ──────────────────────────────────────────────────────────────

const ALL_TESTS: Record<string, () => Promise<void>> = {
  test_all_filters_optional_and_combinable,
  test_tags_uses_and_semantics,
  test_max_cook_time_filters_upper_bound,
  test_difficulty_accepts_multiselect_or,
  test_empty_query_returns_full_catalog,
  test_unit_tests_with_mock_cover_combinations,
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
