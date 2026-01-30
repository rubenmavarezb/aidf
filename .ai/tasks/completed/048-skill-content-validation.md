# TASK: Validación de contenido de Skills contra prompt injection

## Goal
Agregar validación de contenido a los SKILL.md para detectar y advertir sobre patrones sospechosos que podrían indicar prompt injection. No bloquear por defecto, pero advertir al usuario.


## Status: BLOCKED

### Execution Log
- **Started:** 2026-01-29T17:56:28.953Z
- **Iterations:** 3
- **Blocked at:** 2026-01-29T18:11:29.324Z

### Blocking Issue
```
Max iterations (3) reached
```

### Files Modified
_None_

---
@developer: Review and provide guidance, then run `aidf run --resume /Users/ruben/Documentos/aidf/.ai/tasks/048-skill-content-validation.md`

## Task Type
component

## Suggested Roles
- developer

## Auto-Mode Compatible
✅ **SÍ** - Lógica determinística de pattern matching.

## Scope

### Allowed
- `packages/cli/src/core/skill-loader.ts`
- `packages/cli/src/core/skill-loader.test.ts`
- `packages/cli/src/types/index.ts`
- `packages/cli/src/commands/skills.ts`

### Forbidden
- `templates/**`
- `docs/**`
- `examples/**`

## Requirements

### 1. Implementar `validateSkillSecurity()` en skill-loader.ts

```typescript
export interface SecurityWarning {
  level: 'warning' | 'danger';
  pattern: string;
  description: string;
  line?: number;
}

export function validateSkillSecurity(content: string): SecurityWarning[];
```

Detectar los siguientes patrones:

**Danger (potencialmente malicioso):**
- `ignore previous instructions` / `ignore above` / `disregard`
- `you are now` / `you are a` (role override attempts)
- `system:` / `<system>` (system prompt injection)
- `IMPORTANT:` seguido de instrucciones contradictorias a AIDF
- Encoded content (base64 patterns, hex strings largos)
- `eval(` / `exec(` / `Function(` en instrucciones (no en code blocks)

**Warning (sospechoso pero puede ser legítimo):**
- `sudo` / `chmod` / `chown` en instrucciones
- URLs a dominios externos en instrucciones
- Instrucciones para modificar archivos fuera de scope típico (`.env`, `/etc/`, `~/.ssh/`)
- `--dangerously` flags en instrucciones
- `rm -rf` / `delete` patterns

### 2. Integrar en el flujo de carga

En `SkillLoader.loadAll()`:
- Ejecutar `validateSkillSecurity()` en cada skill cargado
- Almacenar warnings en el `LoadedSkill` (agregar campo `warnings?: SecurityWarning[]`)
- Si hay warnings nivel `danger`, emitir log warning al usuario
- No bloquear la carga (a menos que config diga lo contrario)

### 3. Agregar configuración

En `SkillsConfig`:
```typescript
export interface SkillsConfig {
  enabled?: boolean;
  directories?: string[];
  extras?: string[];
  /** Block skills with danger-level security warnings. Default: false */
  block_suspicious?: boolean;
}
```

### 4. Mejorar comando `skills validate`

- Mostrar warnings de seguridad en output de `aidf skills validate`
- Color-coded: amarillo para warning, rojo para danger
- Incluir línea y descripción del patrón detectado

### 5. Tests

- Test: detecta "ignore previous instructions" como danger
- Test: detecta "you are now" como danger
- Test: detecta base64-encoded content como danger
- Test: detecta `sudo` como warning
- Test: no genera falsos positivos en skills legítimos (los built-in AIDF skills)
- Test: `block_suspicious: true` previene carga de skills con danger warnings
- Test: content dentro de code blocks (``` ```) no genera warnings para eval/exec

## Definition of Done
- [ ] `validateSkillSecurity()` implementada con patterns de danger y warning
- [ ] `SecurityWarning` interface definida
- [ ] Warnings almacenados en `LoadedSkill`
- [ ] Logging de warnings durante carga
- [ ] `block_suspicious` config funcional
- [ ] `aidf skills validate` muestra warnings de seguridad
- [ ] Tests cubren detección, falsos positivos, y config
- [ ] Built-in AIDF skills pasan validación sin warnings
- [ ] TypeScript compila sin errores

## Notes
- La detección es heurística, NO un sistema de seguridad robusto — los patrones evolucionan
- No bloquear por defecto para no romper skills legítimos
- El contenido dentro de code blocks (marcados con ```) debe ser excluido de la validación donde aplique (eval/exec son normales en code examples)
- Los built-in skills de AIDF son la referencia de "skill legítimo" — deben pasar sin warnings
- Futuro: considerar un sistema de firmas o checksums para skills verificados
