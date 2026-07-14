/**
 * scripts/assert-recipe-scoring-service.ts
 *
 * AC harness for RecipeScoringService. Pure domain — no DB or HTTP setup.
 *
 * Run all:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-recipe-scoring-service.ts
 * Run one:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-recipe-scoring-service.ts <test_name>
 *
 * The CommonJS override is required because the project tsconfig is
 * `module: esnext` / `moduleResolution: bundler`.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

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
import {
  RecipeScoringService,
} from '../src/domain/services/RecipeScoringService';
import { DifficultyLevel } from '../src/domain/value-objects/DifficultyLevel';
import { Slug } from '../src/domain/value-objects/Slug';

// ── Helpers ─────────────────────────────────────────────────────────────

interface RecipeOverrides {
  id?: string;
  slug?: string;
  name?: string;
  description?: string | null;
  cookTimeMinutes?: number;
  difficulty?: DifficultyLevel;
  tags?: string[];
}

function buildRecipe(overrides: RecipeOverrides = {}): Recipe {
  const id = overrides.id ?? 'r1';
  return Recipe.create({
    id,
    slug: Slug.create(overrides.slug ?? `slug-${id}`),
    name: overrides.name ?? 'Test Recipe',
    description: overrides.description ?? null,
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

function ids(recipes: ReadonlyArray<Recipe>): string[] {
  return recipes.map((r) => r.id);
}

// ── Tests ───────────────────────────────────────────────────────────────

/**
 * AC-1: RecipeScoringService vive en domain/services/
 *
 * The test verifies that the file exists at the canonical path and that the
 * exported class is the one we import (i.e. moving the file would break this
 * assertion). It also runs a sanity check on the layer prefix.
 */
export async function test_service_lives_in_domain_services(): Promise<void> {
  const path = join(process.cwd(), 'src/domain/services/RecipeScoringService.ts');
  const src = readFileSync(path, 'utf8');
  assert(
    /export class RecipeScoringService/.test(src),
    'src/domain/services/RecipeScoringService.ts must export class RecipeScoringService',
  );
  // Importing it from this path proves the layer placement matches at runtime.
  const svc = new RecipeScoringService();
  assert(typeof svc.score === 'function', 'RecipeScoringService.score must be a function');
  assert(
    typeof svc.sortByRelevance === 'function',
    'RecipeScoringService.sortByRelevance must be a function',
  );
}

/**
 * AC-2: No depende de ninguna librería de infraestructura
 *
 * Scans the source file for any import that touches application/, infrastructure/,
 * interfaces/, ORM clients, HTTP libs, or third-party packages. Only imports
 * from elsewhere within domain/ are allowed.
 */
export async function test_no_infra_dependencies(): Promise<void> {
  const path = join(process.cwd(), 'src/domain/services/RecipeScoringService.ts');
  const src = readFileSync(path, 'utf8');

  const importLines = src
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('import '));

  for (const line of importLines) {
    // Allow only relative imports that stay inside domain/
    const m = line.match(/from\s+['"]([^'"]+)['"]/);
    assert(m !== null, `Cannot parse import target in line: ${line}`);
    const target = m![1];

    assert(
      target.startsWith('.'),
      `RecipeScoringService imports non-relative module "${target}" — domain layer forbids 3rd-party deps`,
    );
    assert(
      !/(application|infrastructure|interfaces)\//.test(target),
      `RecipeScoringService imports from another layer: "${target}"`,
    );
    assert(
      !/(prisma|@prisma|next|react|axios|zod|express|fastify)/.test(target),
      `RecipeScoringService imports an infrastructure / HTTP / framework module: "${target}"`,
    );
  }

  // Belt-and-braces: also assert no `process.env` / `console.log` /
  // ORM-style decorators (CLAUDE.md domain rule list).
  assert(
    !/process\.env/.test(src),
    'RecipeScoringService must not reference process.env',
  );
  assert(
    !/console\.(log|error|warn|info)/.test(src),
    'RecipeScoringService must not use console.*',
  );
}

/**
 * AC-3: Recetas con match en name rankean antes que match en description
 *
 * A recipe that only matches in `name` must outrank a recipe that only matches
 * in `description` — for any number of tag matches the description-only recipe
 * has (the description-vs-tags weighting is also asserted).
 */
export async function test_name_match_outranks_description_match(): Promise<void> {
  const svc = new RecipeScoringService();

  const nameOnly = buildRecipe({
    id: 'name-only',
    slug: 'name-only',
    name: 'Pasta carbonara',
    description: 'Plato tradicional italiano.', // no "pasta" word
    tags: [],
  });
  const descOnly = buildRecipe({
    id: 'desc-only',
    slug: 'desc-only',
    name: 'Tortilla de papas',
    description: 'Lleva pasta de tomate como guarnición.', // "pasta" in description
    tags: [],
  });

  const sName = svc.score(nameOnly, 'pasta');
  const sDesc = svc.score(descOnly, 'pasta');

  assert(sName.breakdown.nameMatch === true, 'name-only must have nameMatch=true');
  assert(sName.breakdown.descriptionMatch === false, 'name-only must have descriptionMatch=false');
  assert(sDesc.breakdown.nameMatch === false, 'desc-only must have nameMatch=false');
  assert(sDesc.breakdown.descriptionMatch === true, 'desc-only must have descriptionMatch=true');
  assert(
    sName.total > sDesc.total,
    `name-only (${sName.total}) must outrank description-only (${sDesc.total})`,
  );

  // sortByRelevance must put the name-match first.
  const sorted = svc.sortByRelevance([descOnly, nameOnly], 'pasta');
  assert(
    sorted[0].id === 'name-only' && sorted[1].id === 'desc-only',
    `expected [name-only, desc-only], got ${JSON.stringify(ids(sorted))}`,
  );

  // Description match must also outrank a recipe with only tag matches.
  const tagOnly = buildRecipe({
    id: 'tag-only',
    slug: 'tag-only',
    name: 'Sopa de verduras',
    description: 'Sopa cálida.', // no "pasta"
    tags: ['pasta', 'vegetariano'],
  });
  const sTag = svc.score(tagOnly, 'pasta');
  assert(sTag.breakdown.matchingTagCount === 1, 'tag-only should have one matching tag');
  assert(
    sDesc.total > sTag.total,
    `description-only (${sDesc.total}) must outrank tag-only (${sTag.total})`,
  );

  // And full ordering: name > description > tags
  const sortedAll = svc.sortByRelevance([tagOnly, descOnly, nameOnly], 'pasta');
  assert(
    JSON.stringify(ids(sortedAll)) === JSON.stringify(['name-only', 'desc-only', 'tag-only']),
    `expected [name-only, desc-only, tag-only], got ${JSON.stringify(ids(sortedAll))}`,
  );
}

/**
 * AC-4: Unit tests verifican el ordenamiento para distintos escenarios de búsqueda
 *
 * Multiple ordering scenarios:
 *   (a) Mixed match types: combined matches accumulate.
 *   (b) No match: total = 0; recipes preserve original order.
 *   (c) Multiple tag matches add up but stay below a single name match.
 *   (d) Empty / whitespace-only query: every recipe scores 0, original order preserved.
 *   (e) Case-insensitive matching.
 *   (f) Stable sort on ties (equal score → original order preserved).
 */
export async function test_ordering_scenarios(): Promise<void> {
  const svc = new RecipeScoringService();

  // (a) Combined match: name + description + 2 tags
  const fullMatch = buildRecipe({
    id: 'full',
    slug: 'full',
    name: 'Pasta al pesto',
    description: 'Pasta italiana con albahaca fresca.',
    tags: ['pasta', 'italiano'],
  });
  const s = svc.score(fullMatch, 'pasta');
  assert(s.breakdown.nameMatch && s.breakdown.descriptionMatch, '(a) name & desc match expected');
  assert(s.breakdown.matchingTagCount === 1, '(a) one matching tag expected ("pasta")');
  const expectedTotal =
    RecipeScoringService.WEIGHTS.nameMatch +
    RecipeScoringService.WEIGHTS.descriptionMatch +
    RecipeScoringService.WEIGHTS.perMatchingTag;
  assert(
    s.total === expectedTotal,
    `(a) total must equal sum of weights — got ${s.total}, expected ${expectedTotal}`,
  );

  // (b) No match → 0; sort preserves original order.
  const irrelevant1 = buildRecipe({ id: 'irr1', slug: 'irr1', name: 'Tarta', tags: [] });
  const irrelevant2 = buildRecipe({ id: 'irr2', slug: 'irr2', name: 'Ensalada', tags: [] });
  assert(svc.score(irrelevant1, 'pasta').total === 0, '(b) no-match must score 0');
  const sortedNoHits = svc.sortByRelevance([irrelevant1, irrelevant2], 'pasta');
  assert(
    JSON.stringify(ids(sortedNoHits)) === JSON.stringify(['irr1', 'irr2']),
    '(b) no-match must preserve original order',
  );

  // (c) Multiple tag matches still below a single name match.
  const manyTags = buildRecipe({
    id: 'many-tags',
    slug: 'many-tags',
    name: 'Ensalada',
    description: null,
    tags: ['pasta-fría', 'sin-pasta', 'pasta-corta'],
  });
  const oneName = buildRecipe({
    id: 'one-name',
    slug: 'one-name',
    name: 'Pasta',
    description: null,
    tags: [],
  });
  const sortedTagsVsName = svc.sortByRelevance([manyTags, oneName], 'pasta');
  assert(
    sortedTagsVsName[0].id === 'one-name',
    `(c) single name match must beat ${svc.score(manyTags, 'pasta').breakdown.matchingTagCount} tag matches`,
  );

  // (d) Empty / whitespace-only query → every recipe scores 0 and original order is preserved.
  for (const empty of ['', '   ', '\t\n']) {
    for (const r of [fullMatch, irrelevant1, manyTags]) {
      const sc = svc.score(r, empty);
      assert(
        sc.total === 0 && !sc.breakdown.nameMatch && !sc.breakdown.descriptionMatch,
        `(d) empty query "${JSON.stringify(empty)}" must score 0 — got ${sc.total}`,
      );
    }
    const original = [fullMatch, irrelevant1, manyTags];
    const sortedEmpty = svc.sortByRelevance(original, empty);
    assert(
      JSON.stringify(ids(sortedEmpty)) === JSON.stringify(ids(original)),
      `(d) empty query "${JSON.stringify(empty)}" must preserve original order`,
    );
  }

  // (e) Case-insensitive matching.
  const upperName = buildRecipe({ id: 'cap', slug: 'cap', name: 'PASTA CON QUESO' });
  assert(svc.score(upperName, 'pasta').breakdown.nameMatch, '(e) uppercase name must match lowercase query');
  assert(svc.score(upperName, 'PASTA').breakdown.nameMatch, '(e) uppercase query must match name');

  // (f) Stable sort on ties.
  const a = buildRecipe({ id: 'a', slug: 'a', name: 'Pasta A' });
  const b = buildRecipe({ id: 'b', slug: 'b', name: 'Pasta B' });
  const c = buildRecipe({ id: 'c', slug: 'c', name: 'Pasta C' });
  // All three score equal (name match only). Stable sort must preserve input order.
  const stable1 = svc.sortByRelevance([a, b, c], 'pasta');
  assert(
    JSON.stringify(ids(stable1)) === JSON.stringify(['a', 'b', 'c']),
    '(f) stable sort must preserve original order on ties (abc)',
  );
  const stable2 = svc.sortByRelevance([c, a, b], 'pasta');
  assert(
    JSON.stringify(ids(stable2)) === JSON.stringify(['c', 'a', 'b']),
    '(f) stable sort must preserve original order on ties (cab)',
  );

  // (g) Bonus: full mixed-bag sort — name+desc+tags should beat name-only,
  // name-only should beat desc-only, desc-only should beat tag-only.
  const T = {
    nameAndDesc: buildRecipe({
      id: 't1',
      slug: 't1',
      name: 'Pasta carbonara',
      description: 'Pasta italiana cremosa.',
      tags: [],
    }),
    nameOnly: buildRecipe({
      id: 't2',
      slug: 't2',
      name: 'Pasta al pomodoro',
      description: 'Salsa de tomate.',
      tags: [],
    }),
    descOnly: buildRecipe({
      id: 't3',
      slug: 't3',
      name: 'Tortilla de papas',
      description: 'Acompañar con pasta de tomate.',
      tags: [],
    }),
    tagOnly: buildRecipe({
      id: 't4',
      slug: 't4',
      name: 'Sopa de verduras',
      description: null,
      tags: ['pasta'],
    }),
    none: buildRecipe({ id: 't5', slug: 't5', name: 'Tarta de manzana', tags: [] }),
  };
  const sortedMix = svc.sortByRelevance(
    [T.tagOnly, T.none, T.descOnly, T.nameAndDesc, T.nameOnly],
    'pasta',
  );
  assert(
    JSON.stringify(ids(sortedMix)) === JSON.stringify(['t1', 't2', 't3', 't4', 't5']),
    `(g) mixed-bag sort wrong — got ${JSON.stringify(ids(sortedMix))}`,
  );
}

// ── Runner ──────────────────────────────────────────────────────────────

const ALL_TESTS: Record<string, () => Promise<void>> = {
  test_service_lives_in_domain_services,
  test_no_infra_dependencies,
  test_name_match_outranks_description_match,
  test_ordering_scenarios,
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
