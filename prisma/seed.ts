/**
 * prisma/seed.ts
 *
 * Seeds the database with 10 hand-curated recipes covering all 3 difficulty
 * levels (easy, medium, hard) and a wide spread of tags / cook times.
 *
 * Run with either:
 *   npm run db:seed
 *   npx prisma db seed
 *
 * The script is idempotent: it upserts each recipe by slug and replaces
 * its ingredients / steps wholesale.
 */

import { PrismaClient, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type SeedRecipe = {
  slug: string;
  name: string;
  description: string;
  cookTimeMinutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  imageUrl: string | null;
  ingredients: Array<{ name: string; quantity: number; unit: string }>;
  steps: string[];
};

const RECIPES: SeedRecipe[] = [
  {
    slug: 'classic-spaghetti-al-pomodoro',
    name: 'Classic Spaghetti al Pomodoro',
    description:
      'A simple, elegant Italian pasta dish — the kind that lets great ingredients shine.',
    cookTimeMinutes: 20,
    difficulty: 'easy',
    tags: ['italian', 'vegetarian', 'pasta', 'quick'],
    imageUrl: null,
    ingredients: [
      { name: 'Spaghetti', quantity: 200, unit: 'g' },
      { name: 'Cherry Tomatoes', quantity: 300, unit: 'g' },
      { name: 'Garlic', quantity: 3, unit: 'clove' },
      { name: 'Olive Oil', quantity: 3, unit: 'tbsp' },
      { name: 'Fresh Basil', quantity: 10, unit: 'leaves' },
    ],
    steps: [
      'Bring a large pot of salted water to a boil.',
      'Warm olive oil in a wide pan over medium heat. Add sliced garlic and cook until fragrant, about 2 minutes.',
      'Add halved cherry tomatoes and cook, stirring occasionally, until they burst and form a sauce, about 10 minutes. Season with salt.',
      'Cook spaghetti until al dente. Reserve ½ cup pasta water before draining.',
      'Toss pasta in the sauce with a splash of pasta water. Finish with fresh basil.',
    ],
  },
  {
    slug: 'avocado-toast',
    name: 'Avocado Toast',
    description: 'A 5-minute breakfast staple. Creamy avocado on crisp sourdough.',
    cookTimeMinutes: 5,
    difficulty: 'easy',
    tags: ['breakfast', 'vegetarian', 'quick', 'healthy'],
    imageUrl: null,
    ingredients: [
      { name: 'Sourdough Bread', quantity: 2, unit: 'slice' },
      { name: 'Ripe Avocado', quantity: 1, unit: 'unit' },
      { name: 'Lemon Juice', quantity: 1, unit: 'tsp' },
      { name: 'Flaky Sea Salt', quantity: 1, unit: 'pinch' },
      { name: 'Chili Flakes', quantity: 1, unit: 'pinch' },
    ],
    steps: [
      'Toast the sourdough slices until golden.',
      'Mash the avocado with lemon juice in a bowl until just spreadable.',
      'Spread the avocado on toast. Top with flaky salt and a pinch of chili flakes.',
    ],
  },
  {
    slug: 'caesar-salad',
    name: 'Caesar Salad',
    description: 'Crisp romaine, garlicky croutons, and a creamy anchovy dressing.',
    cookTimeMinutes: 15,
    difficulty: 'easy',
    tags: ['salad', 'american', 'lunch'],
    imageUrl: null,
    ingredients: [
      { name: 'Romaine Lettuce', quantity: 1, unit: 'head' },
      { name: 'Parmesan', quantity: 50, unit: 'g' },
      { name: 'Anchovy Fillets', quantity: 4, unit: 'unit' },
      { name: 'Garlic', quantity: 2, unit: 'clove' },
      { name: 'Egg Yolk', quantity: 1, unit: 'unit' },
      { name: 'Lemon Juice', quantity: 2, unit: 'tbsp' },
      { name: 'Olive Oil', quantity: 100, unit: 'ml' },
      { name: 'Bread Cubes', quantity: 100, unit: 'g' },
    ],
    steps: [
      'Toss bread cubes with oil and toast at 200°C / 400°F for 8 minutes until crisp.',
      'Whisk anchovies, garlic, egg yolk and lemon juice. Stream in olive oil until thick.',
      'Tear romaine and toss with dressing, parmesan shavings and croutons.',
    ],
  },
  {
    slug: 'greek-salad',
    name: 'Greek Salad',
    description: 'A crunchy Mediterranean salad with tomato, cucumber, feta and olives.',
    cookTimeMinutes: 10,
    difficulty: 'easy',
    tags: ['greek', 'salad', 'vegetarian', 'healthy', 'mediterranean'],
    imageUrl: null,
    ingredients: [
      { name: 'Tomato', quantity: 3, unit: 'unit' },
      { name: 'Cucumber', quantity: 1, unit: 'unit' },
      { name: 'Red Onion', quantity: 0.5, unit: 'unit' },
      { name: 'Kalamata Olives', quantity: 50, unit: 'g' },
      { name: 'Feta Cheese', quantity: 100, unit: 'g' },
      { name: 'Olive Oil', quantity: 3, unit: 'tbsp' },
      { name: 'Dried Oregano', quantity: 1, unit: 'tsp' },
    ],
    steps: [
      'Cut tomatoes into wedges and slice cucumber into thick half-moons.',
      'Thinly slice red onion. Combine with tomato, cucumber and olives in a bowl.',
      'Top with a slab of feta. Drizzle with olive oil and sprinkle with oregano.',
    ],
  },
  {
    slug: 'chicken-tikka-masala',
    name: 'Chicken Tikka Masala',
    description: 'Tender marinated chicken in a rich tomato-and-cream curry sauce.',
    cookTimeMinutes: 60,
    difficulty: 'medium',
    tags: ['indian', 'chicken', 'curry', 'spicy', 'dinner'],
    imageUrl: null,
    ingredients: [
      { name: 'Chicken Thighs', quantity: 600, unit: 'g' },
      { name: 'Plain Yogurt', quantity: 200, unit: 'g' },
      { name: 'Garam Masala', quantity: 2, unit: 'tbsp' },
      { name: 'Tomato Passata', quantity: 400, unit: 'g' },
      { name: 'Heavy Cream', quantity: 150, unit: 'ml' },
      { name: 'Onion', quantity: 1, unit: 'unit' },
      { name: 'Ginger', quantity: 20, unit: 'g' },
      { name: 'Garlic', quantity: 4, unit: 'clove' },
    ],
    steps: [
      'Marinate chicken in yogurt, garam masala, grated ginger and garlic for at least 30 minutes.',
      'Char marinated chicken under a hot grill until lightly blackened on the edges.',
      'Sauté diced onion until soft. Add tomato passata and simmer for 15 minutes.',
      'Stir in cream and the grilled chicken. Simmer 10 more minutes until sauce coats the chicken.',
      'Adjust salt. Serve with basmati rice or naan.',
    ],
  },
  {
    slug: 'pad-thai',
    name: 'Pad Thai',
    description: 'Stir-fried rice noodles with shrimp, peanuts and a tangy tamarind sauce.',
    cookTimeMinutes: 30,
    difficulty: 'medium',
    tags: ['thai', 'noodles', 'asian', 'shrimp', 'dinner'],
    imageUrl: null,
    ingredients: [
      { name: 'Rice Noodles', quantity: 200, unit: 'g' },
      { name: 'Shrimp', quantity: 200, unit: 'g' },
      { name: 'Eggs', quantity: 2, unit: 'unit' },
      { name: 'Bean Sprouts', quantity: 100, unit: 'g' },
      { name: 'Roasted Peanuts', quantity: 50, unit: 'g' },
      { name: 'Tamarind Paste', quantity: 2, unit: 'tbsp' },
      { name: 'Fish Sauce', quantity: 2, unit: 'tbsp' },
      { name: 'Palm Sugar', quantity: 2, unit: 'tbsp' },
      { name: 'Lime', quantity: 1, unit: 'unit' },
    ],
    steps: [
      'Soak rice noodles in hot water for 10 minutes until pliable. Drain.',
      'Whisk tamarind, fish sauce and palm sugar to make the pad thai sauce.',
      'Stir-fry shrimp in a hot wok until just pink. Push to the side and scramble in the eggs.',
      'Add noodles and sauce. Toss until noodles absorb the sauce, about 2 minutes.',
      'Off heat, fold in bean sprouts and crushed peanuts. Finish with a squeeze of lime.',
    ],
  },
  {
    slug: 'tonkotsu-ramen',
    name: 'Tonkotsu Ramen',
    description: 'A rich, milky pork-bone broth served over fresh ramen noodles.',
    cookTimeMinutes: 90,
    difficulty: 'medium',
    tags: ['japanese', 'soup', 'asian', 'noodles', 'pork'],
    imageUrl: null,
    ingredients: [
      { name: 'Pork Bones', quantity: 1, unit: 'kg' },
      { name: 'Ramen Noodles', quantity: 400, unit: 'g' },
      { name: 'Soft-Boiled Eggs', quantity: 4, unit: 'unit' },
      { name: 'Spring Onions', quantity: 3, unit: 'unit' },
      { name: 'Garlic', quantity: 5, unit: 'clove' },
      { name: 'Soy Sauce', quantity: 4, unit: 'tbsp' },
      { name: 'Mirin', quantity: 2, unit: 'tbsp' },
    ],
    steps: [
      'Blanch pork bones for 10 minutes, then drain and rinse to remove scum.',
      'Cover bones with water and simmer hard, partially covered, for 75 minutes until milky.',
      'Strain the broth. Whisk in crushed garlic, soy sauce and mirin to taste.',
      'Cook ramen noodles per package directions, drain, and divide into bowls.',
      'Ladle hot broth over noodles. Top with halved soft-boiled eggs and sliced spring onions.',
    ],
  },
  {
    slug: 'beef-wellington',
    name: 'Beef Wellington',
    description: 'A dinner-party showstopper: filet of beef wrapped in mushroom duxelles and puff pastry.',
    cookTimeMinutes: 120,
    difficulty: 'hard',
    tags: ['british', 'beef', 'dinner-party', 'pastry'],
    imageUrl: null,
    ingredients: [
      { name: 'Beef Tenderloin', quantity: 800, unit: 'g' },
      { name: 'Cremini Mushrooms', quantity: 500, unit: 'g' },
      { name: 'Prosciutto', quantity: 200, unit: 'g' },
      { name: 'Puff Pastry', quantity: 500, unit: 'g' },
      { name: 'Egg Yolk', quantity: 2, unit: 'unit' },
      { name: 'Dijon Mustard', quantity: 2, unit: 'tbsp' },
      { name: 'Thyme', quantity: 4, unit: 'sprig' },
    ],
    steps: [
      'Sear the beef tenderloin on all sides until deeply browned. Brush with mustard and chill.',
      'Pulse mushrooms in a food processor; dry-fry until all moisture has evaporated. Cool.',
      'Lay prosciutto on cling film, spread mushroom duxelles, place beef on top, and roll tightly. Chill 30 minutes.',
      'Wrap the parcel in puff pastry; seal edges and brush with egg yolk.',
      'Bake at 200°C / 400°F for 30-35 minutes for medium-rare. Rest 10 minutes before slicing.',
    ],
  },
  {
    slug: 'chocolate-souffle',
    name: 'Chocolate Soufflé',
    description: 'An airy, deeply chocolatey dessert that rises tall and collapses fast — serve immediately.',
    cookTimeMinutes: 45,
    difficulty: 'hard',
    tags: ['french', 'dessert', 'chocolate', 'vegetarian'],
    imageUrl: null,
    ingredients: [
      { name: 'Dark Chocolate', quantity: 200, unit: 'g' },
      { name: 'Butter', quantity: 60, unit: 'g' },
      { name: 'Egg Whites', quantity: 6, unit: 'unit' },
      { name: 'Egg Yolks', quantity: 4, unit: 'unit' },
      { name: 'Caster Sugar', quantity: 100, unit: 'g' },
      { name: 'Cream of Tartar', quantity: 0.5, unit: 'tsp' },
    ],
    steps: [
      'Butter and sugar four ramekins; tap out excess sugar. Preheat oven to 200°C / 400°F.',
      'Melt chocolate with butter over a double boiler. Off the heat, whisk in egg yolks one by one.',
      'Whip egg whites with cream of tartar to soft peaks, then add sugar and whip to stiff glossy peaks.',
      'Fold a third of the whites into the chocolate to lighten, then gently fold in the rest.',
      'Fill ramekins to the rim, run a thumb around the inside edge, and bake 12-14 minutes until risen but jiggly.',
    ],
  },
  {
    slug: 'beef-bourguignon',
    name: 'Beef Bourguignon',
    description: 'A slow-simmered French stew of beef braised in red wine with pearl onions and mushrooms.',
    cookTimeMinutes: 180,
    difficulty: 'hard',
    tags: ['french', 'beef', 'stew', 'dinner-party', 'wine'],
    imageUrl: null,
    ingredients: [
      { name: 'Beef Chuck', quantity: 1.2, unit: 'kg' },
      { name: 'Bacon Lardons', quantity: 200, unit: 'g' },
      { name: 'Red Wine', quantity: 750, unit: 'ml' },
      { name: 'Beef Stock', quantity: 500, unit: 'ml' },
      { name: 'Pearl Onions', quantity: 250, unit: 'g' },
      { name: 'Cremini Mushrooms', quantity: 300, unit: 'g' },
      { name: 'Carrots', quantity: 2, unit: 'unit' },
      { name: 'Garlic', quantity: 4, unit: 'clove' },
      { name: 'Bay Leaf', quantity: 2, unit: 'unit' },
    ],
    steps: [
      'Render bacon in a heavy pot until crisp. Remove and set aside.',
      'Pat beef chunks dry, season, and brown in the bacon fat in batches. Set aside.',
      'Sauté diced carrots and garlic. Deglaze with red wine and reduce by half.',
      'Return beef and bacon. Add stock and bay leaves. Cover and simmer 2 hours, until tender.',
      'In a separate pan, brown pearl onions and mushrooms in butter. Fold into the stew during the last 15 minutes.',
    ],
  },
];

function toIngredientsCreate(
  list: SeedRecipe['ingredients'],
): Prisma.RecipeIngredientCreateWithoutRecipeInput[] {
  return list.map((ing, index) => ({
    name: ing.name,
    quantity: ing.quantity,
    unit: ing.unit,
    order: index + 1,
  }));
}

function toStepsCreate(
  list: SeedRecipe['steps'],
): Prisma.RecipeStepCreateWithoutRecipeInput[] {
  return list.map((instruction, index) => ({
    instruction,
    order: index + 1,
  }));
}

async function seedRecipe(r: SeedRecipe): Promise<void> {
  // Idempotent: nuke children first so re-runs don't accumulate stale rows,
  // then upsert the root and re-create children fresh.
  const existing = await prisma.recipe.findUnique({
    where: { slug: r.slug },
    select: { id: true },
  });

  if (existing) {
    await prisma.recipeIngredient.deleteMany({ where: { recipeId: existing.id } });
    await prisma.recipeStep.deleteMany({ where: { recipeId: existing.id } });
  }

  await prisma.recipe.upsert({
    where: { slug: r.slug },
    update: {
      name: r.name,
      description: r.description,
      cookTimeMinutes: r.cookTimeMinutes,
      difficulty: r.difficulty,
      tags: r.tags,
      imageUrl: r.imageUrl,
      ingredients: { create: toIngredientsCreate(r.ingredients) },
      steps: { create: toStepsCreate(r.steps) },
    },
    create: {
      slug: r.slug,
      name: r.name,
      description: r.description,
      cookTimeMinutes: r.cookTimeMinutes,
      difficulty: r.difficulty,
      tags: r.tags,
      imageUrl: r.imageUrl,
      ingredients: { create: toIngredientsCreate(r.ingredients) },
      steps: { create: toStepsCreate(r.steps) },
    },
  });
}

async function main(): Promise<void> {
  console.info(`🌱  Seeding database with ${RECIPES.length} recipes…`);
  for (const recipe of RECIPES) {
    await seedRecipe(recipe);
    console.info(`   ✓ ${recipe.slug}`);
  }
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
