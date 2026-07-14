/**
 * scripts/assert-comment-use-cases.ts
 *
 * AC harness for the three comment use cases (Add / Delete /
 * ListRecipeComments). Uses in-memory ICommentRepository and minimal
 * IRecipeRepository stubs — mirrors the assert-recipes-endpoint.ts
 * pattern. Covers:
 *
 *   - Add validates body length (1..500 after trim)
 *   - Add resolves recipe by slug; unknown slug → RecipeNotFoundError
 *   - Add persists with userId and recipeId
 *   - List returns DTOs ordered by createdAt DESC
 *   - List unknown slug → RecipeNotFoundError
 *   - Delete by author removes the comment
 *   - Delete by NON-author throws UnauthorizedError (mapped to 403)
 *   - Delete unknown id throws CommentNotFoundError
 *
 * Run all:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-comment-use-cases.ts
 * Run one:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/assert-comment-use-cases.ts <test_name>
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

import { Comment } from '../src/domain/entities/Comment';
import { Recipe } from '../src/domain/entities/Recipe';
import {
  CommentNotFoundError,
  DomainError,
  RecipeNotFoundError,
  UnauthorizedError,
} from '../src/domain/errors/DomainError';
import type { ICommentRepository } from '../src/domain/repositories/ICommentRepository';
import type {
  IRecipeRepository,
  PaginatedResult,
  PaginationOptions,
  RecipeFilters,
} from '../src/domain/repositories/IRecipeRepository';
import { DifficultyLevel } from '../src/domain/value-objects/DifficultyLevel';
import { Slug } from '../src/domain/value-objects/Slug';
import { AddCommentUseCase } from '../src/application/use-cases/comment/AddCommentUseCase';
import { DeleteCommentUseCase } from '../src/application/use-cases/comment/DeleteCommentUseCase';
import { ListRecipeCommentsUseCase } from '../src/application/use-cases/comment/ListRecipeCommentsUseCase';

// ── In-memory repositories ──────────────────────────────────────────────

class InMemoryCommentRepository implements ICommentRepository {
  public comments: Comment[] = [];

  async add(comment: Comment): Promise<void> {
    this.comments.push(comment);
  }

  async findById(id: string): Promise<Comment | null> {
    return this.comments.find((c) => c.id === id) ?? null;
  }

  async findByRecipeId(recipeId: string): Promise<Comment[]> {
    // Domain contract: DESC by createdAt.
    return [...this.comments]
      .filter((c) => c.recipeId === recipeId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async delete(id: string): Promise<void> {
    this.comments = this.comments.filter((c) => c.id !== id);
  }
}

class InMemoryRecipeRepository implements IRecipeRepository {
  constructor(private readonly recipes: Recipe[]) {}
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
    _f: RecipeFilters,
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

// ── Fixtures ────────────────────────────────────────────────────────────

const RECIPE_ID = '11111111-1111-1111-1111-111111111111';

function buildRecipe(): Recipe {
  return Recipe.create({
    id: RECIPE_ID,
    slug: Slug.create('tortilla-de-patatas'),
    name: 'Tortilla',
    description: null,
    cookTimeMinutes: 30,
    difficulty: DifficultyLevel.EASY,
    tags: [],
    imageUrl: null,
    ingredients: [],
    steps: [],
  });
}

function buildSuite() {
  const commentRepo = new InMemoryCommentRepository();
  const recipeRepo = new InMemoryRecipeRepository([buildRecipe()]);
  return {
    commentRepo,
    recipeRepo,
    addUC: new AddCommentUseCase(commentRepo, recipeRepo),
    deleteUC: new DeleteCommentUseCase(commentRepo),
    listUC: new ListRecipeCommentsUseCase(commentRepo, recipeRepo),
  };
}

// ── Test helpers ────────────────────────────────────────────────────────

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

async function expectThrows<T extends Error>(
  fn: () => Promise<unknown>,
  Cls: new (...args: any[]) => T,
  label: string,
): Promise<T> {
  let thrown: unknown;
  try {
    await fn();
  } catch (err) {
    thrown = err;
  }
  if (thrown === undefined) {
    throw new Error(`${label}: expected to throw ${Cls.name}, but did not throw`);
  }
  if (!(thrown instanceof Cls)) {
    const got = thrown instanceof Error ? thrown.constructor.name : typeof thrown;
    throw new Error(`${label}: expected ${Cls.name}, got ${got}`);
  }
  return thrown;
}

// ── Tests ───────────────────────────────────────────────────────────────

export async function test_add_persists_with_userid_and_recipeid(): Promise<void> {
  const { commentRepo, addUC } = buildSuite();
  const dto = await addUC.execute({
    slug: 'tortilla-de-patatas',
    userId: 'user-1',
    body: 'Great recipe!',
  });
  assert(dto.userId === 'user-1', 'DTO.userId should equal authenticated user');
  assert(dto.recipeId === RECIPE_ID, 'DTO.recipeId should resolve from slug');
  assert(dto.body === 'Great recipe!', 'DTO.body should round-trip');
  assert(typeof dto.id === 'string' && dto.id.length > 0, 'DTO.id should be set');
  assert(typeof dto.createdAt === 'string', 'DTO.createdAt should be ISO string');
  assert(commentRepo.comments.length === 1, 'comment should be persisted');
  assert(commentRepo.comments[0].userId === 'user-1', 'persisted userId matches');
  assert(commentRepo.comments[0].recipeId === RECIPE_ID, 'persisted recipeId matches');
}

export async function test_add_rejects_empty_or_too_long_body(): Promise<void> {
  const { addUC } = buildSuite();

  await expectThrows(
    () => addUC.execute({ slug: 'tortilla-de-patatas', userId: 'u1', body: '' }),
    DomainError,
    'empty body',
  );
  await expectThrows(
    () => addUC.execute({ slug: 'tortilla-de-patatas', userId: 'u1', body: '    ' }),
    DomainError,
    'whitespace-only body',
  );
  const tooLong = 'a'.repeat(501);
  await expectThrows(
    () => addUC.execute({ slug: 'tortilla-de-patatas', userId: 'u1', body: tooLong }),
    DomainError,
    'body > 500 chars',
  );

  // Edge: exactly 500 chars after trim must succeed.
  const exactly500 = 'a'.repeat(500);
  const { addUC: addUC2, commentRepo } = buildSuite();
  const dto = await addUC2.execute({
    slug: 'tortilla-de-patatas',
    userId: 'u1',
    body: exactly500,
  });
  assert(dto.body.length === 500, '500-char body should be accepted');
  assert(commentRepo.comments.length === 1, 'exactly-500 body persists');
}

export async function test_add_unknown_slug_throws_recipe_not_found(): Promise<void> {
  const { addUC } = buildSuite();
  await expectThrows(
    () => addUC.execute({ slug: 'does-not-exist', userId: 'u1', body: 'hi' }),
    RecipeNotFoundError,
    'unknown slug',
  );
}

export async function test_list_returns_dtos_ordered_desc(): Promise<void> {
  const { commentRepo, listUC } = buildSuite();

  // Insert out of chronological order to prove ordering, NOT insertion order.
  const c1 = Comment.create({
    id: 'c-old',
    userId: 'u1',
    recipeId: RECIPE_ID,
    body: 'old',
    createdAt: new Date('2026-01-01T10:00:00Z'),
  });
  const c2 = Comment.create({
    id: 'c-new',
    userId: 'u2',
    recipeId: RECIPE_ID,
    body: 'new',
    createdAt: new Date('2026-05-18T10:00:00Z'),
  });
  const c3 = Comment.create({
    id: 'c-middle',
    userId: 'u3',
    recipeId: RECIPE_ID,
    body: 'middle',
    createdAt: new Date('2026-03-15T10:00:00Z'),
  });
  await commentRepo.add(c1);
  await commentRepo.add(c2);
  await commentRepo.add(c3);

  // Also add one on a DIFFERENT recipe — should be excluded.
  const other = Comment.create({
    id: 'c-other',
    userId: 'u1',
    recipeId: '22222222-2222-2222-2222-222222222222',
    body: 'other recipe',
    createdAt: new Date('2026-04-01T10:00:00Z'),
  });
  await commentRepo.add(other);

  const result = await listUC.execute({ slug: 'tortilla-de-patatas' });
  assert(result.length === 3, `expected 3 comments, got ${result.length}`);
  assert(result[0].id === 'c-new', 'first should be newest');
  assert(result[1].id === 'c-middle', 'second should be middle');
  assert(result[2].id === 'c-old', 'third should be oldest');
  for (const dto of result) {
    assert(typeof dto.createdAt === 'string', 'createdAt should be ISO string');
    assert(dto.recipeId === RECIPE_ID, 'should only include matching recipe');
  }
}

export async function test_list_unknown_slug_throws_recipe_not_found(): Promise<void> {
  const { listUC } = buildSuite();
  await expectThrows(
    () => listUC.execute({ slug: 'does-not-exist' }),
    RecipeNotFoundError,
    'list unknown slug',
  );
}

export async function test_delete_by_author_removes_comment(): Promise<void> {
  const { commentRepo, addUC, deleteUC } = buildSuite();
  const created = await addUC.execute({
    slug: 'tortilla-de-patatas',
    userId: 'u1',
    body: 'mine',
  });
  assert(commentRepo.comments.length === 1, 'pre-condition: 1 comment');
  await deleteUC.execute({ commentId: created.id, userId: 'u1' });
  assert(commentRepo.comments.length === 0, 'comment should be removed');
}

export async function test_delete_by_non_author_throws_unauthorized(): Promise<void> {
  const { commentRepo, addUC, deleteUC } = buildSuite();
  const created = await addUC.execute({
    slug: 'tortilla-de-patatas',
    userId: 'author-user',
    body: 'mine',
  });

  const err = await expectThrows(
    () => deleteUC.execute({ commentId: created.id, userId: 'someone-else' }),
    UnauthorizedError,
    'non-author delete must throw UnauthorizedError (mapped to HTTP 403)',
  );
  assert(
    /comment/i.test(err.message),
    'UnauthorizedError message should reference "comment"',
  );
  assert(commentRepo.comments.length === 1, 'comment must remain after rejected delete');
}

export async function test_delete_unknown_id_throws_not_found(): Promise<void> {
  const { deleteUC } = buildSuite();
  await expectThrows(
    () => deleteUC.execute({ commentId: 'no-such-id', userId: 'u1' }),
    CommentNotFoundError,
    'unknown comment id',
  );
}

export async function test_use_cases_live_under_expected_paths(): Promise<void> {
  // Structural check that the 3 use cases sit where the AC requires.
  const { readFileSync } = await import('fs');
  const { join } = await import('path');
  for (const file of [
    'src/application/use-cases/comment/AddCommentUseCase.ts',
    'src/application/use-cases/comment/DeleteCommentUseCase.ts',
    'src/application/use-cases/comment/ListRecipeCommentsUseCase.ts',
  ]) {
    const src = readFileSync(join(process.cwd(), file), 'utf8');
    assert(src.length > 0, `${file} must exist and be non-empty`);
  }

  // Repository interface lives in domain.
  const repoSrc = readFileSync(
    join(process.cwd(), 'src/domain/repositories/ICommentRepository.ts'),
    'utf8',
  );
  assert(
    /interface ICommentRepository/.test(repoSrc),
    'ICommentRepository interface must exist',
  );

  // Prisma impl + DI wiring.
  const prismaImpl = readFileSync(
    join(process.cwd(), 'src/infrastructure/repositories/PrismaCommentRepository.ts'),
    'utf8',
  );
  assert(
    /implements ICommentRepository/.test(prismaImpl),
    'PrismaCommentRepository must implement ICommentRepository',
  );

  const container = readFileSync(
    join(process.cwd(), 'src/infrastructure/container.ts'),
    'utf8',
  );
  assert(
    /PrismaCommentRepository/.test(container) &&
      /addCommentUseCase/.test(container) &&
      /deleteCommentUseCase/.test(container) &&
      /listRecipeCommentsUseCase/.test(container),
    'container must register the comment repository + 3 use cases',
  );

  // Routes exist.
  for (const file of [
    'src/app/api/recipes/[slug]/comments/route.ts',
    'src/app/api/comments/[id]/route.ts',
  ]) {
    const src = readFileSync(join(process.cwd(), file), 'utf8');
    assert(src.length > 0, `${file} must exist`);
  }

  // Migration named add_comments.
  const { readdirSync } = await import('fs');
  const migrations = readdirSync(join(process.cwd(), 'prisma/migrations'));
  assert(
    migrations.some((m) => m.endsWith('_add_comments')),
    'a migration directory ending in _add_comments must exist',
  );

  // Prisma schema declares Comment model.
  const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
  assert(/model Comment\b/.test(schema), 'schema.prisma must declare model Comment');
}

// ── Runner ──────────────────────────────────────────────────────────────

const ALL_TESTS: Record<string, () => Promise<void>> = {
  test_add_persists_with_userid_and_recipeid,
  test_add_rejects_empty_or_too_long_body,
  test_add_unknown_slug_throws_recipe_not_found,
  test_list_returns_dtos_ordered_desc,
  test_list_unknown_slug_throws_recipe_not_found,
  test_delete_by_author_removes_comment,
  test_delete_by_non_author_throws_unauthorized,
  test_delete_unknown_id_throws_not_found,
  test_use_cases_live_under_expected_paths,
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
