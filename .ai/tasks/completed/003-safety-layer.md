# TASK: Implementar Safety Layer (Scope Enforcement)

## Goal
Crear el módulo de seguridad que valida cambios de archivos contra el scope definido en la task y puede revertir cambios no autorizados.

## Status: ✅ COMPLETED

- **Completed:** 2026-01-27
- **Agent:** Claude Code (parallel session 2)
- **Tests:** 16 passed
- **Files Created:** safety.ts, safety.test.ts

## Task Type
component

## Suggested Roles
- developer

## Auto-Mode Compatible
✅ **SÍ** - Cursor auto-mode funciona bien. Lógica determinística.

## Scope

### Allowed
- `packages/cli/src/core/safety.ts`
- `packages/cli/src/core/safety.test.ts`
- `packages/cli/src/types/index.ts`

### Forbidden
- `templates/**`
- Cualquier archivo fuera de `packages/cli/`

## Requirements

### 1. Tipos adicionales en `types/index.ts`

```typescript
export type ScopeDecision =
  | { action: 'ALLOW' }
  | { action: 'BLOCK'; reason: string; files: string[] }
  | { action: 'ASK_USER'; reason: string; files: string[] };

export type ScopeMode = 'strict' | 'ask' | 'permissive';

export interface FileChange {
  path: string;
  type: 'created' | 'modified' | 'deleted';
}
```

### 2. Implementar `safety.ts`

```typescript
// packages/cli/src/core/safety.ts

import { minimatch } from 'minimatch';
import type { TaskScope, ScopeDecision, ScopeMode, FileChange } from '../types/index.js';

/**
 * Verifica si un archivo coincide con algún patrón de la lista
 */
export function matchesPattern(filePath: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    // Normalizar path (remover ./ al inicio)
    const normalizedPath = filePath.replace(/^\.\//, '');
    const normalizedPattern = pattern.replace(/^\.\//, '');

    // Soportar patrones con y sin glob
    return minimatch(normalizedPath, normalizedPattern, { dot: true }) ||
           minimatch(normalizedPath, `${normalizedPattern}/**`, { dot: true }) ||
           normalizedPath.startsWith(normalizedPattern.replace(/\*\*.*/, ''));
  });
}

/**
 * Evalúa si un cambio de archivo está permitido según el scope
 */
export function checkFileChange(
  file: string,
  scope: TaskScope,
  mode: ScopeMode
): ScopeDecision {
  // 1. Forbidden siempre bloquea
  if (scope.forbidden.length > 0 && matchesPattern(file, scope.forbidden)) {
    return {
      action: 'BLOCK',
      reason: 'File is in forbidden scope',
      files: [file],
    };
  }

  // 2. Ask before requiere confirmación (excepto en permissive)
  if (scope.ask_before && scope.ask_before.length > 0 && matchesPattern(file, scope.ask_before)) {
    if (mode === 'permissive') {
      return { action: 'ALLOW' };
    }
    return {
      action: 'ASK_USER',
      reason: 'File requires approval before modification',
      files: [file],
    };
  }

  // 3. Si no está en allowed y el modo es strict, bloquear
  if (scope.allowed.length > 0 && !matchesPattern(file, scope.allowed)) {
    if (mode === 'strict') {
      return {
        action: 'BLOCK',
        reason: 'File is outside allowed scope',
        files: [file],
      };
    }
    if (mode === 'ask') {
      return {
        action: 'ASK_USER',
        reason: 'File is outside allowed scope',
        files: [file],
      };
    }
  }

  return { action: 'ALLOW' };
}

/**
 * Evalúa múltiples cambios de archivos
 */
export function checkFileChanges(
  changes: FileChange[],
  scope: TaskScope,
  mode: ScopeMode
): ScopeDecision {
  const blocked: string[] = [];
  const needsApproval: string[] = [];

  for (const change of changes) {
    const decision = checkFileChange(change.path, scope, mode);

    if (decision.action === 'BLOCK') {
      blocked.push(...decision.files);
    } else if (decision.action === 'ASK_USER') {
      needsApproval.push(...decision.files);
    }
  }

  // Blocked tiene prioridad
  if (blocked.length > 0) {
    return {
      action: 'BLOCK',
      reason: `${blocked.length} file(s) in forbidden or outside allowed scope`,
      files: blocked,
    };
  }

  // Luego ask
  if (needsApproval.length > 0) {
    return {
      action: 'ASK_USER',
      reason: `${needsApproval.length} file(s) require approval`,
      files: needsApproval,
    };
  }

  return { action: 'ALLOW' };
}

/**
 * Clase para monitorear y revertir cambios
 */
export class ScopeGuard {
  private scope: TaskScope;
  private mode: ScopeMode;
  private pendingApprovals: Set<string> = new Set();

  constructor(scope: TaskScope, mode: ScopeMode) {
    this.scope = scope;
    this.mode = mode;
  }

  /**
   * Valida cambios y retorna decisión
   */
  validate(changes: FileChange[]): ScopeDecision {
    return checkFileChanges(changes, this.scope, this.mode);
  }

  /**
   * Marca archivos como aprobados por el usuario
   */
  approve(files: string[]): void {
    files.forEach(f => this.pendingApprovals.add(f));
  }

  /**
   * Verifica si un archivo fue aprobado
   */
  isApproved(file: string): boolean {
    return this.pendingApprovals.has(file);
  }

  /**
   * Filtra cambios para obtener solo los que necesitan revertirse
   */
  getChangesToRevert(changes: FileChange[]): FileChange[] {
    return changes.filter(change => {
      if (this.isApproved(change.path)) {
        return false;
      }
      const decision = checkFileChange(change.path, this.scope, this.mode);
      return decision.action === 'BLOCK';
    });
  }

  /**
   * Genera reporte de violaciones
   */
  generateViolationReport(changes: FileChange[]): string {
    const violations = changes.filter(change => {
      const decision = checkFileChange(change.path, this.scope, this.mode);
      return decision.action !== 'ALLOW';
    });

    if (violations.length === 0) {
      return '';
    }

    let report = '## Scope Violations Detected\n\n';

    for (const change of violations) {
      const decision = checkFileChange(change.path, this.scope, this.mode);
      report += `- **${change.path}** (${change.type})\n`;
      report += `  - Action: ${decision.action}\n`;
      if (decision.action !== 'ALLOW') {
        report += `  - Reason: ${decision.reason}\n`;
      }
    }

    report += '\n### Scope Configuration\n';
    report += `- Allowed: ${this.scope.allowed.join(', ') || 'none'}\n`;
    report += `- Forbidden: ${this.scope.forbidden.join(', ') || 'none'}\n`;
    if (this.scope.ask_before) {
      report += `- Ask Before: ${this.scope.ask_before.join(', ')}\n`;
    }
    report += `- Mode: ${this.mode}\n`;

    return report;
  }
}
```

### 3. Tests en `safety.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  matchesPattern,
  checkFileChange,
  checkFileChanges,
  ScopeGuard
} from './safety.js';
import type { TaskScope, FileChange } from '../types/index.js';

describe('matchesPattern', () => {
  it('should match exact paths', () => {
    expect(matchesPattern('src/index.ts', ['src/index.ts'])).toBe(true);
    expect(matchesPattern('src/other.ts', ['src/index.ts'])).toBe(false);
  });

  it('should match glob patterns', () => {
    expect(matchesPattern('src/components/Button.tsx', ['src/components/**'])).toBe(true);
    expect(matchesPattern('src/utils/helper.ts', ['src/components/**'])).toBe(false);
  });

  it('should match wildcard extensions', () => {
    expect(matchesPattern('src/test.ts', ['**/*.ts'])).toBe(true);
    expect(matchesPattern('src/test.js', ['**/*.ts'])).toBe(false);
  });

  it('should handle dotfiles', () => {
    expect(matchesPattern('.env', ['.env*'])).toBe(true);
    expect(matchesPattern('.env.local', ['.env*'])).toBe(true);
  });
});

describe('checkFileChange', () => {
  const scope: TaskScope = {
    allowed: ['src/components/**', 'src/utils/**'],
    forbidden: ['.env*', 'src/config/**'],
    ask_before: ['package.json'],
  };

  it('should allow files in allowed scope', () => {
    const result = checkFileChange('src/components/Button.tsx', scope, 'strict');
    expect(result.action).toBe('ALLOW');
  });

  it('should block files in forbidden scope', () => {
    const result = checkFileChange('.env', scope, 'strict');
    expect(result.action).toBe('BLOCK');
  });

  it('should ask for files in ask_before', () => {
    const result = checkFileChange('package.json', scope, 'ask');
    expect(result.action).toBe('ASK_USER');
  });

  it('should block files outside allowed in strict mode', () => {
    const result = checkFileChange('src/other/file.ts', scope, 'strict');
    expect(result.action).toBe('BLOCK');
  });

  it('should allow files outside allowed in permissive mode', () => {
    const result = checkFileChange('src/other/file.ts', scope, 'permissive');
    expect(result.action).toBe('ALLOW');
  });
});

describe('checkFileChanges', () => {
  const scope: TaskScope = {
    allowed: ['src/**'],
    forbidden: ['.env'],
  };

  it('should aggregate multiple violations', () => {
    const changes: FileChange[] = [
      { path: 'src/index.ts', type: 'modified' },
      { path: '.env', type: 'modified' },
      { path: 'config/app.ts', type: 'created' },
    ];

    const result = checkFileChanges(changes, scope, 'strict');
    expect(result.action).toBe('BLOCK');
    expect(result.files).toContain('.env');
  });
});

describe('ScopeGuard', () => {
  it('should track approved files', () => {
    const scope: TaskScope = {
      allowed: ['src/**'],
      forbidden: [],
      ask_before: ['package.json'],
    };

    const guard = new ScopeGuard(scope, 'ask');
    guard.approve(['package.json']);

    expect(guard.isApproved('package.json')).toBe(true);
    expect(guard.isApproved('other.json')).toBe(false);
  });
});
```

## Definition of Done
- [ ] `matchesPattern` funciona con paths y globs
- [ ] `checkFileChange` evalúa correctamente forbidden > ask_before > allowed
- [ ] `checkFileChanges` agrega múltiples cambios
- [ ] `ScopeGuard` mantiene estado de aprobaciones
- [ ] `generateViolationReport` genera markdown legible
- [ ] Tests unitarios pasan con buena cobertura
- [ ] TypeScript compila sin errores

## Notes
- Usar `minimatch` para matching de globs
- Prioridad: forbidden > ask_before > allowed > default
- En modo `strict`, cualquier archivo fuera de allowed se bloquea
- En modo `ask`, se pregunta al usuario
- En modo `permissive`, solo forbidden se bloquea
- El reporte de violaciones se puede añadir al task file cuando hay BLOCKED state
