# Example: Node.js API

Template for applying AIDF to a Node.js REST/GraphQL API.

## AGENTS.md Template

```markdown
# AGENTS.md

## Project Overview

[API Name] is a Node.js API that [purpose].

## Architecture

### Directory Structure

\`\`\`
src/
├── api/                    # API layer
│   ├── routes/             # Route definitions
│   ├── controllers/        # Request handlers
│   ├── middlewares/        # Express middlewares
│   └── validators/         # Request validation
├── services/               # Business logic
├── repositories/           # Data access
├── models/                 # Database models
├── utils/                  # Utilities
├── types/                  # TypeScript types
└── config/                 # Configuration
\`\`\`

### Layered Architecture

\`\`\`
Request
   │
   ▼
┌─────────────┐
│   Routes    │  ← URL mapping
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Controllers │  ← HTTP concerns (req/res)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Services   │  ← Business logic
└──────┬──────┘
       │
       ▼
┌─────────────┐
│Repositories │  ← Data access
└──────┬──────┘
       │
       ▼
   Database
\`\`\`

### Key Patterns

**Dependency Injection**
Services receive dependencies through constructor.
Use the DI container in `src/container.ts`.

**Error Handling**
All errors extend `AppError` class.
Global error handler in `src/api/middlewares/errorHandler.ts`.

**Validation**
Use Zod schemas for request validation.
Validators in `src/api/validators/`.

## Technology Stack

| Category | Technology | Notes |
|----------|------------|-------|
| Runtime | Node.js 20 | LTS |
| Framework | Express | With TypeScript |
| Language | TypeScript | Strict mode |
| Database | PostgreSQL | Via Prisma |
| Validation | Zod | Request/response |
| Testing | Vitest | Unit + Integration |
| Docs | OpenAPI/Swagger | Auto-generated |

## Conventions

### File Naming

| Type | Convention | Example |
|------|------------|---------|
| Routes | kebab-case | `user-routes.ts` |
| Controllers | PascalCase | `UserController.ts` |
| Services | PascalCase | `UserService.ts` |
| Repositories | PascalCase | `UserRepository.ts` |

### Controller Pattern

\`\`\`typescript
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
\`\`\`

### Service Pattern

\`\`\`typescript
export class UserService {
  constructor(private userRepo: UserRepository) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }
}
\`\`\`

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

## Commands

\`\`\`bash
pnpm dev          # Start with hot reload
pnpm build        # Compile TypeScript
pnpm start        # Run compiled code
pnpm test         # Run tests
pnpm test:int     # Integration tests
pnpm db:migrate   # Run migrations
pnpm docs         # Generate OpenAPI docs
\`\`\`
```

## Typical Tasks

### Add New Endpoint

```markdown
## Goal
Create GET /api/v1/products/:id endpoint to fetch product details.

## Scope
### Allowed
- src/api/routes/product-routes.ts
- src/api/controllers/ProductController.ts
- src/services/ProductService.ts
- src/repositories/ProductRepository.ts
- tests/

### Forbidden
- prisma/schema.prisma (model exists)
- src/api/middlewares/**
```

### Add Business Logic

```markdown
## Goal
Add order total calculation with tax and discounts to OrderService.

## Scope
### Allowed
- src/services/OrderService.ts
- src/services/DiscountService.ts (if exists)
- tests/services/

### Forbidden
- src/api/** (no HTTP changes)
- src/repositories/** (use existing)
```

## Role Customizations

### Developer Role Addition

```markdown
## API Specific

- Controllers only handle HTTP concerns (parse request, send response)
- Business logic belongs in Services
- Database queries belong in Repositories
- All errors must extend AppError
- Validate requests with Zod schemas
- Document endpoints with OpenAPI decorators
```
