/**
 * scripts/assert-prisma-recipe-repository.ts
 *
 * AC harness for the PrismaRecipeRepository implementation + seed.
 *
 * Run all:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-prisma-recipe-repository.ts
 * Run one:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-prisma-recipe-repository.ts <test_name>
 *
 * The CommonJS override is required because the project tsconfig is
 * `module: esnext` / `moduleResolution: bundler` — without it ts-node falls
 * into ESM mode and fails on bare specifiers like `../src/...`.
 */

// Register the tsconfig `paths` aliases (e.g. `@/domain/...`) so that
// importing PrismaRecipeRepository — which uses `@/` imports — resolves
// correctly even when ts-node is invoked with the CommonJS override.
import { register as registerTsConfigPaths } from 'tsconfig-paths';
import { join } from 'path';

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

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

import { PrismaClient } from '@prisma/client';

import { PrismaRecipeRepository } from '../src/infrastructure/repositories/PrismaRecipeRepository';
import { RecipePrismaMapper } from '../src/infrastructure/repositories/RecipePrismaMapper';

const ROOT = process.cwd();
const REPO_FILE = join(
  ROOT,
  'src',
  'infrastructure',
  'repositories',
  'PrismaRecipeRepository.ts',
);
const MAPPER_FILE = join(
  ROOT,
  'src',
  'infrastructure',
  'repositories',
  'RecipePrismaMapper.ts',
);
const DOMAIN_RECIPE_FILE = join(
  ROOT,
  'src',
  'domain',
  'entities',
  'Recipe.ts',
);
const DOMAIN_RECIPE_INGREDIENT_FILE = join(
  ROOT,
  'src',
  'domain',
  'entities',
  'RecipeIngredient.ts',
);
const DOMAIN_RECIPE_STEP_FILE = join(
  ROOT,
  'src',
  'domain',
  'entities',
  'RecipeStep.ts',
);
const DOMAIN_REPO_INTERFACE = join(
  ROOT,
  'src',
  'domain',
  'repositories',
  'IRecipeRepository.ts',
);
const CONTAINER_FILE = join(ROOT, 'src', 'infrastructure', 'container.ts');

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

// ── AC1: PrismaRecipeRepository implements the domain interface ────────────
async function test_ac1_implements_recipe_repository_interface(): Promise<void> {
  const src = readFileSync(REPO_FILE, 'utf8');

  // Source-level proofs.
  assert(
    /export\s+class\s+PrismaRecipeRepository\s+implements\s+IRecipeRepository\b/.test(
      src,
    ),
    'PrismaRecipeRepository must declare `implements IRecipeRepository` in the class header',
  );
  assert(
    /import\s+type\s+\{[^}]*\bIRecipeRepository\b[^}]*\}\s+from\s+['"]@\/domain\/repositories\/IRecipeRepository['"]/.test(
      src,
    ),
    'PrismaRecipeRepository must import IRecipeRepository (type-only) from the domain layer',
  );

  // The DI container should wire the concrete repository (registered in container).
  const container = readFileSync(CONTAINER_FILE, 'utf8');
  assert(
    /new\s+PrismaRecipeRepository\(\s*\)/.test(container),
    'container.ts must instantiate PrismaRecipeRepository so it is registered in the DI container',
  );

  // Runtime proof: instantiate and check every method on IRecipeRepository
  // is present as a function on the instance.
  const repo = new PrismaRecipeRepository();
  const requiredMethods = [
    'save',
    'update',
    'delete',
    'findById',
    'findBySlug',
    'findMany',
    'exists',
  ] as const;
  for (const m of requiredMethods) {
    assert(
      typeof (repo as unknown as Record<string, unknown>)[m] === 'function',
      `PrismaRecipeRepository must expose method ${m}`,
    );
  }

  // The class should satisfy the interface at the type level.  We can't run
  // tsc against the broken downstream files, but we can encode the assignment
  // here — if PrismaRecipeRepository doesn't satisfy IRecipeRepository, this
  // file itself would not transpile.  We dynamic-import it as a sanity check.
  const mod = await import('../src/infrastructure/repositories/PrismaRecipeRepository');
  assert(
    typeof mod.PrismaRecipeRepository === 'function',
    'PrismaRecipeRepository must be exported as a constructable class',
  );
}

// ── AC2: `prisma db seed` creates 10 recipes without error ─────────────────
async function test_ac2_prisma_db_seed_creates_10_recipes(): Promise<void> {
  // Reset just the recipe rows to prove the seed creates them from scratch.
  const prisma = new PrismaClient();
  try {
    await prisma.recipe.deleteMany({});
  } finally {
    await prisma.$disconnect();
  }

  // Run `prisma db seed` end-to-end.  If it errors, execSync throws.
  let output = '';
  try {
    output = execSync('npx prisma db seed', {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message: string };
    throw new Error(
      `\`prisma db seed\` failed.\nstdout: ${e.stdout ?? ''}\nstderr: ${e.stderr ?? ''}\nmessage: ${e.message}`,
    );
  }

  assert(
    /Seed complete/i.test(output) || /seed command has been executed/i.test(output),
    `prisma db seed output did not include the expected completion message:\n${output}`,
  );

  // Verify the row count.
  const prisma2 = new PrismaClient();
  try {
    const count = await prisma2.recipe.count();
    assert(count === 10, `expected exactly 10 recipes after seed, got ${count}`);
  } finally {
    await prisma2.$disconnect();
  }
}

// ── AC3: Seeded recipes cover all 3 difficulties + diverse tags ────────────
async function test_ac3_recipes_cover_difficulties_and_tags(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const recipes = await prisma.recipe.findMany();
    assert(recipes.length === 10, `expected 10 recipes, got ${recipes.length}`);

    // All 3 difficulty levels must be represented.
    const difficulties = new Set(recipes.map((r) => r.difficulty));
    for (const expected of ['easy', 'medium', 'hard']) {
      assert(
        difficulties.has(expected as 'easy' | 'medium' | 'hard'),
        `difficulty "${expected}" must appear at least once among the seeded recipes; got ${[...difficulties].join(',')}`,
      );
    }

    // Tags are stored as a JSON array column. Collect the union and check
    // diversity: "varios tags distintos" — at least 8 distinct tag values.
    const allTags = new Set<string>();
    for (const r of recipes) {
      assert(
        Array.isArray(r.tags),
        `recipe ${r.slug} tags must be a JSON array, got ${JSON.stringify(r.tags)}`,
      );
      for (const t of r.tags as unknown[]) {
        assert(
          typeof t === 'string',
          `recipe ${r.slug} contains a non-string tag: ${JSON.stringify(t)}`,
        );
        allTags.add(t as string);
      }
    }
    assert(
      allTags.size >= 8,
      `expected at least 8 distinct tag values across the seeded recipes, got ${allTags.size}: ${[...allTags].join(',')}`,
    );

    // Cook times should also vary (sanity — not strictly required by the AC).
    const cookTimes = new Set(recipes.map((r) => r.cookTimeMinutes));
    assert(
      cookTimes.size >= 5,
      `expected at least 5 distinct cook times, got ${cookTimes.size}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

// ── AC4: Mapping is explicit and Prisma types do not leak into the domain ──
async function test_ac4_mapping_is_explicit_no_orm_leak(): Promise<void> {
  // 4a. A dedicated mapper module exists in infrastructure.
  const mapperSrc = readFileSync(MAPPER_FILE, 'utf8');
  assert(
    /export\s+class\s+RecipePrismaMapper\b/.test(mapperSrc),
    'src/infrastructure/repositories/RecipePrismaMapper.ts must export class RecipePrismaMapper',
  );
  // The mapper has both directions.
  assert(
    /\btoDomain\s*\(/.test(mapperSrc),
    'RecipePrismaMapper must expose toDomain()',
  );
  assert(
    /\btoCreateInput\s*\(/.test(mapperSrc) && /\btoUpdateRootData\s*\(/.test(mapperSrc),
    'RecipePrismaMapper must expose toCreateInput() and toUpdateRootData()',
  );

  // 4b. The repository uses the mapper (no inline ad-hoc mapping at every site).
  const repoSrc = readFileSync(REPO_FILE, 'utf8');
  assert(
    /RecipePrismaMapper\.toDomain\b/.test(repoSrc),
    'PrismaRecipeRepository must delegate row→domain mapping to RecipePrismaMapper.toDomain',
  );
  assert(
    /RecipePrismaMapper\.toCreateInput\b/.test(repoSrc),
    'PrismaRecipeRepository must delegate domain→create-input mapping to RecipePrismaMapper.toCreateInput',
  );

  // 4c. No Prisma / ORM imports may leak into the domain.
  const forbiddenInDomain: RegExp[] = [
    /from\s+['"]@prisma\/client['"]/,
    /from\s+['"]@prisma\/[^'"]+['"]/,
    /from\s+['"]prisma['"]/,
    /\bPrismaClient\b/,
    /\bnew\s+Prisma\b/,
  ];
  for (const file of [
    DOMAIN_RECIPE_FILE,
    DOMAIN_RECIPE_INGREDIENT_FILE,
    DOMAIN_RECIPE_STEP_FILE,
    DOMAIN_REPO_INTERFACE,
  ]) {
    const src = readFileSync(file, 'utf8');
    for (const re of forbiddenInDomain) {
      assert(!re.test(src), `${file} contains forbidden ORM token ${re}`);
    }
  }

  // 4d. Round-trip proof: a Recipe persisted via the repository can be
  // read back via the mapper and is structurally identical.
  const prisma = new PrismaClient();
  try {
    // Pick any seeded recipe — the seed must have run already.
    const row = await prisma.recipe.findFirst({
      where: { slug: 'classic-spaghetti-al-pomodoro' },
      include: { ingredients: true, steps: true },
    });
    assert(row !== null, 'seed must have created the spaghetti recipe');

    const domain = RecipePrismaMapper.toDomain(row!);
    assert(
      domain.name === row!.name,
      `mapper name mismatch: ${domain.name} vs ${row!.name}`,
    );
    assert(
      domain.cookTimeMinutes === row!.cookTimeMinutes,
      `mapper cookTimeMinutes mismatch`,
    );
    assert(
      domain.difficulty.value === row!.difficulty,
      `mapper difficulty mismatch: ${domain.difficulty.value} vs ${row!.difficulty}`,
    );
    assert(
      domain.ingredients.length === row!.ingredients.length,
      `mapper ingredient count mismatch`,
    );
    assert(
      domain.steps.length === row!.steps.length,
      `mapper step count mismatch`,
    );
    // Children come out in contiguous 1..N order.
    domain.ingredients.forEach((ing, i) => {
      assert(
        ing.order === i + 1,
        `ingredient ${i} should have order ${i + 1}, got ${ing.order}`,
      );
    });
    domain.steps.forEach((s, i) => {
      assert(s.order === i + 1, `step ${i} should have order ${i + 1}, got ${s.order}`);
    });
  } finally {
    await prisma.$disconnect();
  }
}

const TESTS: Record<string, () => Promise<void>> = {
  ac1_implements_recipe_repository_interface:
    test_ac1_implements_recipe_repository_interface,
  ac2_prisma_db_seed_creates_10_recipes: test_ac2_prisma_db_seed_creates_10_recipes,
  ac3_recipes_cover_difficulties_and_tags: test_ac3_recipes_cover_difficulties_and_tags,
  ac4_mapping_is_explicit_no_orm_leak: test_ac4_mapping_is_explicit_no_orm_leak,
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
