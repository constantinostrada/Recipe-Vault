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

  await prisma.recipe.upsert({
    where: { slug: 'classic-spaghetti-al-pomodoro' },
    update: {},
    create: {
      slug: 'classic-spaghetti-al-pomodoro',
      name: 'Classic Spaghetti al Pomodoro',
      description:
        'A simple, elegant Italian pasta dish — the kind that lets great ingredients shine.',
      cookTimeMinutes: 20,
      difficulty: 'easy',
      tags: ['italian', 'vegetarian', 'quick'],
      imageUrl: null,
      ingredients: {
        create: [
          { name: 'Spaghetti', quantity: 200, unit: 'g', order: 1 },
          { name: 'Cherry Tomatoes', quantity: 300, unit: 'g', order: 2 },
          { name: 'Garlic', quantity: 3, unit: 'clove', order: 3 },
          { name: 'Olive Oil', quantity: 3, unit: 'tbsp', order: 4 },
          { name: 'Fresh Basil', quantity: 10, unit: 'leaves', order: 5 },
        ],
      },
      steps: {
        create: [
          { order: 1, instruction: 'Bring a large pot of salted water to a boil.' },
          {
            order: 2,
            instruction:
              'Warm the olive oil in a wide pan over medium heat. Add sliced garlic and cook until fragrant, about 2 minutes.',
          },
          {
            order: 3,
            instruction:
              'Add halved cherry tomatoes and cook, stirring occasionally, until they burst and form a sauce, about 10 minutes. Season with salt.',
          },
          {
            order: 4,
            instruction:
              'Cook spaghetti according to package directions until al dente. Reserve ½ cup pasta water before draining.',
          },
          {
            order: 5,
            instruction:
              'Add pasta to the sauce with a splash of pasta water. Toss over low heat until coated. Finish with fresh basil.',
          },
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
