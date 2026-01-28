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

    // Primero probar match exacto con glob
    if (minimatch(normalizedPath, normalizedPattern, { dot: true })) {
      return true;
    }

    // Para patrones de directorio (sin extensión wildcard), probar con /**
    if (!normalizedPattern.includes('*') || normalizedPattern.endsWith('**')) {
      if (minimatch(normalizedPath, `${normalizedPattern}/**`, { dot: true })) {
        return true;
      }
    }

    // Para patrones de directorio sin glob, usar startsWith
    const baseDir = normalizedPattern.replace(/\/?\*\*.*$/, '');
    if (baseDir && !normalizedPattern.includes('*.')) {
      return normalizedPath.startsWith(baseDir + '/') || normalizedPath === baseDir;
    }

    return false;
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
