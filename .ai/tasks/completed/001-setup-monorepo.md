# TASK: Setup Monorepo Structure

## Goal
Configurar el proyecto AIDF como monorepo con pnpm workspaces y crear la estructura base del CLI.

## Status: ✅ COMPLETED

- **Completed:** 2026-01-27
- **Agent:** Claude Code (main session)
- **Iterations:** 1
- **Files Created:** 9 files (package.json, pnpm-workspace.yaml, packages/cli/*)

## Task Type
architecture

## Suggested Roles
- architect
- developer

## Auto-Mode Compatible
✅ **SÍ** - Este task es ideal para Cursor auto-mode. No requiere decisiones ambiguas.

## Scope

### Allowed
- `package.json` (root)
- `pnpm-workspace.yaml`
- `packages/cli/**`
- `tsconfig.json` (root)
- `.gitignore`

### Forbidden
- `templates/**`
- `docs/**`
- `examples/**`

## Requirements

### 1. Root package.json
```json
{
  "name": "aidf",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "dev": "pnpm --filter @aidf/cli dev"
  },
  "devDependencies": {
    "typescript": "^5.5.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### 2. pnpm-workspace.yaml
```yaml
packages:
  - 'packages/*'
```

### 3. packages/cli/package.json
```json
{
  "name": "@aidf/cli",
  "version": "0.1.0",
  "description": "AI-Integrated Development Framework CLI",
  "type": "module",
  "bin": {
    "aidf": "./dist/index.js"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest",
    "lint": "eslint src",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "openai": "^4.70.0",
    "commander": "^12.0.0",
    "yaml": "^2.4.0",
    "chalk": "^5.3.0",
    "ora": "^8.0.0",
    "simple-git": "^3.25.0",
    "glob": "^10.4.0",
    "chokidar": "^3.6.0",
    "inquirer": "^9.3.0",
    "minimatch": "^10.0.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "@types/node": "^22.0.0",
    "tsup": "^8.2.0",
    "eslint": "^9.0.0",
    "@types/inquirer": "^9.0.0"
  },
  "keywords": ["ai", "cli", "development", "automation", "claude"],
  "license": "MIT"
}
```

### 4. packages/cli/tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 5. packages/cli/tsup.config.ts
```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  shims: true,
  banner: {
    js: '#!/usr/bin/env node'
  }
});
```

### 6. Estructura de carpetas
```
packages/cli/
├── src/
│   ├── index.ts              # Entry point (placeholder)
│   ├── commands/
│   │   └── .gitkeep
│   ├── core/
│   │   ├── providers/
│   │   │   └── .gitkeep
│   │   └── .gitkeep
│   ├── utils/
│   │   └── .gitkeep
│   └── types/
│       └── index.ts          # Type definitions placeholder
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

### 7. packages/cli/src/index.ts (placeholder)
```typescript
import { Command } from 'commander';

const program = new Command();

program
  .name('aidf')
  .description('AI-Integrated Development Framework CLI')
  .version('0.1.0');

program.parse();
```

### 8. packages/cli/src/types/index.ts (placeholder)
```typescript
export interface AidfConfig {
  version: number;
  provider: ProviderConfig;
  execution: ExecutionConfig;
  permissions: PermissionsConfig;
  validation: ValidationConfig;
  git: GitConfig;
}

export interface ProviderConfig {
  type: 'claude-cli' | 'anthropic-api' | 'openai-api';
  model?: string;
}

export interface ExecutionConfig {
  max_iterations: number;
  max_consecutive_failures: number;
  timeout_per_iteration: number;
}

export interface PermissionsConfig {
  scope_enforcement: 'strict' | 'ask' | 'permissive';
  auto_commit: boolean;
  auto_push: boolean;
  auto_pr: boolean;
}

export interface ValidationConfig {
  pre_commit: string[];
  pre_push: string[];
  pre_pr: string[];
}

export interface GitConfig {
  commit_prefix: string;
  branch_prefix: string;
}
```

### 9. Actualizar .gitignore root
Añadir:
```
# Node
node_modules/
dist/

# pnpm
.pnpm-store/

# Build artifacts
*.tsbuildinfo
```

## Definition of Done
- [ ] `pnpm install` ejecuta sin errores desde root
- [ ] `pnpm build` compila el CLI sin errores
- [ ] `pnpm --filter @aidf/cli dev` inicia watch mode
- [ ] Ejecutar `node packages/cli/dist/index.js --help` muestra ayuda
- [ ] Estructura de carpetas creada correctamente
- [ ] TypeScript compila sin errores (`pnpm typecheck`)

## Notes
- Usar pnpm (no npm ni yarn)
- Node 20+ requerido por las dependencias ESM
- El CLI debe ser ejecutable directamente después de build
