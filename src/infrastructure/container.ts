/**
 * src/infrastructure/container.ts
 *
 * Dependency Injection container (manual composition root).
 *
 * This is the ONLY place where concrete infrastructure classes are wired
 * to their use cases.  Everything in application/ and domain/ only knows
 * about interfaces — never about these concrete classes.
 *
 * Usage in Next.js route handlers:
 *
 *   import { container } from '@/infrastructure/container';
 *   const result = await container.createRecipeUseCase.execute(input);
 *
 * Note: All repositories and use cases are instantiated once per request
 * because Next.js route handlers run in a serverless context.  For a
 * long-running server you would use a proper IoC library.
 */

import { CreateRecipeUseCase } from '@/application/use-cases/recipe/CreateRecipeUseCase';
import { DeleteRecipeUseCase } from '@/application/use-cases/recipe/DeleteRecipeUseCase';
import { GetRecipeUseCase } from '@/application/use-cases/recipe/GetRecipeUseCase';
import { GetRecipeBySlugUseCase } from '@/application/use-cases/recipe/GetRecipeBySlugUseCase';
import { ListRecipesUseCase } from '@/application/use-cases/recipe/ListRecipesUseCase';
import { PublishRecipeUseCase } from '@/application/use-cases/recipe/PublishRecipeUseCase';
import { SearchRecipesUseCase } from '@/application/use-cases/recipe/SearchRecipesUseCase';
import { UpdateRecipeUseCase } from '@/application/use-cases/recipe/UpdateRecipeUseCase';
import { GetUserProfileUseCase } from '@/application/use-cases/user/GetUserProfileUseCase';
import { UpdateUserProfileUseCase } from '@/application/use-cases/user/UpdateUserProfileUseCase';
import { AddFavoriteUseCase } from '@/application/use-cases/favorite/AddFavoriteUseCase';
import { RemoveFavoriteUseCase } from '@/application/use-cases/favorite/RemoveFavoriteUseCase';
import { ListUserFavoritesUseCase } from '@/application/use-cases/favorite/ListUserFavoritesUseCase';

import { PrismaRecipeRepository } from './repositories/PrismaRecipeRepository';
import { PrismaUserRepository } from './repositories/PrismaUserRepository';
import { PrismaFavoriteRecipeRepository } from './repositories/PrismaFavoriteRecipeRepository';

function buildContainer() {
  // ── Repositories ───────────────────────────────────────────────────────
  const recipeRepository = new PrismaRecipeRepository();
  const userRepository = new PrismaUserRepository();
  const favoriteRecipeRepository = new PrismaFavoriteRecipeRepository();

  // ── Use cases ──────────────────────────────────────────────────────────
  return {
    // Recipe
    createRecipeUseCase: new CreateRecipeUseCase(recipeRepository),
    getRecipeUseCase: new GetRecipeUseCase(recipeRepository),
    getRecipeBySlugUseCase: new GetRecipeBySlugUseCase(recipeRepository),
    listRecipesUseCase: new ListRecipesUseCase(recipeRepository),
    searchRecipesUseCase: new SearchRecipesUseCase(recipeRepository),
    updateRecipeUseCase: new UpdateRecipeUseCase(recipeRepository),
    deleteRecipeUseCase: new DeleteRecipeUseCase(recipeRepository),
    publishRecipeUseCase: new PublishRecipeUseCase(recipeRepository),

    // User
    getUserProfileUseCase: new GetUserProfileUseCase(userRepository),
    updateUserProfileUseCase: new UpdateUserProfileUseCase(userRepository),

    // Favorite
    addFavoriteUseCase: new AddFavoriteUseCase(favoriteRecipeRepository, recipeRepository),
    removeFavoriteUseCase: new RemoveFavoriteUseCase(favoriteRecipeRepository),
    listUserFavoritesUseCase: new ListUserFavoritesUseCase(favoriteRecipeRepository),
  } as const;
}

/**
 * The application-wide container.
 * Import this in route handlers / controllers — never import
 * repositories or use cases directly in interfaces/.
 */
export const container = buildContainer();
