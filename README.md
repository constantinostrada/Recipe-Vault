# 🥘 Recipe Vault

A full-stack recipe management application built with **Next.js 14**, **TypeScript**, **Tailwind CSS**, **Prisma**, **PostgreSQL**, and **NextAuth.js** — following **Clean Architecture** principles.

---

## Features

- 🔒 **Authentication** via GitHub and Google OAuth (NextAuth.js)
- 📋 **Create, edit, and delete** recipes with ingredients and steps
- 🌍 **Public/private** recipe visibility
- 🏷️ **Tags** and **difficulty levels** for organisation
- 🔍 **Search and filter** across the recipe library
- 📐 **Clean Architecture** — every file has a clear, enforced responsibility
- 🗄️ **Prisma ORM** with a fully typed PostgreSQL schema

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS 3 |
| Database | PostgreSQL |
| ORM | Prisma 5 |
| Auth | NextAuth.js v4 |
| Validation | Zod |

---

## Getting Started

### 1. Prerequisites

- Node.js ≥ 18
- PostgreSQL (local or via Docker)

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Random secret — run `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Base URL of your app (e.g. `http://localhost:3000`) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth app credentials |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |

### 4. Set up the database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations (creates tables)
npm run db:migrate

# Optional: seed sample data
npm run db:seed
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run type-check` | TypeScript type checking (no emit) |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run format` | Prettier formatting |
| `npm run db:generate` | Re-generate Prisma client after schema changes |
| `npm run db:migrate` | Run pending migrations (dev) |
| `npm run db:migrate:prod` | Run migrations in production |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |
| `npm run db:seed` | Seed the database with sample data |
| `npm run db:reset` | Drop and recreate the database (dev only) |

---

## API Reference

All API routes return `{ success: true, data: ... }` or `{ success: false, error: { message, code } }`.

### Recipes

| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/api/recipes` | Optional | List/search recipes |
| `POST` | `/api/recipes` | Required | Create a recipe |
| `GET` | `/api/recipes/:id` | Optional | Get a recipe by id |
| `PATCH` | `/api/recipes/:id` | Required (author) | Update recipe metadata |
| `DELETE` | `/api/recipes/:id` | Required (author) | Delete a recipe |
| `POST` | `/api/recipes/:id/publish` | Required (author) | Publish a recipe |

#### Query parameters for `GET /api/recipes`

| Param | Type | Description |
|---|---|---|
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Results per page (max: 50, default: 12) |
| `authorId` | string | Filter by author |
| `difficulty` | string | `EASY` \| `MEDIUM` \| `HARD` \| `EXPERT` |
| `tags` | string | Comma-separated tag names |
| `search` | string | Full-text search on title/description |

### Users

| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/api/users/:id` | None | Get a user's public profile |
| `PATCH` | `/api/users/me` | Required | Update own profile |

---

## Project Structure

```
recipe-vault/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Development seed data
├── src/
│   ├── app/                   # Next.js App Router (pages + API routes)
│   │   ├── api/               # Route handlers (thin — delegate to controllers)
│   │   ├── auth/              # Sign-in / error pages
│   │   ├── dashboard/         # Authenticated user dashboard
│   │   ├── recipes/           # Recipe browse + detail + create pages
│   │   └── layout.tsx         # Root layout
│   │
│   ├── domain/                # ← LAYER 1: Business rules
│   ├── application/           # ← LAYER 2: Use cases
│   ├── infrastructure/        # ← LAYER 3: DB, auth, external services
│   ├── interfaces/            # ← LAYER 4: HTTP controllers, UI components
│   └── types/                 # Global TypeScript declarations
│
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## Clean Architecture Layers

This project enforces a strict dependency rule: **dependencies only point inward**.

```
interfaces → application → domain
infrastructure → application → domain
```

### `src/domain/` — The Core

> **Zero knowledge of the outside world.**

Contains all business rules and entities. Nothing in this layer may import from any other layer, use third-party libraries, or access environment variables.

- **Entities** — `Recipe`, `User`, `RecipeIngredient`, `RecipeStep`
- **Value Objects** — `Email`, `DifficultyLevel`, `Slug`
- **Repository Interfaces** — `IRecipeRepository`, `IUserRepository`
- **Domain Services** — `RecipeScoringService`
- **Domain Errors** — `DomainError`, `RecipeNotFoundError`, `UnauthorizedError`, etc.

### `src/application/` — Use Cases

> **Knows WHAT to do, not HOW.**

Each file is a single use case with an `execute(dto)` method. Use cases receive repositories via constructor injection (they only see interfaces) and return DTOs — never raw domain entities.

- **Use Cases** — `CreateRecipeUseCase`, `GetRecipeUseCase`, `UpdateRecipeUseCase`, etc.
- **DTOs** — `RecipeDto`, `RecipeSummaryDto`, `CreateRecipeInput`, etc.
- **Mappers** — `RecipeMapper`, `UserMapper`

### `src/infrastructure/` — Adapters & I/O

> **All I/O lives here.**

Implements interfaces defined in the domain. Contains the Prisma client, repository implementations, and NextAuth configuration. May access `process.env`.

- **Database** — `prisma.ts` (singleton Prisma client)
- **Repositories** — `PrismaRecipeRepository`, `PrismaUserRepository`
- **Auth** — `authOptions.ts` (NextAuth configuration)
- **Container** — `container.ts` (composition root / dependency injection)

### `src/interfaces/` — Entry Points

> **Thin adapters between the outside world and use cases.**

HTTP controllers, React components, and Next.js route handlers live here. Controllers validate input with Zod and call use cases. They never contain business logic and never call repositories directly.

- **Controllers** — `RecipeController`, `UserController`
- **Helpers** — `apiResponse.ts`, `authGuard.ts`
- **Components** — `RecipeCard`, `RecipeGrid`, `RecipeDetail`, `RecipeForm`, `Navbar`
- **Styles** — `globals.css`

---

## Dependency Rules (enforced by ESLint `import/no-cycle`)

| Layer | May import from |
|---|---|
| `domain/` | Only itself |
| `application/` | `domain/` and itself |
| `infrastructure/` | `domain/`, `application/`, itself, and third-party libs |
| `interfaces/` | `application/` and itself |

**Never:**
- Import infrastructure into domain or application
- Put business logic in controllers or route handlers
- Return raw domain entities from use cases
- Use `any` to bypass layer contracts

---

## Contributing

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Follow the layer rules above — if in doubt, read the `CLAUDE.md` in each layer directory
3. Run `npm run type-check && npm run lint` before opening a PR
4. Write your use case in `application/`, your entity logic in `domain/`, and keep controllers thin
