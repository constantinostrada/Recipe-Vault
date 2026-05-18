/**
 * scripts/assert-favorites.ts
 *
 * AC harness for the favorite-recipes feature. Covers:
 *  - Prisma schema + migration `add_user_favorites`
 *  - The three use cases (Add / Remove / ListUserFavorites) via an
 *    in-memory IFavoriteRecipeRepository (the existing test pattern)
 *  - FavoriteRecipeRepository implementation registered in the DI container
 *  - HTTP endpoints (POST/DELETE /api/recipes/:id/favorite,
 *    GET /api/me/favorites) with status codes 201 / 204 / 200 and the
 *    requireAuth guard
 *
 * Run all:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-favorites.ts
 * Run one:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-favorites.ts <test_name>
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

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

// ── Auth stub ───────────────────────────────────────────────────────────────
// The FavoriteController calls requireAuth() (from authGuard). authGuard
// transitively pulls in `@auth/prisma-adapter`, which is ESM-only and breaks
// under CJS ts-node. We hijack require() to return a stub for that package
// (we never use the adapter in tests anyway) so the import chain succeeds.
// Then we override `requireAuth` so the controller sees an authenticated
// user without spinning up the auth stack. Tests flip `stubbedUser` to null
// to simulate an unauthenticated request.

let stubbedUser: { id: string; name?: string | null; email?: string | null } | null = {
  id: 'u1',
  email: 'u1@example.com',
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Module = require('module') as {
  prototype: { require: (id: string) => unknown };
};
const originalRequire = Module.prototype.require;
Module.prototype.require = function (this: unknown, id: string) {
  if (id === '@auth/prisma-adapter') {
    return { PrismaAdapter: () => ({}) };
  }
  return originalRequire.call(this, id);
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const authGuardModule = require('../src/interfaces/http/helpers/authGuard') as {
  requireAuth: () => Promise<unknown>;
  getOptionalAuth?: () => Promise<unknown>;
};
authGuardModule.requireAuth = async () => {
  if (!stubbedUser) {
    // Reuse the real UnauthorizedError so the controller's errorResponse
    // path maps it to 403 just like in production.
    const { UnauthorizedError } = require('../src/domain/errors/DomainError') as {
      UnauthorizedError: new (msg?: string) => Error;
    };
    throw new UnauthorizedError('access this resource — please sign in');
  }
  return stubbedUser;
};
if (authGuardModule.getOptionalAuth) {
  authGuardModule.getOptionalAuth = async () => stubbedUser;
}

// ── Imports under test ──────────────────────────────────────────────────────

import { Recipe } from '../src/domain/entities/Recipe';
import { RecipeIngredient } from '../src/domain/entities/RecipeIngredient';
import { RecipeStep } from '../src/domain/entities/RecipeStep';
import { DifficultyLevel } from '../src/domain/value-objects/DifficultyLevel';
import { Slug } from '../src/domain/value-objects/Slug';
import {
  DomainError,
  RecipeNotFoundError,
  UnauthorizedError,
} from '../src/domain/errors/DomainError';
import type {
  IRecipeRepository,
  PaginatedResult,
  PaginationOptions,
  RecipeFilters,
} from '../src/domain/repositories/IRecipeRepository';
import type { IFavoriteRecipeRepository } from '../src/domain/repositories/IFavoriteRecipeRepository';

import { AddFavoriteUseCase } from '../src/application/use-cases/favorite/AddFavoriteUseCase';
import { RemoveFavoriteUseCase } from '../src/application/use-cases/favorite/RemoveFavoriteUseCase';
import { ListUserFavoritesUseCase } from '../src/application/use-cases/favorite/ListUserFavoritesUseCase';

import { FavoriteController } from '../src/interfaces/http/controllers/FavoriteController';

// ── In-memory repositories ──────────────────────────────────────────────────

class InMemoryFavoriteRecipeRepository implements IFavoriteRecipeRepository {
  /** Stores (userId, recipeId, createdAt) tuples; we keep insertion order
   *  so list-by-user can return them most-recent-first. */
  private rows: Array<{ userId: string; recipeId: string; createdAt: Date }> = [];
  /** Lookup table populated by callers to make findRecipesByUser return real
   *  Recipe entities (the AC requires "full recipe payload"). */
  public recipesById: Map<string, Recipe> = new Map();

  async add(userId: string, recipeId: string): Promise<void> {
    if (this.rows.some((r) => r.userId === userId && r.recipeId === recipeId)) {
      return; // idempotent
    }
    this.rows.push({ userId, recipeId, createdAt: new Date() });
  }

  async remove(userId: string, recipeId: string): Promise<void> {
    this.rows = this.rows.filter(
      (r) => !(r.userId === userId && r.recipeId === recipeId),
    );
  }

  async exists(userId: string, recipeId: string): Promise<boolean> {
    return this.rows.some((r) => r.userId === userId && r.recipeId === recipeId);
  }

  async findRecipesByUser(userId: string): Promise<Recipe[]> {
    return this.rows
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((r) => {
        const recipe = this.recipesById.get(r.recipeId);
        if (!recipe) {
          throw new Error(`test bug: recipe ${r.recipeId} not registered in recipesById`);
        }
        return recipe;
      });
  }
}

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
    return {
      data: [...this.recipes],
      total: this.recipes.length,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: 1,
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
  cookTimeMinutes?: number;
  difficulty?: DifficultyLevel;
  tags?: string[];
  ingredients?: Array<{ id: string; name: string; quantity: number; unit: string; order: number }>;
  steps?: Array<{ id: string; instruction: string; order: number }>;
}): Recipe {
  return Recipe.create({
    id: opts.id,
    slug: Slug.create(opts.slug),
    name: opts.name,
    description: opts.description ?? null,
    cookTimeMinutes: opts.cookTimeMinutes ?? 30,
    difficulty: opts.difficulty ?? DifficultyLevel.EASY,
    tags: opts.tags ?? [],
    imageUrl: null,
    ingredients: (opts.ingredients ?? []).map((i) =>
      RecipeIngredient.create({ ...i, recipeId: opts.id }),
    ),
    steps: (opts.steps ?? []).map((s) =>
      RecipeStep.create({ ...s, recipeId: opts.id }),
    ),
  });
}

// ── Assertion helpers ────────────────────────────────────────────────────────

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

async function expectThrows<E extends Error>(
  fn: () => Promise<unknown>,
  ctor: new (...args: never[]) => E,
  matcher: RegExp,
  message: string,
): Promise<void> {
  let threw = false;
  try {
    await fn();
  } catch (err) {
    threw = true;
    if (!(err instanceof ctor)) {
      throw new Error(
        `${message}: expected ${ctor.name}, got ${err instanceof Error ? err.constructor.name : typeof err}`,
      );
    }
    if (!matcher.test(err.message)) {
      throw new Error(`${message}: error message "${err.message}" did not match ${matcher}`);
    }
  }
  if (!threw) throw new Error(`${message}: expected to throw, but did not`);
}

// ── Tests ────────────────────────────────────────────────────────────────────

const ROOT = process.cwd();

/** Schema + migration assertions (AC sub-point 1). */
export async function test_schema_and_migration(): Promise<void> {
  const schema = readFileSync(join(ROOT, 'prisma', 'schema.prisma'), 'utf8');

  // UserFavorite model block must exist
  const block = /model UserFavorite \{([\s\S]*?)\n\}/.exec(schema);
  assert(!!block, 'prisma/schema.prisma must declare model UserFavorite');
  const body = block![1];

  // Required fields
  assert(/\buserId\s+String\b/.test(body), 'UserFavorite.userId must be String');
  assert(
    /\brecipeId\s+String\s+[^\n]*@db\.Uuid/.test(body),
    'UserFavorite.recipeId must be String @db.Uuid (matches Recipe.id type)',
  );
  assert(/\bcreatedAt\s+DateTime\b/.test(body), 'UserFavorite.createdAt must be DateTime');

  // Composite unique key
  assert(
    /@@unique\(\s*\[\s*userId\s*,\s*recipeId\s*\]\s*\)/.test(body),
    'UserFavorite must declare @@unique([userId, recipeId])',
  );

  // Both relations with onDelete: Cascade
  assert(
    /user\s+User\s+@relation\([^)]*onDelete:\s*Cascade/.test(body),
    'UserFavorite must FK user with onDelete: Cascade',
  );
  assert(
    /recipe\s+Recipe\s+@relation\([^)]*onDelete:\s*Cascade/.test(body),
    'UserFavorite must FK recipe with onDelete: Cascade',
  );

  // The migration directory must exist with the requested name suffix.
  const migrationsDir = join(ROOT, 'prisma', 'migrations');
  const dirs = readdirSync(migrationsDir).filter((d) => d !== 'migration_lock.toml');
  const target = dirs.find((d) => d.endsWith('_add_user_favorites'));
  assert(
    !!target,
    `expected a migration directory ending in "_add_user_favorites" (got: ${dirs.join(', ')})`,
  );

  const sql = readFileSync(join(migrationsDir, target!, 'migration.sql'), 'utf8');
  assert(/CREATE TABLE "user_favorites"/.test(sql), 'migration must CREATE TABLE "user_favorites"');
  assert(
    /CREATE UNIQUE INDEX[^\n]*"user_favorites"\("user_id", "recipe_id"\)/.test(sql),
    'migration must create the composite unique index on (user_id, recipe_id)',
  );
}

/** AddFavoriteUseCase (AC sub-point 2 + 7). */
export async function test_add_favorite_use_case(): Promise<void> {
  const recipe = buildRecipe({ id: '11111111-1111-1111-1111-111111111111', slug: 'paella', name: 'Paella' });
  const recipeRepo = new InMemoryRecipeRepository([recipe]);
  const favRepo = new InMemoryFavoriteRecipeRepository();
  favRepo.recipesById.set(recipe.id, recipe);

  const useCase = new AddFavoriteUseCase(favRepo, recipeRepo);

  // Adds successfully
  await useCase.execute({ userId: 'u1', recipeId: recipe.id });
  assert(await favRepo.exists('u1', recipe.id), 'favorite should be present after add');

  // Idempotent — second call must NOT throw and must NOT duplicate
  await useCase.execute({ userId: 'u1', recipeId: recipe.id });
  const list = await favRepo.findRecipesByUser('u1');
  assert(list.length === 1, `re-favoriting must be idempotent (got ${list.length} rows)`);

  // Unknown recipe id → RecipeNotFoundError
  await expectThrows(
    () => useCase.execute({ userId: 'u1', recipeId: 'does-not-exist' }),
    RecipeNotFoundError,
    /does-not-exist/,
    'add must throw RecipeNotFoundError for unknown recipe id',
  );

  // Validation: empty userId / recipeId
  await expectThrows(
    () => useCase.execute({ userId: '', recipeId: recipe.id }),
    DomainError,
    /userId/,
    'empty userId must throw',
  );
  await expectThrows(
    () => useCase.execute({ userId: 'u1', recipeId: '' }),
    DomainError,
    /recipeId/,
    'empty recipeId must throw',
  );
}

/** RemoveFavoriteUseCase (AC sub-point 2 + 7). */
export async function test_remove_favorite_use_case(): Promise<void> {
  const recipe = buildRecipe({ id: '22222222-2222-2222-2222-222222222222', slug: 'gazpacho', name: 'Gazpacho' });
  const recipeRepo = new InMemoryRecipeRepository([recipe]);
  const favRepo = new InMemoryFavoriteRecipeRepository();
  favRepo.recipesById.set(recipe.id, recipe);

  const addUseCase = new AddFavoriteUseCase(favRepo, recipeRepo);
  const removeUseCase = new RemoveFavoriteUseCase(favRepo);

  await addUseCase.execute({ userId: 'u1', recipeId: recipe.id });
  assert(await favRepo.exists('u1', recipe.id), 'precondition: favorite added');

  await removeUseCase.execute({ userId: 'u1', recipeId: recipe.id });
  assert(!(await favRepo.exists('u1', recipe.id)), 'favorite must be removed');

  // Idempotent — removing again is a no-op
  await removeUseCase.execute({ userId: 'u1', recipeId: recipe.id });
  assert(
    !(await favRepo.exists('u1', recipe.id)),
    'idempotent remove must keep the favorite absent',
  );

  // Cross-user isolation: removing another user's favorite must not affect mine
  await addUseCase.execute({ userId: 'u1', recipeId: recipe.id });
  await addUseCase.execute({ userId: 'u2', recipeId: recipe.id });
  await removeUseCase.execute({ userId: 'u2', recipeId: recipe.id });
  assert(
    await favRepo.exists('u1', recipe.id),
    'u1 favorite must survive u2 remove',
  );
  assert(
    !(await favRepo.exists('u2', recipe.id)),
    'u2 favorite must be gone',
  );

  // Validation
  await expectThrows(
    () => removeUseCase.execute({ userId: '', recipeId: recipe.id }),
    DomainError,
    /userId/,
    'empty userId must throw',
  );
}

/** ListUserFavoritesUseCase (AC sub-point 2 + 5 + 7). */
export async function test_list_user_favorites_use_case(): Promise<void> {
  const r1 = buildRecipe({
    id: '33333333-3333-3333-3333-333333333333',
    slug: 'tortilla',
    name: 'Tortilla',
    description: 'Clásica española',
    cookTimeMinutes: 30,
    difficulty: DifficultyLevel.EASY,
    tags: ['vegetariano'],
    ingredients: [
      { id: 'i1', name: 'Patata', quantity: 4, unit: 'unidad', order: 1 },
      { id: 'i2', name: 'Huevo', quantity: 6, unit: 'unidad', order: 2 },
    ],
    steps: [
      { id: 's1', instruction: 'Pelar', order: 1 },
      { id: 's2', instruction: 'Cuajar', order: 2 },
    ],
  });
  const r2 = buildRecipe({
    id: '44444444-4444-4444-4444-444444444444',
    slug: 'cocido',
    name: 'Cocido',
    cookTimeMinutes: 60,
    difficulty: DifficultyLevel.MEDIUM,
    tags: ['carne'],
  });

  const favRepo = new InMemoryFavoriteRecipeRepository();
  favRepo.recipesById.set(r1.id, r1);
  favRepo.recipesById.set(r2.id, r2);

  const recipeRepo = new InMemoryRecipeRepository([r1, r2]);
  const addUseCase = new AddFavoriteUseCase(favRepo, recipeRepo);
  const listUseCase = new ListUserFavoritesUseCase(favRepo);

  // Empty list for an unrelated user
  let result = await listUseCase.execute({ userId: 'u-nobody' });
  assertDeepEqual(result.data, [], 'empty favorites list');

  // Favorite r1 then r2
  await addUseCase.execute({ userId: 'u1', recipeId: r1.id });
  await new Promise((r) => setTimeout(r, 5)); // ensure distinct createdAt
  await addUseCase.execute({ userId: 'u1', recipeId: r2.id });

  result = await listUseCase.execute({ userId: 'u1' });
  assert(result.data.length === 2, `expected 2 favorites, got ${result.data.length}`);

  // Cross-user isolation
  const empty = await listUseCase.execute({ userId: 'u2' });
  assert(empty.data.length === 0, 'u2 must see 0 favorites');

  // Output shape — must be RecipeDetailDto (full payload incl. ingredients + steps)
  const tortillaDto = result.data.find((d) => d.id === r1.id);
  assert(!!tortillaDto, 'tortilla must appear in u1 favorites');
  const expectedKeys = [
    'cookTimeMinutes',
    'description',
    'difficulty',
    'id',
    'imageUrl',
    'ingredients',
    'name',
    'slug',
    'steps',
    'tags',
  ];
  assertDeepEqual(
    Object.keys(tortillaDto!).sort(),
    expectedKeys,
    'list item must be a full RecipeDetailDto (with ingredients + steps)',
  );
  assert(tortillaDto!.ingredients.length === 2, 'ingredients must be present');
  assert(tortillaDto!.steps.length === 2, 'steps must be present');
  assertDeepEqual(
    tortillaDto!.ingredients.map((i) => i.name),
    ['Patata', 'Huevo'],
    'ingredient names + order preserved',
  );

  // Validation
  await expectThrows(
    () => listUseCase.execute({ userId: '' }),
    DomainError,
    /userId/,
    'empty userId must throw',
  );
}

/** DI container registration (AC sub-point 6). */
export async function test_di_container_registers_favorite_repo(): Promise<void> {
  const containerSrc = readFileSync(
    join(ROOT, 'src', 'infrastructure', 'container.ts'),
    'utf8',
  );
  assert(
    /new\s+PrismaFavoriteRecipeRepository\(\s*\)/.test(containerSrc),
    'container.ts must instantiate PrismaFavoriteRecipeRepository',
  );
  assert(
    /addFavoriteUseCase:\s*new\s+AddFavoriteUseCase\b/.test(containerSrc),
    'container.ts must register addFavoriteUseCase',
  );
  assert(
    /removeFavoriteUseCase:\s*new\s+RemoveFavoriteUseCase\b/.test(containerSrc),
    'container.ts must register removeFavoriteUseCase',
  );
  assert(
    /listUserFavoritesUseCase:\s*new\s+ListUserFavoritesUseCase\b/.test(containerSrc),
    'container.ts must register listUserFavoritesUseCase',
  );

  // Prisma implementation must implement the domain interface (source-level proof).
  const repoSrc = readFileSync(
    join(ROOT, 'src', 'infrastructure', 'repositories', 'PrismaFavoriteRecipeRepository.ts'),
    'utf8',
  );
  assert(
    /class\s+PrismaFavoriteRecipeRepository\s+implements\s+IFavoriteRecipeRepository\b/.test(repoSrc),
    'PrismaFavoriteRecipeRepository must declare `implements IFavoriteRecipeRepository`',
  );

  // The interface lives in the domain layer (no Prisma in domain).
  const interfaceFile = join(ROOT, 'src', 'domain', 'repositories', 'IFavoriteRecipeRepository.ts');
  assert(existsSync(interfaceFile), 'IFavoriteRecipeRepository must live in src/domain/repositories');
  const interfaceSrc = readFileSync(interfaceFile, 'utf8');
  assert(
    !/from\s+['"]@prisma\/client['"]/.test(interfaceSrc),
    'IFavoriteRecipeRepository must NOT import from @prisma/client',
  );
}

/** HTTP endpoint: POST returns 201 and requires auth (AC sub-point 3 + 4). */
export async function test_post_favorite_returns_201(): Promise<void> {
  const recipe = buildRecipe({
    id: '55555555-5555-5555-5555-555555555555',
    slug: 'paella',
    name: 'Paella',
  });
  const recipeRepo = new InMemoryRecipeRepository([recipe]);
  const favRepo = new InMemoryFavoriteRecipeRepository();
  favRepo.recipesById.set(recipe.id, recipe);

  const controller = new FavoriteController(
    new AddFavoriteUseCase(favRepo, recipeRepo),
    new RemoveFavoriteUseCase(favRepo),
    new ListUserFavoritesUseCase(favRepo),
  );

  stubbedUser = { id: 'u1', email: 'u1@example.com' };

  const res = await controller.add({} as never, { params: { id: recipe.id } });
  assert(res.status === 201, `POST /favorite expected 201, got ${res.status}`);
  const body = (await res.json()) as { success: boolean; data: { favorited: boolean; recipeId: string } };
  assert(body.success === true, 'success flag should be true');
  assert(body.data.favorited === true, 'favorited flag in body');
  assert(body.data.recipeId === recipe.id, 'recipeId in body');
  assert(await favRepo.exists('u1', recipe.id), 'favorite must be persisted');

  // Unauthenticated → 403
  stubbedUser = null;
  const unauth = await controller.add({} as never, { params: { id: recipe.id } });
  assert(unauth.status === 403, `unauth POST expected 403, got ${unauth.status}`);
  stubbedUser = { id: 'u1' };

  // Unknown recipe → 404
  const missing = await controller.add({} as never, { params: { id: 'no-such-recipe' } });
  assert(missing.status === 404, `unknown recipe expected 404, got ${missing.status}`);

  // The route file must exist and export POST.
  const routeFile = join(
    ROOT,
    'src',
    'app',
    'api',
    'recipes',
    '[slug]',
    'favorite',
    'route.ts',
  );
  assert(existsSync(routeFile), 'POST route file src/app/api/recipes/[slug]/favorite/route.ts must exist');
  const routeSrc = readFileSync(routeFile, 'utf8');
  assert(/export\s+async\s+function\s+POST\b/.test(routeSrc), 'route must export async function POST');
}

/** HTTP endpoint: DELETE returns 204 and requires auth (AC sub-point 4). */
export async function test_delete_favorite_returns_204(): Promise<void> {
  const recipe = buildRecipe({
    id: '66666666-6666-6666-6666-666666666666',
    slug: 'cocido',
    name: 'Cocido',
  });
  const favRepo = new InMemoryFavoriteRecipeRepository();
  favRepo.recipesById.set(recipe.id, recipe);
  const recipeRepo = new InMemoryRecipeRepository([recipe]);

  const controller = new FavoriteController(
    new AddFavoriteUseCase(favRepo, recipeRepo),
    new RemoveFavoriteUseCase(favRepo),
    new ListUserFavoritesUseCase(favRepo),
  );

  stubbedUser = { id: 'u1' };
  await favRepo.add('u1', recipe.id);

  const res = await controller.remove({} as never, { params: { id: recipe.id } });
  assert(res.status === 204, `DELETE /favorite expected 204, got ${res.status}`);
  assert(!(await favRepo.exists('u1', recipe.id)), 'favorite must be removed');

  // Idempotent — removing again is still 204
  const again = await controller.remove({} as never, { params: { id: recipe.id } });
  assert(again.status === 204, `idempotent DELETE expected 204, got ${again.status}`);

  // Unauthenticated → 403
  stubbedUser = null;
  const unauth = await controller.remove({} as never, { params: { id: recipe.id } });
  assert(unauth.status === 403, `unauth DELETE expected 403, got ${unauth.status}`);
  stubbedUser = { id: 'u1' };

  // Route file exports DELETE
  const routeFile = join(
    ROOT,
    'src',
    'app',
    'api',
    'recipes',
    '[slug]',
    'favorite',
    'route.ts',
  );
  const routeSrc = readFileSync(routeFile, 'utf8');
  assert(/export\s+async\s+function\s+DELETE\b/.test(routeSrc), 'route must export async function DELETE');
}

/** HTTP endpoint: GET /api/me/favorites with full recipe payload (AC sub-point 5). */
export async function test_get_me_favorites_returns_full_payload(): Promise<void> {
  const r1 = buildRecipe({
    id: '77777777-7777-7777-7777-777777777777',
    slug: 'tortilla',
    name: 'Tortilla',
    description: 'Sabrosa',
    ingredients: [
      { id: 'i1', name: 'Patata', quantity: 4, unit: 'unidad', order: 1 },
    ],
    steps: [{ id: 's1', instruction: 'Cuajar', order: 1 }],
  });

  const favRepo = new InMemoryFavoriteRecipeRepository();
  favRepo.recipesById.set(r1.id, r1);
  const recipeRepo = new InMemoryRecipeRepository([r1]);

  const controller = new FavoriteController(
    new AddFavoriteUseCase(favRepo, recipeRepo),
    new RemoveFavoriteUseCase(favRepo),
    new ListUserFavoritesUseCase(favRepo),
  );

  stubbedUser = { id: 'u1' };
  await favRepo.add('u1', r1.id);

  const res = await controller.list({} as never);
  assert(res.status === 200, `GET /api/me/favorites expected 200, got ${res.status}`);
  const body = (await res.json()) as {
    success: boolean;
    data: Array<{
      id: string;
      slug: string;
      name: string;
      ingredients: Array<{ id: string; name: string }>;
      steps: Array<{ id: string; instruction: string }>;
    }>;
  };
  assert(body.success === true, 'success flag should be true');
  assert(Array.isArray(body.data), 'data must be an array');
  assert(body.data.length === 1, `expected 1 favorite, got ${body.data.length}`);
  const item = body.data[0];
  assert(item.id === r1.id, 'id must match');
  assert(item.slug === 'tortilla', 'slug must match');
  assert(Array.isArray(item.ingredients) && item.ingredients.length === 1, 'ingredients must be present (full payload)');
  assert(Array.isArray(item.steps) && item.steps.length === 1, 'steps must be present (full payload)');

  // Unauthenticated → 403
  stubbedUser = null;
  const unauth = await controller.list({} as never);
  assert(unauth.status === 403, `unauth GET expected 403, got ${unauth.status}`);
  stubbedUser = { id: 'u1' };

  // Route file exists + exports GET
  const routeFile = join(ROOT, 'src', 'app', 'api', 'me', 'favorites', 'route.ts');
  assert(existsSync(routeFile), 'GET /api/me/favorites route file must exist');
  const routeSrc = readFileSync(routeFile, 'utf8');
  assert(/export\s+async\s+function\s+GET\b/.test(routeSrc), 'route must export async function GET');
}

/** Sanity check that the domain Recipe entity is reachable. Mostly here so a
 *  type error in the imports surfaces as a test failure, not a silent skip. */
export async function test_unauthorized_error_is_thrown_internally(): Promise<void> {
  const favRepo = new InMemoryFavoriteRecipeRepository();
  const recipeRepo = new InMemoryRecipeRepository([]);
  const controller = new FavoriteController(
    new AddFavoriteUseCase(favRepo, recipeRepo),
    new RemoveFavoriteUseCase(favRepo),
    new ListUserFavoritesUseCase(favRepo),
  );

  stubbedUser = null;
  const res = await controller.list({} as never);
  // The 403 status is the externally-visible signature of UnauthorizedError.
  assert(res.status === 403, `unauthenticated list must produce 403, got ${res.status}`);
  const body = (await res.json()) as { error: { code: string } };
  assert(body.error.code === 'UNAUTHORIZED', 'error code must be UNAUTHORIZED');

  // Sanity: the UnauthorizedError type is still wired correctly.
  assert(
    new UnauthorizedError('test').name === 'UnauthorizedError',
    'UnauthorizedError class must be importable',
  );
}

// ── Runner ───────────────────────────────────────────────────────────────────

const ALL_TESTS: Record<string, () => Promise<void>> = {
  test_schema_and_migration,
  test_add_favorite_use_case,
  test_remove_favorite_use_case,
  test_list_user_favorites_use_case,
  test_di_container_registers_favorite_repo,
  test_post_favorite_returns_201,
  test_delete_favorite_returns_204,
  test_get_me_favorites_returns_full_payload,
  test_unauthorized_error_is_thrown_internally,
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
