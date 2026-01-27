# Example: Next.js Application

Template for applying AIDF to a Next.js full-stack application.

## AGENTS.md Template

```markdown
# AGENTS.md

## Project Overview

[App Name] is a Next.js application that [purpose].

## Architecture

### Directory Structure

\`\`\`
src/
├── app/                    # App Router pages and layouts
│   ├── (auth)/             # Auth-required routes
│   ├── (public)/           # Public routes
│   ├── api/                # API routes
│   └── layout.tsx          # Root layout
├── components/
│   ├── ui/                 # Generic UI components
│   └── features/           # Feature-specific components
├── lib/                    # Utilities and helpers
│   ├── api/                # API client functions
│   ├── auth/               # Auth utilities
│   └── db/                 # Database utilities
├── hooks/                  # Custom React hooks
└── types/                  # TypeScript types
\`\`\`

### Key Patterns

**Server Components by Default**
All components are Server Components unless they need interactivity.
Use 'use client' directive only when necessary.

**Data Fetching**
- Server Components: Direct database/API calls
- Client Components: React Query for caching
- API Routes: For mutations and external API proxying

**Authentication**
Using [NextAuth.js / Clerk / Custom] for authentication.
Protected routes use middleware at `src/middleware.ts`.

## Technology Stack

| Category | Technology | Notes |
|----------|------------|-------|
| Framework | Next.js 14 | App Router |
| Language | TypeScript | Strict mode |
| Styling | Tailwind CSS | With custom config |
| Database | [Prisma / Drizzle] | [PostgreSQL / etc] |
| Auth | [NextAuth / Clerk] | |
| Testing | Vitest + Playwright | Unit + E2E |

## Conventions

### File Naming

| Type | Convention | Example |
|------|------------|---------|
| Pages | kebab-case folder | `app/user-profile/page.tsx` |
| Components | PascalCase | `UserProfile.tsx` |
| Utilities | camelCase | `formatDate.ts` |
| API Routes | kebab-case | `app/api/user-data/route.ts` |

### Component Patterns

\`\`\`tsx
// Server Component (default)
async function UserList() {
  const users = await db.user.findMany();
  return <ul>{users.map(...)}</ul>;
}

// Client Component (when needed)
'use client';
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
\`\`\`

## Boundaries

### Never Modify

- `src/middleware.ts` (auth middleware)
- `prisma/schema.prisma` (without migration plan)
- `.env*` files

### Requires Discussion

- New API routes
- Database schema changes
- Authentication logic changes
- New dependencies

## Commands

\`\`\`bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm test         # Run unit tests
pnpm test:e2e     # Run E2E tests
pnpm db:migrate   # Run migrations
pnpm db:studio    # Open Prisma Studio
\`\`\`
```

## Typical Tasks

### Add New Page

```markdown
## Goal
Create the /dashboard page with user stats and recent activity.

## Scope
### Allowed
- src/app/dashboard/**
- src/components/features/dashboard/**

### Forbidden
- src/lib/db/** (use existing queries)
- src/app/api/** (use existing endpoints)
```

### Add API Endpoint

```markdown
## Goal
Create POST /api/users endpoint for user creation.

## Scope
### Allowed
- src/app/api/users/route.ts
- src/lib/api/users.ts
- src/types/user.ts

### Forbidden
- prisma/schema.prisma (schema already exists)
- src/middleware.ts
```

## Role Customizations

### Developer Role Addition

```markdown
## Next.js Specific

- Prefer Server Components unless interactivity required
- Use 'use client' directive at file top, not inline
- Data fetching in Server Components, not useEffect
- Use next/image for all images
- Use next/link for all internal links
```
