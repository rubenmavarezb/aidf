# AGENTS.md

> Node.js REST API - AI assistant context document.

---

## Identity

This project is a Node.js REST API built with Express, TypeScript, and Prisma ORM following a layered architecture.

IMPORTANT: This document defines the single source of truth for AI assistants working on this project.

---

## Project Overview

A Node.js REST API using Express with TypeScript, following a layered architecture pattern (Routes, Controllers, Services, Repositories).

**Key characteristics:**

- Layered architecture with dependency injection
- Zod-based request validation
- Prisma ORM for database access
- OpenAPI/Swagger auto-generated docs

**Target users:**

- Frontend applications consuming the API
- Developers maintaining the codebase

---

## Architecture

### Directory Structure

```
src/
├── api/                    # API layer
│   ├── routes/             # Route definitions
│   ├── controllers/        # Request handlers
│   ├── middlewares/         # Express middlewares
│   └── validators/         # Zod request validation
├── services/               # Business logic
├── repositories/           # Data access
├── models/                 # Database models
├── utils/                  # Utilities
├── types/                  # TypeScript types
└── config/                 # Configuration
```

---

## Technology Stack

| Category | Technology | Version | Notes |
|----------|------------|---------|-------|
| Runtime | Node.js | 20.x | LTS |
| Framework | Express | 4.x | With TypeScript |
| Language | TypeScript | 5.x | Strict mode |
| Database | PostgreSQL | 15.x | Via Prisma |
| Validation | Zod | 3.x | Request/response schemas |
| Testing | Vitest | Latest | Unit + Integration |
| Docs | Swagger | Latest | OpenAPI auto-generated |
| Package Manager | pnpm | 8.x | - |

---

## Commands

### Development

| Command | Description | When to Run |
|---------|-------------|-------------|
| `pnpm install` | Install all dependencies | After cloning, after pulling changes that modify `package.json` |
| `pnpm dev` | Start server with hot reload (nodemon) | When starting local development |
| `pnpm db:migrate` | Run Prisma database migrations | After pulling changes with new migrations |
| `pnpm db:seed` | Seed database with test data | After initial setup or database reset |
| `pnpm docs` | Generate OpenAPI/Swagger documentation | After adding or modifying API endpoints |

### Quality Checks

CRITICAL: These MUST pass before marking any task complete.

| Command | Description | When to Run |
|---------|-------------|-------------|
| `pnpm lint` | Run ESLint | Before every commit, after code changes |
| `pnpm typecheck` | Run TypeScript compiler checks | Before every commit, after code changes |
| `pnpm test` | Run Vitest unit tests | Before every commit, after code changes |
| `pnpm test:int` | Run integration tests against test database | Before merging to main, after service/repository changes |

### Build & Deploy

| Command | Description | When to Run |
|---------|-------------|-------------|
| `pnpm build` | Compile TypeScript to JavaScript | Before deploying, to verify compilation succeeds |
| `pnpm start` | Run compiled JavaScript in production mode | After building, to test production behavior |
| `pnpm db:migrate:deploy` | Run migrations in production mode | During deployment pipeline |

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `Module not found` after pulling | New dependencies added by another developer | `pnpm install` |
| Prisma Client outdated errors | Schema changed but client not regenerated | `pnpm db:migrate` or `npx prisma generate` |
| Port 3000 already in use | Another process using the port | `lsof -ti:3000 \| xargs kill` then `pnpm dev` |
| `ECONNREFUSED` on database | PostgreSQL not running or wrong connection string | Start PostgreSQL service, verify `DATABASE_URL` in `.env` |
| Integration tests fail unexpectedly | Test database out of sync | `pnpm db:migrate` on test database, then `pnpm test:int` |
| Swagger docs not updating | OpenAPI spec needs regeneration | `pnpm docs` after modifying route decorators |

### Command Sequences

**Initial Setup**

```bash
pnpm install              # Install dependencies
cp .env.example .env      # Create environment file (then fill in values)
pnpm db:migrate           # Run database migrations
pnpm db:seed              # Seed with test data
pnpm dev                  # Start development server
```

**Pre-Commit Verification**

```bash
pnpm lint                 # Check linting rules
pnpm typecheck            # Verify type safety
pnpm test                 # Run unit tests
pnpm build                # Ensure TypeScript compiles
```

**Add New Endpoint**

```bash
# After creating route, controller, service, and repository files:
pnpm typecheck            # Verify types
pnpm test                 # Run unit tests
pnpm test:int             # Run integration tests
pnpm docs                 # Regenerate OpenAPI docs
```

**Database Schema Change**

```bash
# After editing prisma/schema.prisma:
npx prisma migrate dev --name describe_change   # Create and apply migration
npx prisma generate                              # Regenerate Prisma Client
pnpm typecheck                                   # Verify types still pass
pnpm test:int                                    # Run integration tests
```

**Reset Development Environment**

```bash
rm -rf node_modules dist
pnpm install              # Fresh dependency install
npx prisma migrate reset  # Reset database and re-seed
pnpm dev                  # Start clean
```

---

## Conventions

IMPORTANT: Match these patterns EXACTLY when writing new code. Deviations will be rejected.

### File Naming

| Type | Pattern | Example | Wrong |
|------|---------|---------|-------|
| Routes | kebab-case | `user-routes.ts` | `UserRoutes.ts` |
| Controllers | PascalCase | `UserController.ts` | `user-controller.ts` |
| Services | PascalCase | `UserService.ts` | `user-service.ts` |
| Repositories | PascalCase | `UserRepository.ts` | `user-repo.ts` |
| Validators | kebab-case | `user-validator.ts` | `UserValidator.ts` |

### Code Style

#### Controller Pattern

```typescript
// ✅ CORRECT - Controller only handles HTTP, delegates to service
export class UserController {
  constructor(private userService: UserService) {}

  async getUser(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await this.userService.findById(req.params.id);
      res.json({ data: user });
    } catch (error) {
      next(error);
    }
  }
}

// ❌ WRONG - Controller contains business logic and database access
export class UserController {
  async getUser(req: Request, res: Response) {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
      res.status(404).json({ message: 'not found' });
      return;
    }
    if (user.role !== 'admin') {
      res.status(403).json({ message: 'forbidden' });
      return;
    }
    res.json(user);
  }
}
```

Why: Controllers that contain business logic and data access become untestable monoliths. Delegating to services enables unit testing and reuse.

#### Error Handling

```typescript
// ✅ CORRECT - Custom error class with status code and context
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 404, 'NOT_FOUND');
  }
}

// Usage in service
const user = await this.userRepo.findById(id);
if (!user) throw new NotFoundError('User', id);

// ❌ WRONG - Throwing generic errors or using res directly in services
throw new Error('User not found');
// or
res.status(404).json({ error: 'not found' });  // res inside a service
```

Why: Custom error classes let the global error handler produce consistent API responses. Services must not depend on Express request/response objects.

#### Request Validation

```typescript
// ✅ CORRECT - Zod schema with typed output, validated in middleware
import { z } from 'zod';

export const createUserSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    role: z.enum(['admin', 'member']),
  }),
});

export type CreateUserInput = z.infer<typeof createUserSchema>['body'];

// In route
router.post('/users', validate(createUserSchema), controller.createUser);

// ❌ WRONG - Manual validation inside controller
async createUser(req: Request, res: Response) {
  if (!req.body.name || !req.body.email) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  if (!req.body.email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  // ...
}
```

Why: Schema-based validation is declarative, reusable, and automatically generates TypeScript types. Manual checks are inconsistent and error-prone.

#### Async Route Handlers

```typescript
// ✅ CORRECT - Errors forwarded to Express error handler via next()
async getUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await this.userService.findById(req.params.id);
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
}

// ❌ WRONG - Unhandled promise rejection, no try/catch
async getUser(req: Request, res: Response) {
  const user = await this.userService.findById(req.params.id);
  res.json({ data: user });
}
```

Why: Without try/catch and next(), async errors crash the process instead of reaching the global error handler.

#### Service Layer Pattern

```typescript
// ✅ CORRECT - Service with injected dependencies and return types
export class OrderService {
  constructor(
    private orderRepo: OrderRepository,
    private productRepo: ProductRepository
  ) {}

  async createOrder(input: CreateOrderInput): Promise<Order> {
    const product = await this.productRepo.findById(input.productId);
    if (!product) throw new NotFoundError('Product', input.productId);

    if (product.stock < input.quantity) {
      throw new ValidationError('Insufficient stock');
    }

    return this.orderRepo.create({
      productId: product.id,
      quantity: input.quantity,
      total: product.price * input.quantity,
    });
  }
}

// ❌ WRONG - Service with direct Prisma access and no dependency injection
export async function createOrder(input: any) {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
  });
  const order = await prisma.order.create({
    data: { ...input, total: product.price * input.quantity },
  });
  return order;
}
```

Why: Dependency injection enables unit testing with mocks and enforces the repository boundary. Direct ORM access in services couples business logic to the database.

---

## Boundaries

### Never Modify

- `src/config/` (environment config)
- `prisma/schema.prisma` (without migration plan)
- `src/api/middlewares/auth.ts` (auth middleware)

### Requires Discussion

- New database tables/columns
- Authentication changes
- New external service integrations
- API versioning changes

---

IMPORTANT: Update this document when patterns change or decisions are made.
