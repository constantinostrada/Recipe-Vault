/**
 * scripts/assert-recipe-aggregate.ts
 *
 * Acceptance-criteria assertions for the Recipe aggregate root.
 *
 * Run all:   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-recipe-aggregate.ts
 * Run one:   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-recipe-aggregate.ts <test_name>
 *
 * The CommonJS override is required because the project tsconfig is
 * `module: esnext` / `moduleResolution: bundler` — without it ts-node falls
 * into ESM mode and fails on bare specifiers like `../src/domain/...`.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { Recipe } from '../src/domain/entities/Recipe';
import { RecipeIngredient } from '../src/domain/entities/RecipeIngredient';
import { RecipeStep } from '../src/domain/entities/RecipeStep';
import { Slug } from '../src/domain/value-objects/Slug';
import { DifficultyLevel } from '../src/domain/value-objects/DifficultyLevel';
import { DomainError } from '../src/domain/errors/DomainError';

const ROOT = process.cwd();
const REPO_FILE = join(
  ROOT,
  'src',
  'domain',
  'repositories',
  'IRecipeRepository.ts',
);

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

function expectDomainError(fn: () => unknown, mustMatch?: RegExp): DomainError {
  try {
    fn();
  } catch (err: unknown) {
    if (!(err instanceof DomainError)) {
      throw new Error(
        `expected DomainError, got ${err instanceof Error ? err.constructor.name + ': ' + err.message : String(err)}`,
      );
    }
    if (mustMatch && !mustMatch.test(err.message)) {
      throw new Error(
        `DomainError thrown but message ${JSON.stringify(err.message)} does not match ${mustMatch}`,
      );
    }
    return err;
  }
  throw new Error('expected fn to throw DomainError, but it did not throw');
}

function buildBaseRecipe(): Recipe {
  return Recipe.create({
    id: 'recipe-1',
    slug: Slug.create('pancakes'),
    name: 'Pancakes',
    description: 'Fluffy stack',
    cookTimeMinutes: 15,
    difficulty: DifficultyLevel.EASY,
    tags: ['breakfast'],
    imageUrl: null,
    ingredients: [],
    steps: [],
  });
}

function ingredientOrders(r: Recipe): number[] {
  return r.ingredients.map((i) => i.order);
}

function stepOrders(r: Recipe): number[] {
  return r.steps.map((s) => s.order);
}

// ── AC1: Recipe exposes methods to add/reorder ingredients & steps,
//         maintaining contiguous order ──────────────────────────────────────
async function test_ac1_add_methods_maintain_contiguous_order(): Promise<void> {
  const r = buildBaseRecipe();

  // Add 3 ingredients via the aggregate. Caller does NOT supply order.
  r.addIngredient({ id: 'i1', name: 'Flour', quantity: 200, unit: 'g' });
  r.addIngredient({ id: 'i2', name: 'Milk', quantity: 300, unit: 'ml' });
  r.addIngredient({ id: 'i3', name: 'Egg', quantity: 2, unit: 'unit' });
  assert(
    JSON.stringify(ingredientOrders(r)) === JSON.stringify([1, 2, 3]),
    `ingredient orders should be [1,2,3], got ${JSON.stringify(ingredientOrders(r))}`,
  );

  // Add 2 steps.
  r.addStep({ id: 's1', instruction: 'Mix dry' });
  r.addStep({ id: 's2', instruction: 'Mix wet' });
  assert(
    JSON.stringify(stepOrders(r)) === JSON.stringify([1, 2]),
    `step orders should be [1,2], got ${JSON.stringify(stepOrders(r))}`,
  );

  // Each child's recipeId is glued to the aggregate's id.
  assert(
    r.ingredients.every((i) => i.recipeId === r.id),
    'every ingredient.recipeId must equal recipe.id',
  );
  assert(
    r.steps.every((s) => s.recipeId === r.id),
    'every step.recipeId must equal recipe.id',
  );
}

async function test_ac1_reorder_methods_maintain_contiguous_order(): Promise<void> {
  const r = buildBaseRecipe();
  r.addIngredient({ id: 'i1', name: 'Flour', quantity: 200, unit: 'g' });
  r.addIngredient({ id: 'i2', name: 'Milk', quantity: 300, unit: 'ml' });
  r.addIngredient({ id: 'i3', name: 'Egg', quantity: 2, unit: 'unit' });

  // Reorder: egg, flour, milk
  r.reorderIngredients(['i3', 'i1', 'i2']);
  assert(
    JSON.stringify(ingredientOrders(r)) === JSON.stringify([1, 2, 3]),
    `after reorder, orders should be [1,2,3] in new sequence, got ${JSON.stringify(ingredientOrders(r))}`,
  );
  assert(
    r.ingredients[0].id === 'i3' &&
      r.ingredients[1].id === 'i1' &&
      r.ingredients[2].id === 'i2',
    `after reorder, ingredient ids should be [i3,i1,i2], got ${r.ingredients.map((i) => i.id).join(',')}`,
  );

  // Remove the middle one — remaining must renumber to 1,2 (contiguous).
  r.removeIngredient('i1');
  assert(
    JSON.stringify(ingredientOrders(r)) === JSON.stringify([1, 2]),
    `after remove, orders should be [1,2], got ${JSON.stringify(ingredientOrders(r))}`,
  );

  // Same exercise for steps.
  r.addStep({ id: 's1', instruction: 'a' });
  r.addStep({ id: 's2', instruction: 'b' });
  r.addStep({ id: 's3', instruction: 'c' });
  r.reorderSteps(['s2', 's3', 's1']);
  assert(
    JSON.stringify(stepOrders(r)) === JSON.stringify([1, 2, 3]),
    `step reorder orders should be [1,2,3]`,
  );
  r.removeStep('s3');
  assert(
    JSON.stringify(stepOrders(r)) === JSON.stringify([1, 2]),
    `after remove step, orders should be [1,2]`,
  );
}

// ── AC2: Violating invariants throws DomainError with descriptive message ──
async function test_ac2_violations_throw_descriptive_domain_errors(): Promise<void> {
  // cookTimeMinutes < 1
  expectDomainError(
    () =>
      Recipe.create({
        id: 'r',
        slug: Slug.create('x'),
        name: 'X',
        description: null,
        cookTimeMinutes: 0,
        difficulty: DifficultyLevel.EASY,
        tags: [],
        imageUrl: null,
        ingredients: [],
        steps: [],
      }),
    /cookTimeMinutes/i,
  );

  // empty name
  expectDomainError(
    () =>
      Recipe.create({
        id: 'r',
        slug: Slug.create('x'),
        name: '   ',
        description: null,
        cookTimeMinutes: 5,
        difficulty: DifficultyLevel.EASY,
        tags: [],
        imageUrl: null,
        ingredients: [],
        steps: [],
      }),
    /name/i,
  );

  // Non-contiguous ingredients (gap: 1,3) on construction
  expectDomainError(
    () =>
      Recipe.create({
        id: 'r',
        slug: Slug.create('x'),
        name: 'X',
        description: null,
        cookTimeMinutes: 5,
        difficulty: DifficultyLevel.EASY,
        tags: [],
        imageUrl: null,
        ingredients: [
          RecipeIngredient.create({
            id: 'i1',
            recipeId: 'r',
            name: 'a',
            quantity: 1,
            unit: 'g',
            order: 1,
          }),
          RecipeIngredient.create({
            id: 'i2',
            recipeId: 'r',
            name: 'b',
            quantity: 1,
            unit: 'g',
            order: 3,
          }),
        ],
        steps: [],
      }),
    /contiguous|ingredients/i,
  );

  // Non-contiguous steps (starts at 2)
  expectDomainError(
    () =>
      Recipe.create({
        id: 'r',
        slug: Slug.create('x'),
        name: 'X',
        description: null,
        cookTimeMinutes: 5,
        difficulty: DifficultyLevel.EASY,
        tags: [],
        imageUrl: null,
        ingredients: [],
        steps: [
          RecipeStep.create({
            id: 's1',
            recipeId: 'r',
            instruction: 'go',
            order: 2,
          }),
        ],
      }),
    /contiguous|steps/i,
  );

  // RecipeIngredient direct invariants
  expectDomainError(
    () =>
      RecipeIngredient.create({
        id: 'i',
        recipeId: 'r',
        name: 'a',
        quantity: 0,
        unit: 'g',
        order: 1,
      }),
    /quantity/i,
  );
  expectDomainError(
    () =>
      RecipeIngredient.create({
        id: 'i',
        recipeId: 'r',
        name: '',
        quantity: 1,
        unit: 'g',
        order: 1,
      }),
    /name/i,
  );
  expectDomainError(
    () =>
      RecipeIngredient.create({
        id: 'i',
        recipeId: 'r',
        name: 'a',
        quantity: 1,
        unit: '',
        order: 1,
      }),
    /unit/i,
  );
  expectDomainError(
    () =>
      RecipeIngredient.create({
        id: 'i',
        recipeId: 'r',
        name: 'a',
        quantity: 1,
        unit: 'g',
        order: 0,
      }),
    /order/i,
  );

  // RecipeStep direct invariants
  expectDomainError(
    () =>
      RecipeStep.create({
        id: 's',
        recipeId: 'r',
        instruction: '   ',
        order: 1,
      }),
    /instruction/i,
  );
  expectDomainError(
    () =>
      RecipeStep.create({
        id: 's',
        recipeId: 'r',
        instruction: 'ok',
        order: 0,
      }),
    /order/i,
  );

  // reorderIngredients with bad ids
  const r = buildBaseRecipe();
  r.addIngredient({ id: 'i1', name: 'a', quantity: 1, unit: 'g' });
  r.addIngredient({ id: 'i2', name: 'b', quantity: 1, unit: 'g' });
  expectDomainError(() => r.reorderIngredients(['i1']), /expected 2 ids/i);
  expectDomainError(
    () => r.reorderIngredients(['i1', 'i9']),
    /does not belong/i,
  );
  expectDomainError(
    () => r.reorderIngredients(['i1', 'i1']),
    /more than once/i,
  );

  // removeIngredient unknown id
  expectDomainError(() => r.removeIngredient('nope'), /no ingredient with id/i);
}

// ── AC3: RecipeRepository is a pure interface (no Prisma dep) ──────────────
async function test_ac3_recipe_repository_is_pure_interface(): Promise<void> {
  const src = readFileSync(REPO_FILE, 'utf8');

  // No infrastructure / orm imports anywhere in the file.
  const forbidden: RegExp[] = [
    /from\s+['"]@prisma\/client['"]/,
    /from\s+['"]@prisma\/[^'"]+['"]/,
    /from\s+['"]prisma['"]/,
    /from\s+['"]\.\.\/(infrastructure|application|interfaces)\b/,
    /from\s+['"]@\/(infrastructure|application|interfaces)\b/,
    /\bPrismaClient\b/,
    /\bnew\s+Prisma/,
  ];
  for (const re of forbidden) {
    assert(!re.test(src), `IRecipeRepository.ts contains forbidden token ${re}`);
  }

  // It must declare the IRecipeRepository symbol as an interface.
  assert(
    /export\s+interface\s+IRecipeRepository\b/.test(src),
    'IRecipeRepository.ts must export an interface named IRecipeRepository',
  );

  // The interface must reference the domain Recipe type only via a type-only import.
  assert(
    /import\s+type\s+\{[^}]*\bRecipe\b[^}]*\}\s+from\s+['"]\.\.\/entities\/Recipe['"]/.test(
      src,
    ),
    'IRecipeRepository must import Recipe from ../entities/Recipe as a type-only import',
  );

  // Method shape: must declare the canonical CRUD-ish surface in terms of Recipe / id / slug.
  const requiredMembers = [
    /\bsave\s*\(\s*recipe\s*:\s*Recipe\s*\)\s*:\s*Promise<void>/,
    /\bupdate\s*\(\s*recipe\s*:\s*Recipe\s*\)\s*:\s*Promise<void>/,
    /\bdelete\s*\(\s*id\s*:\s*string\s*\)\s*:\s*Promise<void>/,
    /\bfindById\s*\(\s*id\s*:\s*string\s*\)\s*:\s*Promise<Recipe\s*\|\s*null>/,
    /\bfindBySlug\s*\(\s*slug\s*:\s*string\s*\)\s*:\s*Promise<Recipe\s*\|\s*null>/,
    /\bfindMany\s*\(/,
    /\bexists\s*\(\s*id\s*:\s*string\s*\)\s*:\s*Promise<boolean>/,
  ];
  for (const re of requiredMembers) {
    assert(re.test(src), `IRecipeRepository missing/mismatched member matching ${re}`);
  }
}

// ── AC4: Unit tests of aggregate invariants ────────────────────────────────
async function test_ac4_unit_tests_cover_aggregate_invariants(): Promise<void> {
  // This test exercises additional invariant edge cases not covered above,
  // so AC4 ("Unit tests de las invariantes del aggregate") is satisfied
  // explicitly with its own assertion, while AC1/AC2/AC3 carry the bulk
  // of the surface coverage.

  // 1. A Recipe constructed with no children is valid (empty 1..N permutation).
  const empty = buildBaseRecipe();
  assert(empty.ingredients.length === 0 && empty.steps.length === 0, 'empty children allowed');

  // 2. After construction, children are always sorted by order even if the input was unsorted.
  const unsorted = Recipe.create({
    id: 'r',
    slug: Slug.create('x'),
    name: 'X',
    description: null,
    cookTimeMinutes: 5,
    difficulty: DifficultyLevel.MEDIUM,
    tags: [],
    imageUrl: null,
    ingredients: [
      RecipeIngredient.create({
        id: 'i3',
        recipeId: 'r',
        name: 'c',
        quantity: 1,
        unit: 'g',
        order: 3,
      }),
      RecipeIngredient.create({
        id: 'i1',
        recipeId: 'r',
        name: 'a',
        quantity: 1,
        unit: 'g',
        order: 1,
      }),
      RecipeIngredient.create({
        id: 'i2',
        recipeId: 'r',
        name: 'b',
        quantity: 1,
        unit: 'g',
        order: 2,
      }),
    ],
    steps: [],
  });
  assert(
    unsorted.ingredients.map((i) => i.id).join(',') === 'i1,i2,i3',
    `Recipe must sort children by order on construction, got ${unsorted.ingredients.map((i) => i.id).join(',')}`,
  );

  // 3. updateCookTimeMinutes enforces the same invariant as construction.
  const r = buildBaseRecipe();
  expectDomainError(() => r.updateCookTimeMinutes(0), /cookTimeMinutes/i);
  expectDomainError(() => r.updateCookTimeMinutes(2.5), /cookTimeMinutes/i);
  r.updateCookTimeMinutes(45); // valid
  assert(r.cookTimeMinutes === 45, 'cookTimeMinutes should update to 45');

  // 4. rename enforces non-empty name.
  expectDomainError(() => r.rename('   '), /name/i);

  // 5. Aggregate refuses children whose recipeId does not match.
  expectDomainError(
    () =>
      Recipe.create({
        id: 'rA',
        slug: Slug.create('a'),
        name: 'A',
        description: null,
        cookTimeMinutes: 5,
        difficulty: DifficultyLevel.EASY,
        tags: [],
        imageUrl: null,
        ingredients: [
          RecipeIngredient.create({
            id: 'i',
            recipeId: 'rB',
            name: 'a',
            quantity: 1,
            unit: 'g',
            order: 1,
          }),
        ],
        steps: [],
      }),
    /belongs to recipe/i,
  );

  // 6. After several add/reorder/remove operations, orders remain a 1..N permutation.
  const r2 = buildBaseRecipe();
  for (let i = 1; i <= 5; i += 1) {
    r2.addIngredient({ id: `i${i}`, name: `n${i}`, quantity: i, unit: 'g' });
  }
  r2.reorderIngredients(['i5', 'i4', 'i3', 'i2', 'i1']);
  r2.removeIngredient('i3');
  r2.removeIngredient('i5');
  assert(
    JSON.stringify(ingredientOrders(r2)) === JSON.stringify([1, 2, 3]),
    `after multiple ops, orders should be [1,2,3], got ${JSON.stringify(ingredientOrders(r2))}`,
  );
  assert(
    r2.ingredients.map((i) => i.id).join(',') === 'i4,i2,i1',
    `after multiple ops, ids should be [i4,i2,i1], got ${r2.ingredients.map((i) => i.id).join(',')}`,
  );
}

const TESTS: Record<string, () => Promise<void>> = {
  ac1_add_methods_maintain_contiguous_order: test_ac1_add_methods_maintain_contiguous_order,
  ac1_reorder_methods_maintain_contiguous_order: test_ac1_reorder_methods_maintain_contiguous_order,
  ac2_violations_throw_descriptive_domain_errors: test_ac2_violations_throw_descriptive_domain_errors,
  ac3_recipe_repository_is_pure_interface: test_ac3_recipe_repository_is_pure_interface,
  ac4_unit_tests_cover_aggregate_invariants: test_ac4_unit_tests_cover_aggregate_invariants,
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
