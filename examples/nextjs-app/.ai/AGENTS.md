# AGENTS.md

> Next.js Application - AI assistant context document.

---

## Identity

This project is a Next.js full-stack application using the App Router, TypeScript, and Tailwind CSS.

IMPORTANT: This document defines the single source of truth for AI assistants working on this project.

---

## Project Overview

A Next.js 14 application using the App Router with Server Components, Prisma ORM, and Tailwind CSS for styling.

**Key characteristics:**

- Server Components by default
- App Router with file-based routing
- Prisma for database access
- Tailwind CSS for styling

**Target users:**

- End users of the web application
- Developers maintaining the codebase

---

## Architecture

### Directory Structure

```
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
```

---

## Technology Stack

| Category | Technology | Version | Notes |
|----------|------------|---------|-------|
| Framework | Next.js | 14.x | App Router |
| Language | TypeScript | 5.x | Strict mode |
| Styling | Tailwind CSS | 3.x | With custom config |
| Database | Prisma | 5.x | PostgreSQL |
| Testing | Vitest + Playwright | Latest | Unit + E2E |
| Package Manager | pnpm | 8.x | - |

---

## Commands

### Development

| Command | Description | When to Run |
|---------|-------------|-------------|
| `pnpm install` | Install all dependencies | After cloning, after pulling changes that modify `package.json` |
| `pnpm dev` | Start dev server on localhost:3000 | When starting local development |
| `pnpm db:migrate` | Run Prisma database migrations | After pulling changes with new migrations, after creating a migration |
| `pnpm db:studio` | Open Prisma Studio GUI | When inspecting or editing database records manually |
| `pnpm db:seed` | Seed database with sample data | After initial setup or database reset |

### Quality Checks

CRITICAL: These MUST pass before marking any task complete.

| Command | Description | When to Run |
|---------|-------------|-------------|
| `pnpm lint` | Run ESLint | Before every commit, after code changes |
| `pnpm typecheck` | Run TypeScript compiler checks | Before every commit, after code changes |
| `pnpm test` | Run Vitest unit tests | Before every commit, after code changes |
| `pnpm test:e2e` | Run Playwright E2E tests | Before merging to main, after UI changes |

### Build & Deploy

| Command | Description | When to Run |
|---------|-------------|-------------|
| `pnpm build` | Create production build | Before deploying, to verify build succeeds |
| `pnpm start` | Start production server | After building, to test production behavior locally |
| `pnpm db:migrate:deploy` | Run migrations in production mode | During deployment pipeline |

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `Module not found` after pulling | New dependencies added by another developer | `pnpm install` |
| Prisma Client outdated errors | Schema changed but client not regenerated | `pnpm db:migrate` or `npx prisma generate` |
| Port 3000 already in use | Another process using the port | `lsof -ti:3000 \| xargs kill` then `pnpm dev` |
| Hydration mismatch errors | Server/client HTML mismatch | Ensure `'use client'` directive is present on interactive components |
| `ECONNREFUSED` on database | PostgreSQL not running | Start PostgreSQL service, verify `DATABASE_URL` in `.env` |

### Command Sequences

**Initial Setup**

```bash
pnpm install          # Install dependencies
cp .env.example .env  # Create environment file (then fill in values)
pnpm db:migrate       # Run database migrations
pnpm db:seed          # Seed with sample data
pnpm dev              # Start development server
```

**Pre-Commit Verification**

```bash
pnpm lint             # Check linting rules
pnpm typecheck        # Verify type safety
pnpm test             # Run unit tests
pnpm build            # Ensure production build works
```

**Database Schema Change**

```bash
# After editing prisma/schema.prisma:
npx prisma migrate dev --name describe_change   # Create and apply migration
npx prisma generate                              # Regenerate Prisma Client
pnpm typecheck                                   # Verify types still pass
```

**Reset Development Environment**

```bash
rm -rf node_modules .next
pnpm install          # Fresh dependency install
npx prisma migrate reset  # Reset database and re-seed
pnpm dev              # Start clean
```

---

## Conventions

IMPORTANT: Match these patterns EXACTLY when writing new code. Deviations will be rejected.

### File Naming

| Type | Pattern | Example | Wrong |
|------|---------|---------|-------|
| Pages | kebab-case folder | `app/user-profile/page.tsx` | `app/UserProfile/page.tsx` |
| Components | PascalCase | `UserProfile.tsx` | `user-profile.tsx` |
| Utilities | camelCase | `formatDate.ts` | `FormatDate.ts` |
| API Routes | kebab-case | `app/api/user-data/route.ts` | `app/api/userData/route.ts` |
| Types | PascalCase | `UserProfile.types.ts` | `user-profile-types.ts` |

### Code Style

#### Server vs Client Components

```tsx
// ✅ CORRECT - Server Component (default), async data fetching
async function UserList() {
  const users = await db.user.findMany();
  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}

// ❌ WRONG - Using useEffect for data fetching in a Server Component context
'use client';
function UserList() {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(setUsers);
  }, []);
  return <ul>{users.map(u => <li>{u.name}</li>)}</ul>;
}
```

Why: Server Components eliminate client-side waterfalls, reduce bundle size, and allow direct database access.

#### Client Directive Placement

```tsx
// ✅ CORRECT - 'use client' at the file top, only when needed
'use client';

import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}

// ❌ WRONG - Marking a component as client when it has no interactivity
'use client';

export function StaticCard({ title }: { title: string }) {
  return <div>{title}</div>;
}
```

Why: Unnecessary 'use client' directives increase the JavaScript bundle sent to the browser.

#### Image and Link Usage

```tsx
// ✅ CORRECT - Using next/image and next/link
import Image from 'next/image';
import Link from 'next/link';

export function UserCard({ user }: { user: User }) {
  return (
    <Link href={`/users/${user.id}`}>
      <Image src={user.avatar} alt={user.name} width={48} height={48} />
      <span>{user.name}</span>
    </Link>
  );
}

// ❌ WRONG - Using raw HTML tags
export function UserCard({ user }: { user: User }) {
  return (
    <a href={`/users/${user.id}`}>
      <img src={user.avatar} alt={user.name} />
      <span>{user.name}</span>
    </a>
  );
}
```

Why: next/image provides automatic optimization, lazy loading, and prevents layout shift. next/link enables client-side navigation and prefetching.

#### Error Handling in Server Actions

```tsx
// ✅ CORRECT - Return structured result from server action
'use server';

export async function updateUser(formData: FormData): Promise<ActionResult> {
  try {
    const data = userSchema.parse(Object.fromEntries(formData));
    await db.user.update({ where: { id: data.id }, data });
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.flatten().fieldErrors };
    }
    return { success: false, errors: { _form: ['Failed to update user'] } };
  }
}

// ❌ WRONG - Throwing raw errors from server actions
'use server';

export async function updateUser(formData: FormData) {
  const data = Object.fromEntries(formData);
  await db.user.update({ where: { id: data.id }, data });
}
```

Why: Structured results enable predictable error handling on the client. Unvalidated input and raw throws expose internal details and crash the UI.

#### Type Definitions

```typescript
// ✅ CORRECT - Shared interface in types/ directory
// types/user.ts
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
}

// ❌ WRONG - Inline types repeated across files
export function UserCard({ user }: { user: { id: string; name: string; email: string } }) {
  return <div>{user.name}</div>;
}
```

Why: Centralized types prevent drift between components and make refactoring safer.

---

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

---

IMPORTANT: Update this document when patterns change or decisions are made.
