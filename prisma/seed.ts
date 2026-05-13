/**
 * prisma/seed.ts
 *
 * Seeds the database with sample data for local development.
 * Run with: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.info('🌱  Seeding database…');

  // ── Demo user ──────────────────────────────────────────────────────────────
  const user = await prisma.user.upsert({
    where: { email: 'demo@recipe-vault.dev' },
    update: {},
    create: {
      email: 'demo@recipe-vault.dev',
      name: 'Demo Chef',
    },
  });

  // ── Tags ───────────────────────────────────────────────────────────────────
  const [italian, vegetarian, quick] = await Promise.all([
    prisma.tag.upsert({
      where: { slug: 'italian' },
      update: {},
      create: { name: 'Italian', slug: 'italian' },
    }),
    prisma.tag.upsert({
      where: { slug: 'vegetarian' },
      update: {},
      create: { name: 'Vegetarian', slug: 'vegetarian' },
    }),
    prisma.tag.upsert({
      where: { slug: 'quick' },
      update: {},
      create: { name: 'Quick', slug: 'quick' },
    }),
  ]);

  // ── Ingredients ────────────────────────────────────────────────────────────
  const [pasta, tomatoes, garlic, oliveoil, basil] = await Promise.all([
    prisma.ingredient.upsert({
      where: { name: 'Spaghetti' },
      update: {},
      create: { name: 'Spaghetti', unit: 'g' },
    }),
    prisma.ingredient.upsert({
      where: { name: 'Cherry Tomatoes' },
      update: {},
      create: { name: 'Cherry Tomatoes', unit: 'g' },
    }),
    prisma.ingredient.upsert({
      where: { name: 'Garlic' },
      update: {},
      create: { name: 'Garlic', unit: 'clove' },
    }),
    prisma.ingredient.upsert({
      where: { name: 'Olive Oil' },
      update: {},
      create: { name: 'Olive Oil', unit: 'tbsp' },
    }),
    prisma.ingredient.upsert({
      where: { name: 'Fresh Basil' },
      update: {},
      create: { name: 'Fresh Basil', unit: 'leaves' },
    }),
  ]);

  // ── Sample recipe ──────────────────────────────────────────────────────────
  await prisma.recipe.upsert({
    where: { id: 'seed-recipe-001' },
    update: {},
    create: {
      id: 'seed-recipe-001',
      title: 'Classic Spaghetti al Pomodoro',
      description:
        'A simple, elegant Italian pasta dish — the kind that lets great ingredients shine.',
      servings: 2,
      prepTimeMin: 10,
      cookTimeMin: 20,
      difficulty: 'EASY',
      isPublic: true,
      authorId: user.id,
      ingredients: {
        create: [
          { ingredientId: pasta.id, quantity: 200, unit: 'g' },
          { ingredientId: tomatoes.id, quantity: 300, unit: 'g' },
          { ingredientId: garlic.id, quantity: 3, unit: 'clove' },
          { ingredientId: oliveoil.id, quantity: 3, unit: 'tbsp' },
          { ingredientId: basil.id, quantity: 10, unit: 'leaves' },
        ],
      },
      steps: {
        create: [
          {
            stepNumber: 1,
            instruction: 'Bring a large pot of salted water to a boil.',
            durationMin: 5,
          },
          {
            stepNumber: 2,
            instruction:
              'Warm the olive oil in a wide pan over medium heat. Add sliced garlic and cook until fragrant, about 2 minutes.',
            durationMin: 2,
          },
          {
            stepNumber: 3,
            instruction:
              'Add halved cherry tomatoes and cook, stirring occasionally, until they burst and form a sauce, about 10 minutes. Season with salt.',
            durationMin: 10,
          },
          {
            stepNumber: 4,
            instruction:
              'Cook spaghetti according to package directions until al dente. Reserve ½ cup pasta water before draining.',
            durationMin: 8,
          },
          {
            stepNumber: 5,
            instruction:
              'Add pasta to the sauce with a splash of pasta water. Toss over low heat until coated. Finish with fresh basil.',
            durationMin: 2,
          },
        ],
      },
      tags: {
        create: [
          { tagId: italian.id },
          { tagId: vegetarian.id },
          { tagId: quick.id },
        ],
      },
    },
  });

  console.info('✅  Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
