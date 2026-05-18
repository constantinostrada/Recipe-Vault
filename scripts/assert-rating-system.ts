/**
 * scripts/assert-rating-system.ts
 *
 * Structural / wiring asserts for the recipe-rating system. Complements
 * scripts/assert-rating-use-cases.ts (which covers behaviour) by checking
 * that the spec-required artefacts exist with the right shape:
 *
 *   - Prisma Rating model + composite unique key + add_ratings migration
 *   - Three use case classes under src/application/use-cases/rating/
 *   - POST /api/recipes/:slug/rating wired to RateRecipeUseCase (201, auth)
 *   - DELETE /api/recipes/:slug/rating wired to RemoveRatingUseCase (204, auth)
 *   - GET /api/recipes/:slug/rating wired to GetRecipeRatingStatsUseCase (public)
 *   - IRatingRepository + PrismaRatingRepository + DI container registration
 *
 * Run:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-rating-system.ts
 * Run one:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-rating-system.ts <test_name>
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

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

import { GetRecipeRatingStatsUseCase } from '../src/application/use-cases/rating/GetRecipeRatingStatsUseCase';
import { RateRecipeUseCase } from '../src/application/use-cases/rating/RateRecipeUseCase';
import { RemoveRatingUseCase } from '../src/application/use-cases/rating/RemoveRatingUseCase';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function readRepoFile(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), 'utf8');
}

// ── ac-1 ────────────────────────────────────────────────────────────────────

export async function test_rating_prisma_model_in_schema(): Promise<void> {
  const schema = readRepoFile('prisma/schema.prisma');

  assert(/model\s+Rating\s+\{/.test(schema), 'schema.prisma must declare model Rating');
  assert(
    /@@unique\(\s*\[\s*userId\s*,\s*recipeId\s*\]\s*\)/.test(schema),
    'Rating must have composite @@unique([userId, recipeId])',
  );
  assert(
    /stars\s+Int/.test(schema),
    'Rating must declare a `stars Int` column',
  );
  assert(
    /@@map\("ratings"\)/.test(schema),
    'Rating must map to the "ratings" table',
  );

  // Migration directory must exist with name containing add_ratings
  const migrationsDir = resolve(process.cwd(), 'prisma/migrations');
  assert(existsSync(migrationsDir), 'prisma/migrations directory must exist');
  const dirs = readdirSync(migrationsDir).filter((d) => d.endsWith('add_ratings'));
  assert(
    dirs.length === 1,
    `exactly one migration named add_ratings must exist, found ${dirs.length}`,
  );
  const migrationSql = readRepoFile(`prisma/migrations/${dirs[0]}/migration.sql`);
  assert(/CREATE TABLE "ratings"/.test(migrationSql), 'migration must create ratings table');
  assert(
    /UNIQUE INDEX "ratings_user_id_recipe_id_key"/.test(migrationSql),
    'migration must create composite unique index on (user_id, recipe_id)',
  );
}

// ── ac-2 ────────────────────────────────────────────────────────────────────

export async function test_three_use_cases_exist(): Promise<void> {
  // The three classes are imported at the top of this file — if any were
  // missing, ts-node --transpile-only would have crashed before we got here.
  assert(typeof RateRecipeUseCase === 'function', 'RateRecipeUseCase must be a class');
  assert(
    typeof RemoveRatingUseCase === 'function',
    'RemoveRatingUseCase must be a class',
  );
  assert(
    typeof GetRecipeRatingStatsUseCase === 'function',
    'GetRecipeRatingStatsUseCase must be a class',
  );

  for (const path of [
    'src/application/use-cases/rating/RateRecipeUseCase.ts',
    'src/application/use-cases/rating/RemoveRatingUseCase.ts',
    'src/application/use-cases/rating/GetRecipeRatingStatsUseCase.ts',
  ]) {
    const source = readRepoFile(path);
    assert(
      /async\s+execute\s*\(/.test(source),
      `${path} must define an async execute(...) method`,
    );
  }
}

// ── ac-3 + ac-4 ─────────────────────────────────────────────────────────────

export async function test_post_rating_endpoint(): Promise<void> {
  const route = readRepoFile('src/app/api/recipes/[slug]/rating/route.ts');
  assert(
    /export\s+async\s+function\s+POST\s*\(/.test(route),
    'route.ts must export an async POST handler',
  );
  assert(
    /ratingController\.rate/.test(route),
    'POST must delegate to ratingController.rate',
  );

  const ctl = readRepoFile('src/interfaces/http/controllers/RatingController.ts');
  assert(
    /rate\s*=\s*async/.test(ctl),
    'RatingController must expose a rate handler',
  );
  assert(/requireAuth\(\)/.test(ctl), 'rate handler must call requireAuth()');
  assert(/createdResponse\(/.test(ctl), 'rate handler must return 201 via createdResponse');
  assert(
    /rateRecipeUseCase\.execute/.test(ctl),
    'rate handler must invoke rateRecipeUseCase.execute',
  );
  assert(
    /\.min\(\s*1\b/.test(ctl) && /\.max\(\s*5\b/.test(ctl),
    'rate handler must enforce stars between 1 and 5',
  );

  // upsert behaviour is covered by test_rate_recipe_use_case
  const usecase = readRepoFile(
    'src/application/use-cases/rating/RateRecipeUseCase.ts',
  );
  assert(
    /ratingRepository\.upsert\(/.test(usecase),
    'RateRecipeUseCase must delegate to ratingRepository.upsert (upsert-on-rerate semantics)',
  );
}

// ── ac-5 + ac-6 ─────────────────────────────────────────────────────────────

export async function test_delete_rating_endpoint(): Promise<void> {
  const route = readRepoFile('src/app/api/recipes/[slug]/rating/route.ts');
  assert(
    /export\s+async\s+function\s+DELETE\s*\(/.test(route),
    'route.ts must export an async DELETE handler',
  );
  assert(
    /ratingController\.remove/.test(route),
    'DELETE must delegate to ratingController.remove',
  );

  const ctl = readRepoFile('src/interfaces/http/controllers/RatingController.ts');
  assert(
    /remove\s*=\s*async/.test(ctl),
    'RatingController must expose a remove handler',
  );
  // Find the remove handler body and verify auth + 204
  const removeBlock = ctl.split(/remove\s*=\s*async/)[1] ?? '';
  const removeBody = removeBlock.split('getStats =')[0]; // up to the next handler
  assert(/requireAuth\(\)/.test(removeBody), 'remove handler must call requireAuth()');
  assert(
    /noContentResponse\(\)/.test(removeBody),
    'remove handler must return 204 via noContentResponse()',
  );
}

// ── ac-7 ────────────────────────────────────────────────────────────────────

export async function test_get_rating_endpoint(): Promise<void> {
  const route = readRepoFile('src/app/api/recipes/[slug]/rating/route.ts');
  assert(
    /export\s+async\s+function\s+GET\s*\(/.test(route),
    'route.ts must export an async GET handler',
  );
  assert(
    /ratingController\.getStats/.test(route),
    'GET must delegate to ratingController.getStats',
  );

  const ctl = readRepoFile('src/interfaces/http/controllers/RatingController.ts');
  const getBlock = ctl.split(/getStats\s*=\s*async/)[1] ?? '';
  assert(
    !/requireAuth\(\)/.test(getBlock),
    'getStats handler must NOT require auth (public endpoint)',
  );
  assert(
    /successResponse\(/.test(getBlock),
    'getStats handler must return 200 via successResponse',
  );

  // Use case must produce { average, count }
  const usecase = readRepoFile(
    'src/application/use-cases/rating/GetRecipeRatingStatsUseCase.ts',
  );
  assert(
    /average:\s*stats\.average/.test(usecase) &&
      /count:\s*stats\.count/.test(usecase),
    'GetRecipeRatingStatsUseCase must return { average, count }',
  );

  const dto = readRepoFile('src/application/dtos/RatingDto.ts');
  assert(
    /interface\s+RecipeRatingStatsDto\s*\{[\s\S]*?average:\s*number;[\s\S]*?count:\s*number;/m.test(
      dto,
    ),
    'RecipeRatingStatsDto must have { average: number, count: number }',
  );
}

// ── ac-8 ────────────────────────────────────────────────────────────────────

export async function test_repository_and_container_wiring(): Promise<void> {
  const iface = readRepoFile('src/domain/repositories/IRatingRepository.ts');
  assert(
    /interface\s+IRatingRepository/.test(iface),
    'IRatingRepository interface must be declared',
  );
  for (const method of ['upsert', 'remove', 'getStats']) {
    assert(
      new RegExp(`\\b${method}\\b`).test(iface),
      `IRatingRepository must declare ${method}(...)`,
    );
  }

  const impl = readRepoFile(
    'src/infrastructure/repositories/PrismaRatingRepository.ts',
  );
  assert(
    /class\s+PrismaRatingRepository\s+implements\s+IRatingRepository/.test(impl),
    'PrismaRatingRepository must implement IRatingRepository',
  );

  const container = readRepoFile('src/infrastructure/container.ts');
  assert(
    /new\s+PrismaRatingRepository\(\)/.test(container),
    'container.ts must instantiate PrismaRatingRepository',
  );
  for (const key of [
    'rateRecipeUseCase',
    'removeRatingUseCase',
    'getRecipeRatingStatsUseCase',
  ]) {
    assert(
      new RegExp(`${key}\\s*:`).test(container),
      `container must expose ${key}`,
    );
  }
}

// ── ac-9 ────────────────────────────────────────────────────────────────────
// Behavioural coverage lives in scripts/assert-rating-use-cases.ts. Bind ac-9
// to that script's test_all (the umbrella over the three use case suites).

// ── Runner ──────────────────────────────────────────────────────────────────

const ALL_TESTS: Record<string, () => Promise<void>> = {
  test_rating_prisma_model_in_schema,
  test_three_use_cases_exist,
  test_post_rating_endpoint,
  test_delete_rating_endpoint,
  test_get_rating_endpoint,
  test_repository_and_container_wiring,
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
