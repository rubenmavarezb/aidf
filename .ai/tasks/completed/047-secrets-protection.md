# TASK: Protección de secretos en configuración

## Goal
Evitar que credenciales sensibles (API keys, webhook URLs, SMTP passwords) se comitteen en texto plano en `.ai/config.yml`. Soportar variables de entorno como alternativa y generar `.gitignore` apropiado.

## Status: ✅ COMPLETED

### Execution Log
- **Started:** 2026-01-29T17:48:18.153Z
- **Completed:** 2026-01-29T17:56:28.948Z
- **Iterations:** 2
- **Files modified:** 0

### Files Modified
_None_

## Task Type
component

## Suggested Roles
- developer

## Auto-Mode Compatible
✅ **SÍ** - Cambios determinísticos en parsing de config y template generation.

## Scope

### Allowed
- `packages/cli/src/types/index.ts`
- `packages/cli/src/core/executor.ts`
- `packages/cli/src/core/executor.test.ts`
- `packages/cli/src/utils/config.ts` (crear si no existe)
- `packages/cli/src/utils/config.test.ts` (crear)
- `packages/cli/src/commands/init.ts`
- `packages/cli/src/commands/init.test.ts`

### Forbidden
- `templates/**`
- `docs/**`
- `.env*`

## Requirements

### 1. Soporte de variables de entorno en config.yml

Permitir syntax `${ENV_VAR}` o `$ENV_VAR` en valores de config.yml:

```yaml
notifications:
  slack:
    webhook_url: ${AIDF_SLACK_WEBHOOK}
  discord:
    webhook_url: ${AIDF_DISCORD_WEBHOOK}
  email:
    smtp_password: ${AIDF_SMTP_PASSWORD}

provider:
  api_key: ${ANTHROPIC_API_KEY}
```

### 2. Implementar `resolveConfigValue()` en utils

```typescript
/**
 * Resuelve variables de entorno en strings de configuración.
 * Soporta ${VAR} y $VAR syntax.
 * Lanza error si la variable no existe y no hay default.
 */
export function resolveConfigValue(value: string): string;

/**
 * Recorre recursivamente un objeto de config resolviendo todas las strings.
 */
export function resolveConfig<T extends Record<string, unknown>>(config: T): T;
```

### 3. Integrar en executor.ts

- Resolver config values al inicio de ejecución, antes de pasar a providers o notifications
- Emitir warning si se detectan valores que parecen secretos en texto plano (heurística: strings que contengan "key", "secret", "password", "token" como key en config y el valor no use `${...}`)

### 4. Actualizar `init.ts`

- Generar config.yml con placeholders de env vars para campos sensibles
- Agregar `.ai/config.local.yml` al `.gitignore` generado
- Documentar en comentarios del config.yml generado:

```yaml
# For sensitive values, use environment variables:
# webhook_url: ${AIDF_SLACK_WEBHOOK}
# api_key: ${ANTHROPIC_API_KEY}
```

### 5. Tests

- Test: `resolveConfigValue` resuelve `${VAR}` correctamente
- Test: `resolveConfigValue` resuelve `$VAR` correctamente
- Test: error cuando variable no existe
- Test: `resolveConfig` recorre objetos anidados
- Test: warning detecta secretos en texto plano
- Test: strings sin variables pasan sin cambios

## Definition of Done
- [ ] `resolveConfigValue()` y `resolveConfig()` implementadas
- [ ] Executor resuelve config al inicio
- [ ] Warning cuando se detectan posibles secretos en texto plano
- [ ] `aidf init` genera config con env var placeholders
- [ ] `.gitignore` incluye `config.local.yml`
- [ ] Tests cubren resolución, errores, y detección de secretos
- [ ] TypeScript compila sin errores
- [ ] Backward compatible: configs sin variables funcionan igual

## Notes
- La resolución debe ser recursiva — soportar objetos anidados, arrays, etc.
- NO implementar un sistema de archivos `.env` propio — usar las variables de entorno del sistema
- La heurística de detección de secretos es best-effort, no un sistema de seguridad fuerte
- Considerar que `config.local.yml` podría ser un override local (no commiteado) para desarrollo — pero eso es scope de otra task
- El formato `${VAR}` es estándar en Docker, shell, etc. — fácil de entender para usuarios
