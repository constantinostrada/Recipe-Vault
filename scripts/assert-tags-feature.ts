/**
 * scripts/assert-tags-feature.ts
 *
 * Acceptance-criteria harness for task MIYn8DgKQq3AuKcoqWJU
 *   "Add tags field to Recipe with filter support".
 *
 * ACs:
 *   ac-1: Schema migration adds the tags column.
 *   ac-2: Creating a recipe with tags:["vegetarian"] persists it.
 *   ac-3: GET /recipes?tag=vegetarian returns only recipes with that tag.
 *   ac-4: Tag filter is case-insensitive.
 *   ac-5: Adding a tag to existing recipe via PUT works.
 *
 * Run all:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-tags-feature.ts
 * Run one:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-tags-feature.ts <test_name>
 *
 * The CommonJS override is required because the project tsconfig is
 * `module: esnext` / `moduleResolution: bundler` — without it ts-node
 * falls into ESM mode and fails on bare specifiers like `../src/...`.
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

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import type { NextRequest } from 'next/server';

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

import { AddRecipeUseCase } from '../src/application/use-cases/recipe/AddRecipeUseCase';
import { EditRecipeUseCase } from '../src/application/use-cases/recipe/EditRecipeUseCase';
import { SearchRecipesUseCase } from '../src/application/use-cases/recipe/SearchRecipesUseCase';
import { GetRecipeBySlugUseCase } from '../src/application/use-cases/recipe/GetRecipeBySlugUseCase';

import { RecipeController } from '../src/interfaces/http/controllers/RecipeController';

const ROOT = process.cwd();
const SCHEMA_PATH = join(ROOT, 'prisma', 'schema.prisma');
const MIGRATIONS_DIR = join(ROOT, 'prisma', 'migrations');
const PRISMA_REPO_FILE = join(
  ROOT,
  'src',
  'infrastructure',
  'repositories',
  'PrismaRecipeRepository.ts',
);

// ── In-memory repository (case-insensitive tag matching) ─────────────────────

class InMemoryRecipeRepository implements IRecipeRepository {
  public findManyCalls: { filters: RecipeFilters; pagination: PaginationOptions }[] = [];
  public savedCalls: Recipe[] = [];
  public updatedCalls: Recipe[] = [];

  constructor(private recipes: Recipe[] = []) {}

  async save(recipe: Recipe): Promise<void> {
    this.savedCalls.push(recipe);
    this.recipes = [...this.recipes, recipe];
  }
  async update(recipe: Recipe): Promise<void> {
    this.updatedCalls.push(recipe);
    this.recipes = this.recipes.map((r) => (r.id === recipe.id ? recipe : r));
  }
  async delete(id: string): Promise<void> {
    this.recipes = this.recipes.filter((r) => r.id !== id);
  }
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
      const wanted = filters.tags.map((t) => t.toLowerCase());
      data = data.filter((r) => {
        const have = r.tags.map((t) => t.toLowerCase());
        return wanted.every((t) => have.includes(t));
      });
    }
    data.sort((a, b) => a.name.localeCompare(b.name));
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

function makeReq(url: string, init: { method?: string; body?: unknown } = {}): NextRequest {
  const u = new URL(url);
  const method = init.method ?? 'GET';
  const bodyText = init.body !== undefined ? JSON.stringify(init.body) : undefined;
  return {
    nextUrl: u,
    method,
    json: async () => (bodyText ? JSON.parse(bodyText) : undefined),
  } as unknown as NextRequest;
}

function buildController(recipes: Recipe[] = []): {
  controller: RecipeController;
  repo: InMemoryRecipeRepository;
} {
  const repo = new InMemoryRecipeRepository(recipes);
  const controller = new RecipeController(
    new SearchRecipesUseCase(repo),
    new GetRecipeBySlugUseCase(repo),
    new AddRecipeUseCase(repo),
    new EditRecipeUseCase(repo),
  );
  return { controller, repo };
}

function buildRecipe(opts: {
  id: string;
  slug: string;
  name: string;
  tags?: string[];
  cookTimeMinutes?: number;
  difficulty?: DifficultyLevel;
}): Recipe {
  return Recipe.create({
    id: opts.id,
    slug: Slug.create(opts.slug),
    name: opts.name,
    description: null,
    cookTimeMinutes: opts.cookTimeMinutes ?? 30,
    difficulty: opts.difficulty ?? DifficultyLevel.EASY,
    tags: opts.tags ?? [],
    imageUrl: null,
    ingredients: [],
    steps: [],
  });
}

function readSchema(): string {
  return readFileSync(SCHEMA_PATH, 'utf8');
}

function readAnyMigrationSql(): { sql: string; migration: string } {
  const dirs = readdirSync(MIGRATIONS_DIR).filter(
    (d) => d !== 'migration_lock.toml',
  );
  if (dirs.length === 0) throw new Error('no migrations found');
  // Concatenate all migration.sql contents so the "adds tags column" check
  // is satisfied whether the column was introduced in the init migration
  // or in a later one.
  const chunks: string[] = [];
  for (const d of dirs) {
    const f = join(MIGRATIONS_DIR, d, 'migration.sql');
    try {
      chunks.push(readFileSync(f, 'utf8'));
    } catch {
      /* skip non-migration entries */
    }
  }
  return { sql: chunks.join('\n'), migration: dirs.join(',') };
}

// ── AC-1: Schema migration adds the tags column ─────────────────────────────
async function test_ac1_schema_migration_adds_tags_column(): Promise<void> {
  const schema = readSchema();
  const recipeBlock = /model Recipe \{([\s\S]*?)\n\}/.exec(schema);
  assert(!!recipeBlock, 'Recipe model block not found in schema.prisma');
  assert(
    /\btags\s+Json\b/.test(recipeBlock![1]),
    'Recipe model must declare `tags Json` in schema.prisma',
  );

  const { sql } = readAnyMigrationSql();
  assert(
    /"tags"\s+JSONB\s+NOT NULL/i.test(sql),
    'a Prisma migration must create the recipes."tags" JSONB NOT NULL column',
  );

  // Spot-check the table is "recipes" (the model maps to that name).
  assert(
    /CREATE TABLE "recipes"[\s\S]*?"tags"\s+JSONB\s+NOT NULL/i.test(sql),
    'the tags column must be on the "recipes" table',
  );
}

// ── AC-2: Creating a recipe with tags persists it ───────────────────────────
async function test_ac2_create_recipe_with_tags_persists(): Promise<void> {
  // (a) Direct use-case path: AddRecipeUseCase persists the tags.
  {
    const { controller, repo } = buildController();
    const res = await controller.create(
      makeReq('http://localhost/api/recipes', {
        method: 'POST',
        body: {
          name: 'Lentil Stew',
          cookTimeMinutes: 35,
          difficulty: 'easy',
          tags: ['vegetarian'],
        },
      }),
    );
    assert(res.status === 201, `expected 201, got ${res.status}`);
    const body = (await res.json()) as { success: boolean; data: { tags: string[]; slug: string } };
    assert(body.success === true, 'response success must be true');
    assert(Array.isArray(body.data.tags), 'data.tags must be an array');
    assert(
      body.data.tags.length === 1 && body.data.tags[0] === 'vegetarian',
      `data.tags must equal ["vegetarian"], got ${JSON.stringify(body.data.tags)}`,
    );

    // The repository was actually called with a recipe that has the tags.
    assert(repo.savedCalls.length === 1, 'repo.save should be called once');
    const saved = repo.savedCalls[0];
    assert(
      saved.tags.length === 1 && saved.tags[0] === 'vegetarian',
      `saved recipe must have tags=["vegetarian"], got ${JSON.stringify([...saved.tags])}`,
    );

    // And it's still there when re-read by slug.
    const fetched = await repo.findBySlug(body.data.slug);
    assert(fetched !== null, 'recipe must be findable by slug after save');
    assert(
      fetched!.tags.length === 1 && fetched!.tags[0] === 'vegetarian',
      'fetched recipe must keep its tags',
    );
  }

  // (b) Multiple tags + invalid-input path: empty/whitespace tags rejected.
  {
    const { controller } = buildController();
    const res = await controller.create(
      makeReq('http://localhost/api/recipes', {
        method: 'POST',
        body: {
          name: 'Garden Salad',
          cookTimeMinutes: 10,
          difficulty: 'easy',
          tags: ['vegetarian', 'fresh', 'cold'],
        },
      }),
    );
    assert(res.status === 201, `multi-tag create expected 201, got ${res.status}`);
    const body = (await res.json()) as { data: { tags: string[] } };
    assert(
      JSON.stringify([...body.data.tags].sort()) ===
        JSON.stringify(['cold', 'fresh', 'vegetarian']),
      `multi-tag create returned wrong tags: ${JSON.stringify(body.data.tags)}`,
    );

    const bad = await controller.create(
      makeReq('http://localhost/api/recipes', {
        method: 'POST',
        body: {
          name: 'Bad',
          cookTimeMinutes: 5,
          difficulty: 'easy',
          tags: [' '],
        },
      }),
    );
    assert(bad.status === 400, `empty-tag must return 400, got ${bad.status}`);
  }
}

// ── AC-3: GET /recipes?tag=vegetarian returns only recipes with that tag ────
async function test_ac3_get_recipes_filters_by_tag_singular(): Promise<void> {
  const recipes: Recipe[] = [
    buildRecipe({ id: 'r1', slug: 'lentils', name: 'Lentils', tags: ['vegetarian', 'stew'] }),
    buildRecipe({ id: 'r2', slug: 'steak', name: 'Steak', tags: ['meat'] }),
    buildRecipe({ id: 'r3', slug: 'salad', name: 'Salad', tags: ['vegetarian', 'cold'] }),
    buildRecipe({ id: 'r4', slug: 'fish', name: 'Fish', tags: ['seafood'] }),
  ];

  const { controller, repo } = buildController(recipes);
  const res = await controller.list(
    makeReq('http://localhost/api/recipes?tag=vegetarian'),
  );
  assert(res.status === 200, `expected 200, got ${res.status}`);
  const body = (await res.json()) as { success: boolean; data: Array<{ slug: string; tags: string[] }> };
  assert(body.success === true, 'response success must be true');

  // The repo received the singular `tag` in the tags filter.
  const lastCall = repo.findManyCalls[repo.findManyCalls.length - 1];
  assert(
    JSON.stringify(lastCall.filters.tags) === JSON.stringify(['vegetarian']),
    `repo filters.tags must be ["vegetarian"], got ${JSON.stringify(lastCall.filters.tags)}`,
  );

  // Only the two vegetarian recipes come back.
  const slugs = body.data.map((r) => r.slug).sort();
  assert(
    JSON.stringify(slugs) === JSON.stringify(['lentils', 'salad']),
    `expected slugs [lentils, salad], got ${JSON.stringify(slugs)}`,
  );
  for (const item of body.data) {
    assert(
      item.tags.map((t) => t.toLowerCase()).includes('vegetarian'),
      `result item ${item.slug} should contain vegetarian tag`,
    );
  }
}

// ── AC-4: Tag filter is case-insensitive ────────────────────────────────────
async function test_ac4_tag_filter_is_case_insensitive(): Promise<void> {
  const recipes: Recipe[] = [
    buildRecipe({ id: 'r1', slug: 'lentils', name: 'Lentils', tags: ['Vegetarian'] }),
    buildRecipe({ id: 'r2', slug: 'steak', name: 'Steak', tags: ['Meat'] }),
    buildRecipe({ id: 'r3', slug: 'salad', name: 'Salad', tags: ['VEGETARIAN'] }),
    buildRecipe({ id: 'r4', slug: 'mixed', name: 'Mixed', tags: ['vegan'] }),
  ];

  // Probe with lowercase: matches both "Vegetarian" and "VEGETARIAN".
  {
    const { controller } = buildController(recipes);
    const res = await controller.list(
      makeReq('http://localhost/api/recipes?tag=vegetarian'),
    );
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const body = (await res.json()) as { data: Array<{ slug: string }> };
    const slugs = body.data.map((r) => r.slug).sort();
    assert(
      JSON.stringify(slugs) === JSON.stringify(['lentils', 'salad']),
      `case-insensitive lowercase probe expected [lentils, salad], got ${JSON.stringify(slugs)}`,
    );
  }

  // Probe with TitleCase: still matches both.
  {
    const { controller } = buildController(recipes);
    const res = await controller.list(
      makeReq('http://localhost/api/recipes?tag=Vegetarian'),
    );
    const body = (await res.json()) as { data: Array<{ slug: string }> };
    const slugs = body.data.map((r) => r.slug).sort();
    assert(
      JSON.stringify(slugs) === JSON.stringify(['lentils', 'salad']),
      `case-insensitive TitleCase probe expected [lentils, salad], got ${JSON.stringify(slugs)}`,
    );
  }

  // Probe with UPPERCASE: still matches both.
  {
    const { controller } = buildController(recipes);
    const res = await controller.list(
      makeReq('http://localhost/api/recipes?tag=VEGETARIAN'),
    );
    const body = (await res.json()) as { data: Array<{ slug: string }> };
    const slugs = body.data.map((r) => r.slug).sort();
    assert(
      JSON.stringify(slugs) === JSON.stringify(['lentils', 'salad']),
      `case-insensitive UPPERCASE probe expected [lentils, salad], got ${JSON.stringify(slugs)}`,
    );
  }

  // The Prisma implementation must also do case-insensitive matching.
  // Verify it at the source level — we use LOWER() on both sides.
  const src = readFileSync(PRISMA_REPO_FILE, 'utf8');
  assert(
    /LOWER\s*\(\s*t\.value\s*\)\s*=\s*LOWER\s*\(/i.test(src),
    'PrismaRecipeRepository must compare tags case-insensitively (LOWER() on both sides)',
  );
}

// ── AC-5: Adding a tag to existing recipe via PUT works ─────────────────────
async function test_ac5_put_adds_tag_to_existing_recipe(): Promise<void> {
  const existing = buildRecipe({
    id: 'r-existing',
    slug: 'curry',
    name: 'Curry',
    tags: ['indian'],
  });
  const { controller, repo } = buildController([existing]);

  const res = await controller.update(
    makeReq('http://localhost/api/recipes/curry', {
      method: 'PUT',
      body: {
        tags: ['indian', 'vegetarian'],
      },
    }),
    { params: { slug: 'curry' } },
  );
  assert(res.status === 200, `expected 200, got ${res.status}`);
  const body = (await res.json()) as { success: boolean; data: { tags: string[]; slug: string } };
  assert(body.success === true, 'response success must be true');
  assert(
    JSON.stringify([...body.data.tags].sort()) ===
      JSON.stringify(['indian', 'vegetarian']),
    `PUT response tags must be [indian, vegetarian], got ${JSON.stringify(body.data.tags)}`,
  );

  // The repo update happened with the augmented tag set.
  assert(repo.updatedCalls.length === 1, 'repo.update should be called once');
  const updated = repo.updatedCalls[0];
  assert(
    JSON.stringify([...updated.tags].sort()) ===
      JSON.stringify(['indian', 'vegetarian']),
    `updated recipe must contain the new tag set, got ${JSON.stringify([...updated.tags])}`,
  );

  // Re-fetch by slug confirms persistence.
  const fetched = await repo.findBySlug('curry');
  assert(fetched !== null, 'recipe should still be findable after PUT');
  assert(
    [...fetched!.tags].includes('vegetarian'),
    'newly added tag should be visible on subsequent read',
  );

  // Updating an unknown slug returns 404.
  const missing = await controller.update(
    makeReq('http://localhost/api/recipes/nope', {
      method: 'PUT',
      body: { tags: ['x'] },
    }),
    { params: { slug: 'nope' } },
  );
  assert(missing.status === 404, `unknown slug should return 404, got ${missing.status}`);
}

// ── Runner ──────────────────────────────────────────────────────────────────

const ALL_TESTS: Record<string, () => Promise<void>> = {
  test_ac1_schema_migration_adds_tags_column,
  test_ac2_create_recipe_with_tags_persists,
  test_ac3_get_recipes_filters_by_tag_singular,
  test_ac4_tag_filter_is_case_insensitive,
  test_ac5_put_adds_tag_to_existing_recipe,
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
