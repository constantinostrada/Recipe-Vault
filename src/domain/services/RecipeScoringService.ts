/**
 * src/domain/services/RecipeScoringService.ts
 *
 * Domain Service: assigns a search-relevance score to a Recipe given a free-text
 * query, and exposes a sort helper for ordering search results.
 *
 * Ranking precedence (highest to lowest):
 *   1. match in recipe.name        (strongest signal)
 *   2. match in recipe.description
 *   3. number of matching tags     (additive, weaker than a single name match)
 *
 * The weights below are chosen so that the ordering invariants hold for any
 * realistic number of tags (a recipe could not plausibly hold >9 matching
 * tags, and even 9 tag hits stay below a single name match).
 *
 * Imports: domain only — zero third-party dependencies (domain/CLAUDE.md rule).
 */

import type { Recipe } from '../entities/Recipe';

export interface RecipeScoreBreakdown {
  nameMatch: boolean;
  descriptionMatch: boolean;
  matchingTagCount: number;
}

export interface RecipeScore {
  recipeId: string;
  total: number;
  breakdown: RecipeScoreBreakdown;
}

export class RecipeScoringService {
  static readonly WEIGHTS = {
    nameMatch: 100,
    descriptionMatch: 25,
    perMatchingTag: 10,
  } as const;

  /**
   * Computes a relevance score for a single recipe against the query.
   * Matching is case-insensitive substring match. An empty/whitespace-only
   * query yields total = 0 and no matches (the caller decides what to do
   * with an unfiltered list).
   */
  score(recipe: Recipe, query: string): RecipeScore {
    const needle = normalise(query);
    if (needle.length === 0) {
      return {
        recipeId: recipe.id,
        total: 0,
        breakdown: { nameMatch: false, descriptionMatch: false, matchingTagCount: 0 },
      };
    }

    const nameMatch = recipe.name.toLowerCase().includes(needle);
    const descriptionMatch =
      recipe.description !== null &&
      recipe.description.toLowerCase().includes(needle);

    let matchingTagCount = 0;
    for (const tag of recipe.tags) {
      if (tag.toLowerCase().includes(needle)) matchingTagCount += 1;
    }

    const total =
      (nameMatch ? RecipeScoringService.WEIGHTS.nameMatch : 0) +
      (descriptionMatch ? RecipeScoringService.WEIGHTS.descriptionMatch : 0) +
      matchingTagCount * RecipeScoringService.WEIGHTS.perMatchingTag;

    return {
      recipeId: recipe.id,
      total,
      breakdown: { nameMatch, descriptionMatch, matchingTagCount },
    };
  }

  /**
   * Returns the recipes sorted by relevance to `query` (descending). Stable
   * on ties: the original relative order is preserved.
   *
   * If the query is empty/whitespace-only every recipe scores zero and the
   * original order is returned unchanged.
   */
  sortByRelevance(recipes: ReadonlyArray<Recipe>, query: string): Recipe[] {
    const decorated = recipes.map((recipe, index) => ({
      recipe,
      index,
      score: this.score(recipe, query).total,
    }));
    decorated.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    });
    return decorated.map((d) => d.recipe);
  }
}

function normalise(query: string): string {
  if (typeof query !== 'string') return '';
  return query.trim().toLowerCase();
}
