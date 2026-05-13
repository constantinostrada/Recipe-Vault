/**
 * src/application/dtos/RecipeDto.ts
 *
 * Data Transfer Objects for Recipe use-case inputs and outputs.
 * DTOs are plain objects — no domain logic, no ORM types.
 *
 * Imports: application and domain (for types only).
 */

import type { DifficultyLevelValue } from '@/domain/value-objects/DifficultyLevel';

// ── Output DTOs (returned by use cases) ────────────────────────────────────

export interface RecipeIngredientDto {
  id: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  notes: string | null;
}

export interface RecipeStepDto {
  id: string;
  stepNumber: number;
  instruction: string;
  durationMin: number | null;
}

export interface RecipeDto {
  id: string;
  title: string;
  description: string | null;
  servings: number;
  prepTimeMin: number;
  cookTimeMin: number;
  totalTimeMin: number;
  difficulty: DifficultyLevelValue;
  isPublic: boolean;
  authorId: string;
  ingredients: RecipeIngredientDto[];
  steps: RecipeStepDto[];
  tags: string[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface RecipeSummaryDto {
  id: string;
  title: string;
  description: string | null;
  servings: number;
  totalTimeMin: number;
  difficulty: DifficultyLevelValue;
  isPublic: boolean;
  authorId: string;
  tags: string[];
  createdAt: string;
}

export interface PaginatedRecipesDto {
  data: RecipeSummaryDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ── Input DTOs (received by use cases) ─────────────────────────────────────

export interface CreateRecipeIngredientInput {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  notes?: string;
}

export interface CreateRecipeStepInput {
  stepNumber: number;
  instruction: string;
  durationMin?: number;
}

export interface CreateRecipeInput {
  title: string;
  description?: string;
  servings: number;
  prepTimeMin: number;
  cookTimeMin: number;
  difficulty: string;
  isPublic?: boolean;
  authorId: string;
  ingredients: CreateRecipeIngredientInput[];
  steps: CreateRecipeStepInput[];
  tags?: string[];
}

export interface UpdateRecipeInput {
  recipeId: string;
  requestingUserId: string;
  title?: string;
  description?: string | null;
  servings?: number;
  prepTimeMin?: number;
  cookTimeMin?: number;
  difficulty?: string;
}

export interface GetRecipeInput {
  recipeId: string;
  requestingUserId?: string;
}

export interface ListRecipesInput {
  authorId?: string;
  isPublic?: boolean;
  tags?: string[];
  difficulty?: string;
  searchTerm?: string;
  page?: number;
  pageSize?: number;
  requestingUserId?: string;
}

export interface DeleteRecipeInput {
  recipeId: string;
  requestingUserId: string;
}

export interface PublishRecipeInput {
  recipeId: string;
  requestingUserId: string;
}
