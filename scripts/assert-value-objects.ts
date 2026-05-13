/**
 * scripts/assert-value-objects.ts
 *
 * Acceptance-criteria assertions for the Slug and DifficultyLevel
 * value objects. Each `test_*` function corresponds to one AC.
 *
 * Because this script imports from `src/`, ts-node must run in CommonJS mode
 * (the project tsconfig is `module: esnext` / `moduleResolution: bundler`,
 * which only resolves with explicit `.js` extensions in ESM). Override at
 * the CLI:
 *
 *   npx ts-node --transpile-only \
 *     --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
 *     scripts/assert-value-objects.ts [test_name]
 */

import { Slug } from '../src/domain/value-objects/Slug';
import { DifficultyLevel } from '../src/domain/value-objects/DifficultyLevel';
import { DomainError } from '../src/domain/errors/DomainError';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

function expectThrows(fn: () => unknown, expectedType: Function, label: string): void {
  let caught: unknown = null;
  try {
    fn();
  } catch (err) {
    caught = err;
  }
  assert(caught !== null, `${label}: expected to throw, did not`);
  assert(
    caught instanceof expectedType,
    `${label}: expected ${expectedType.name}, got ${(caught as Error)?.constructor?.name}`,
  );
}

// ── AC ac-1: Slug rechaza strings que no cumplan el formato ─────────────────
function test_slug_rejects_invalid_format(): void {
  const invalids: string[] = [
    '',                  // empty
    'Hello-World',       // uppercase
    'hello world',       // whitespace
    'hello_world',       // underscore
    '-hello',            // leading hyphen
    'hello-',            // trailing hyphen
    'hello--world',      // double hyphen
    'hello/world',       // slash
    'café',              // diacritic / non-ASCII
    '   ',               // whitespace only
  ];
  for (const raw of invalids) {
    expectThrows(() => Slug.create(raw), DomainError, `Slug.create("${raw}")`);
  }

  // Sanity: at least one valid form passes
  const ok = Slug.create('chocolate-chip-cookies-v2');
  assert(ok.value === 'chocolate-chip-cookies-v2', 'valid slug should round-trip');
}

// ── AC ac-2: Slug es inmutable — no hay setter ──────────────────────────────
function test_slug_is_immutable(): void {
  const slug = Slug.create('my-recipe');

  // `value` must be a getter with NO setter.
  const desc = Object.getOwnPropertyDescriptor(Slug.prototype, 'value');
  assert(!!desc, 'Slug.prototype.value descriptor must exist');
  assert(typeof desc!.get === 'function', 'Slug.value must be a getter');
  assert(desc!.set === undefined, 'Slug.value must NOT have a setter');

  // No mutator-style methods on the prototype.
  const proto = Slug.prototype;
  const mutators = Object.getOwnPropertyNames(proto).filter(
    (n) => /^set[A-Z]/.test(n) || /^(mutate|change|update|with)/.test(n),
  );
  assert(
    mutators.length === 0,
    `Slug must not expose mutator methods, found: [${mutators.join(', ')}]`,
  );

  // Public constructor must be unreachable (private).
  // (`new Slug(...)` would be a TS error; at runtime the constructor still works,
  //  but the prototype must keep the value untouchable.)
  assert(slug.value === 'my-recipe', 'value getter must return original');

  // Confirm there is no public set-like API: try every own/inherited prop and
  // ensure none of them is a function whose name implies mutation.
  for (const key of Object.getOwnPropertyNames(proto)) {
    if (key === 'constructor') continue;
    if (typeof (proto as Record<string, unknown>)[key] === 'function') {
      assert(
        !/^set/i.test(key),
        `Slug must not expose method "${key}" (smells like a setter)`,
      );
    }
  }
}

// ── AC ac-3: DifficultyLevel sólo acepta valores del enum cerrado ───────────
function test_difficulty_only_accepts_enum(): void {
  // Happy: exactly the closed set.
  for (const ok of ['easy', 'medium', 'hard']) {
    const d = DifficultyLevel.create(ok);
    assert(d.value === ok, `DifficultyLevel.create("${ok}").value === "${ok}"`);
  }

  // Invalid: anything outside the closed enum throws DomainError.
  const invalids: unknown[] = [
    'EASY',              // wrong case (closed enum is lowercase per Prisma schema)
    'Easy',
    'medium ',           // trailing whitespace
    ' easy',
    'expert',            // value removed from the closed enum
    'extreme',
    '',
    'normal',
    'super-hard',
    null,
    undefined,
    42,
  ];
  for (const bad of invalids) {
    expectThrows(
      () => DifficultyLevel.create(bad as string),
      DomainError,
      `DifficultyLevel.create(${JSON.stringify(bad)})`,
    );
  }

  // Static instances must also be from the closed set.
  assert(DifficultyLevel.EASY.value === 'easy', 'static EASY === "easy"');
  assert(DifficultyLevel.MEDIUM.value === 'medium', 'static MEDIUM === "medium"');
  assert(DifficultyLevel.HARD.value === 'hard', 'static HARD === "hard"');
}

// ── AC ac-4: Igualdad por valor (no por referencia) en ambos VOs ────────────
function test_value_equality_both_vos(): void {
  // Slug: two independent instances with the same string are equal.
  const slugA = Slug.create('roast-chicken');
  const slugB = Slug.create('roast-chicken');
  assert(slugA !== slugB, 'sanity: distinct instances (different references)');
  assert(slugA.equals(slugB), 'Slug equality must be by value');
  assert(slugB.equals(slugA), 'Slug equality must be symmetric');

  const slugC = Slug.create('beef-stew');
  assert(!slugA.equals(slugC), 'different slug values must not be equal');

  // DifficultyLevel: two independent instances with the same value are equal.
  const dA = DifficultyLevel.create('medium');
  const dB = DifficultyLevel.create('medium');
  assert(dA !== dB, 'sanity: distinct DifficultyLevel references');
  assert(dA.equals(dB), 'DifficultyLevel equality must be by value');
  assert(dB.equals(dA), 'DifficultyLevel equality must be symmetric');

  const dC = DifficultyLevel.create('hard');
  assert(!dA.equals(dC), 'different difficulty values must not be equal');

  // The static singletons should also equal a freshly-created instance.
  assert(
    DifficultyLevel.EASY.equals(DifficultyLevel.create('easy')),
    'static EASY equals new("easy")',
  );
}

// ── AC ac-5: Unit tests cubren casos felices y casos inválidos ──────────────
// Meta-test: directly executes a representative happy AND invalid example for
// each VO so that both paths are demonstrably under test.
function test_happy_and_invalid_cases(): void {
  // Slug happy path
  const okSlug = Slug.create('my-best-pancakes-2');
  assert(okSlug.value === 'my-best-pancakes-2', 'happy slug round-trip');
  assert(okSlug.toString() === 'my-best-pancakes-2', 'Slug.toString === value');

  // Slug invalid path
  expectThrows(() => Slug.create('Bad Slug!'), DomainError, 'Slug invalid path');

  // DifficultyLevel happy path
  const okDiff = DifficultyLevel.create('hard');
  assert(okDiff.value === 'hard', 'happy difficulty round-trip');
  assert(okDiff.toString() === 'hard', 'DifficultyLevel.toString === value');
  // Comparison method (e.g. isHarderThan) — part of spec
  assert(
    DifficultyLevel.HARD.isHarderThan(DifficultyLevel.EASY),
    'hard isHarderThan easy',
  );
  assert(
    !DifficultyLevel.EASY.isHarderThan(DifficultyLevel.HARD),
    'easy NOT isHarderThan hard',
  );
  assert(
    !DifficultyLevel.MEDIUM.isHarderThan(DifficultyLevel.MEDIUM),
    'medium NOT isHarderThan medium (strict ordering)',
  );

  // DifficultyLevel invalid path
  expectThrows(
    () => DifficultyLevel.create('legendary'),
    DomainError,
    'DifficultyLevel invalid path',
  );
}

const TESTS: Record<string, () => void | Promise<void>> = {
  test_slug_rejects_invalid_format,
  test_slug_is_immutable,
  test_difficulty_only_accepts_enum,
  test_value_equality_both_vos,
  test_happy_and_invalid_cases,
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
