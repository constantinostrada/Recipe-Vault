/**
 * scripts/assert-migration.ts
 *
 * Acceptance-criteria assertions for the initial Prisma migration.
 * Each `test_*` function corresponds to one AC and is run against:
 *  - the generated prisma/schema.prisma (static source of truth)
 *  - the generated prisma/migrations/<ts>_init/migration.sql
 *  - the live dev DB at DATABASE_URL (for end-to-end migration smoke)
 *  - the test DB at DATABASE_URL_TEST (verifies AC6 'dev and test')
 *
 * Run all:   npx ts-node scripts/assert-migration.ts
 * Run one:   npx ts-node scripts/assert-migration.ts <test_name>
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

const ROOT = process.cwd();
const SCHEMA_PATH = join(ROOT, 'prisma', 'schema.prisma');
const MIGRATIONS_DIR = join(ROOT, 'prisma', 'migrations');

const DEV_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres@localhost:5432/recipe_vault?schema=public';
const TEST_URL =
  process.env.DATABASE_URL_TEST ||
  'postgresql://postgres@localhost:5432/recipe_vault_test?schema=public';

function readSchema(): string {
  return readFileSync(SCHEMA_PATH, 'utf8');
}

function readMigrationSql(): string {
  const dirs = readdirSync(MIGRATIONS_DIR).filter(
    (d) => d !== 'migration_lock.toml',
  );
  if (dirs.length === 0) throw new Error('no migrations found');
  const initDir = dirs.find((d) => d.endsWith('_init'));
  if (!initDir) throw new Error('init migration not found');
  return readFileSync(join(MIGRATIONS_DIR, initDir, 'migration.sql'), 'utf8');
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

// ── AC1: Schema reflects exactly the specified fields ────────────────────────
async function test_ac1_schema_fields_match_spec(): Promise<void> {
  const schema = readSchema();

  // Recipe must have exactly: id, slug, name, description, cookTimeMinutes
  // (mapped to cook_time_minutes), difficulty, tags, imageUrl (mapped to image_url).
  const recipeBlock = /model Recipe \{([\s\S]*?)\n\}/.exec(schema);
  assert(!!recipeBlock, 'Recipe model block not found');
  const body = recipeBlock![1];

  const requiredFields = [
    /\bid\s+String\s+@id\s+@default\(uuid\(\)\)\s+@db\.Uuid/,
    /\bslug\s+String\s+@unique/,
    /\bname\s+String\b/,
    /\bdescription\s+String\?\s+@db\.Text/,
    /\bcookTimeMinutes\s+Int\s+@map\("cook_time_minutes"\)/,
    /\bdifficulty\s+Difficulty\b/,
    /\btags\s+Json\b/,
    /\bimageUrl\s+String\?\s+@map\("image_url"\)/,
  ];
  for (const re of requiredFields) {
    assert(re.test(body), `Recipe missing/wrong field matching ${re}`);
  }

  // Forbidden boilerplate fields must be absent from Recipe
  const forbidden = [
    /\btitle\b/,
    /\bservings\b/,
    /\bprepTimeMin\b/,
    /\bisPublic\b/,
    /\bauthorId\b/,
  ];
  for (const re of forbidden) {
    assert(!re.test(body), `Recipe still has forbidden boilerplate field ${re}`);
  }

  // Ingredient child: name, quantity, unit, order
  const ingBlock = /model RecipeIngredient \{([\s\S]*?)\n\}/.exec(schema);
  assert(!!ingBlock, 'RecipeIngredient model block not found');
  const ingBody = ingBlock![1];
  assert(/\bname\s+String\b/.test(ingBody), 'Ingredient.name missing');
  assert(/\bquantity\s+Float\b/.test(ingBody), 'Ingredient.quantity missing');
  assert(/\bunit\s+String\b/.test(ingBody), 'Ingredient.unit missing');
  assert(/\border\s+Int\b/.test(ingBody), 'Ingredient.order missing');

  // Step child: instruction, order
  const stepBlock = /model RecipeStep \{([\s\S]*?)\n\}/.exec(schema);
  assert(!!stepBlock, 'RecipeStep model block not found');
  const stepBody = stepBlock![1];
  assert(
    /\binstruction\s+String\s+@db\.Text/.test(stepBody),
    'Step.instruction missing',
  );
  assert(/\border\s+Int\b/.test(stepBody), 'Step.order missing');
  assert(
    !/\bstepNumber\b/.test(stepBody),
    'Step still uses boilerplate stepNumber',
  );
}

// ── AC2: Difficulty is a closed enum (easy | medium | hard) ──────────────────
async function test_ac2_difficulty_is_closed_enum(): Promise<void> {
  const schema = readSchema();
  const enumBlock = /enum Difficulty \{([\s\S]*?)\n\}/.exec(schema);
  assert(!!enumBlock, 'Difficulty enum block not found');
  const values = enumBlock![1]
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  assert(
    values.length === 3 &&
      values.includes('easy') &&
      values.includes('medium') &&
      values.includes('hard'),
    `Difficulty enum must be exactly {easy, medium, hard}, got ${JSON.stringify(values)}`,
  );

  // And the DB-level Postgres enum must actually exist with those 3 labels
  const client = new Client({ connectionString: DEV_URL });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT enumlabel FROM pg_enum e
         JOIN pg_type t ON e.enumtypid = t.oid
         WHERE t.typname = 'Difficulty' ORDER BY e.enumsortorder`,
    );
    const labels = result.rows.map((r) => r.enumlabel);
    assert(
      labels.length === 3 &&
        labels.includes('easy') &&
        labels.includes('medium') &&
        labels.includes('hard'),
      `Postgres "Difficulty" type labels mismatch: ${JSON.stringify(labels)}`,
    );

    // Closed enum: inserting any other value must fail.
    try {
      await client.query(
        `INSERT INTO recipes (id, slug, name, cook_time_minutes, difficulty, tags)
         VALUES (gen_random_uuid(), 'enum-probe', 'probe', 5, 'extreme', '[]'::jsonb)`,
      );
      throw new Error('inserting bogus difficulty value did NOT fail');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      assert(
        /invalid input value for enum/i.test(msg),
        `unexpected error inserting bogus difficulty: ${msg}`,
      );
    }
  } finally {
    await client.end();
  }
}

// ── AC3: tags is a JSON column, not a separate table ─────────────────────────
async function test_ac3_tags_is_json_column(): Promise<void> {
  const schema = readSchema();
  const recipeBlock = /model Recipe \{([\s\S]*?)\n\}/.exec(schema)!;
  assert(
    /\btags\s+Json\b/.test(recipeBlock[1]),
    'tags must be Json type on Recipe',
  );
  // No separate tag table in schema
  assert(
    !/model\s+(Tag|RecipeTag)\b/.test(schema),
    'Tag/RecipeTag table must not exist',
  );

  const sql = readMigrationSql();
  assert(
    /"tags"\s+JSONB\s+NOT NULL/.test(sql),
    'migration must create tags as JSONB column',
  );
  assert(
    !/CREATE TABLE "tags"/i.test(sql) &&
      !/CREATE TABLE "recipe_tags"/i.test(sql),
    'migration must NOT create separate tag tables',
  );

  // Verify at DB level
  const client = new Client({ connectionString: DEV_URL });
  await client.connect();
  try {
    const colInfo = await client.query(
      `SELECT data_type FROM information_schema.columns
         WHERE table_name='recipes' AND column_name='tags'`,
    );
    assert(
      colInfo.rows.length === 1 && colInfo.rows[0].data_type === 'jsonb',
      `recipes.tags must be jsonb in DB, got ${JSON.stringify(colInfo.rows)}`,
    );
    const tagsTable = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name IN ('tags','recipe_tags')`,
    );
    assert(
      tagsTable.rows.length === 0,
      'separate tags/recipe_tags tables must not exist in DB',
    );
  } finally {
    await client.end();
  }
}

// ── AC4: cook_time_minutes has CHECK constraint >= 1 ─────────────────────────
async function test_ac4_cook_time_check_constraint(): Promise<void> {
  const sql = readMigrationSql();
  assert(
    /CHECK\s*\(\s*"cook_time_minutes"\s*>=\s*1\s*\)/i.test(sql),
    'migration must include CHECK (cook_time_minutes >= 1) on recipes',
  );

  const client = new Client({ connectionString: DEV_URL });
  await client.connect();
  try {
    // Verify the constraint actually rejects 0
    let rejected = false;
    try {
      await client.query(
        `INSERT INTO recipes (id, slug, name, cook_time_minutes, difficulty, tags)
         VALUES (gen_random_uuid(), 'cook-zero-probe', 'probe', 0, 'easy', '[]'::jsonb)`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/check constraint/i.test(msg)) rejected = true;
    }
    assert(rejected, 'inserting cook_time_minutes=0 must be rejected');

    // And accepts 1
    await client.query(
      `INSERT INTO recipes (id, slug, name, cook_time_minutes, difficulty, tags)
       VALUES (gen_random_uuid(), 'cook-one-probe', 'probe', 1, 'easy', '[]'::jsonb)`,
    );
    await client.query(`DELETE FROM recipes WHERE slug='cook-one-probe'`);
  } finally {
    await client.end();
  }
}

// ── AC5: slug is unique at DB level (unique index) ───────────────────────────
async function test_ac5_slug_unique_index(): Promise<void> {
  const sql = readMigrationSql();
  assert(
    /CREATE UNIQUE INDEX "recipes_slug_key" ON "recipes"\("slug"\)/.test(sql),
    'migration must create unique index on recipes.slug',
  );

  const client = new Client({ connectionString: DEV_URL });
  await client.connect();
  try {
    const idx = await client.query(
      `SELECT indexdef FROM pg_indexes
         WHERE tablename='recipes' AND indexname='recipes_slug_key'`,
    );
    assert(
      idx.rows.length === 1 && /UNIQUE/i.test(idx.rows[0].indexdef),
      `unique index on slug must exist, got ${JSON.stringify(idx.rows)}`,
    );

    // Empirical: two inserts with the same slug must collide
    await client.query(
      `INSERT INTO recipes (id, slug, name, cook_time_minutes, difficulty, tags)
       VALUES (gen_random_uuid(), 'slug-uniq-probe', 'a', 5, 'easy', '[]'::jsonb)`,
    );
    let collided = false;
    try {
      await client.query(
        `INSERT INTO recipes (id, slug, name, cook_time_minutes, difficulty, tags)
         VALUES (gen_random_uuid(), 'slug-uniq-probe', 'b', 5, 'easy', '[]'::jsonb)`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/duplicate key|unique constraint/i.test(msg)) collided = true;
    }
    assert(collided, 'inserting a duplicate slug must violate uniqueness');
    await client.query(`DELETE FROM recipes WHERE slug='slug-uniq-probe'`);
  } finally {
    await client.end();
  }
}

// ── AC6: Migration runs cleanly in dev and test ──────────────────────────────
async function test_ac6_migration_applies_in_dev_and_test(): Promise<void> {
  for (const [label, url] of [
    ['dev', DEV_URL],
    ['test', TEST_URL],
  ] as const) {
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      const tables = await client.query(
        `SELECT table_name FROM information_schema.tables
           WHERE table_schema='public' ORDER BY table_name`,
      );
      const names = tables.rows.map((r) => r.table_name);
      for (const required of [
        'recipes',
        'recipe_ingredients',
        'recipe_steps',
      ]) {
        assert(
          names.includes(required),
          `[${label}] migration did not create table ${required}`,
        );
      }

      const status = await client.query(
        `SELECT migration_name, finished_at, rolled_back_at
           FROM _prisma_migrations ORDER BY started_at`,
      );
      assert(
        status.rows.length >= 1,
        `[${label}] _prisma_migrations table empty`,
      );
      const initRow = status.rows.find((r) =>
        r.migration_name.endsWith('_init'),
      );
      assert(!!initRow, `[${label}] init migration row missing`);
      assert(
        initRow.finished_at !== null && initRow.rolled_back_at === null,
        `[${label}] init migration not in a clean applied state`,
      );
    } finally {
      await client.end();
    }
  }
}

const TESTS: Record<string, () => Promise<void>> = {
  ac1_schema_fields_match_spec: test_ac1_schema_fields_match_spec,
  ac2_difficulty_is_closed_enum: test_ac2_difficulty_is_closed_enum,
  ac3_tags_is_json_column: test_ac3_tags_is_json_column,
  ac4_cook_time_check_constraint: test_ac4_cook_time_check_constraint,
  ac5_slug_unique_index: test_ac5_slug_unique_index,
  ac6_migration_applies_in_dev_and_test:
    test_ac6_migration_applies_in_dev_and_test,
};

async function main(): Promise<void> {
  const filter = process.argv[2];
  const names = filter ? [filter] : Object.keys(TESTS);
  let failed = 0;
  for (const name of names) {
    const fn = TESTS[name];
    if (!fn) {
      console.error(`unknown test: ${name}`);
      process.exit(2);
    }
    try {
      await fn();
      console.log(`PASS  ${name}`);
    } catch (err: unknown) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`FAIL  ${name}: ${msg}`);
    }
  }
  process.exit(failed === 0 ? 0 : 1);
}

main();
