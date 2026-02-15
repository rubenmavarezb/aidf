---
title: Security
description: How AIDF protects your codebase — scope enforcement, path traversal protection, command blocking, and config validation.
---

AIDF includes multiple layers of protection to prevent AI agents from making unintended or dangerous changes to your codebase.

---

## Scope Enforcement

Every task defines allowed and forbidden file paths. The ScopeGuard validates each file change before it is accepted. See [Architecture](/aidf/docs/architecture/) for details on the three enforcement modes (`strict`, `ask`, `permissive`).

---

## Path Traversal Protection

API providers (`anthropic-api`, `openai-api`) use built-in file operation tools handled by `tool-handler.ts`. All file paths passed to these tools go through `resolveSafePath()`, which:

- Resolves the path to an absolute location
- Verifies the resolved path is within the project working directory
- Rejects any path containing traversal sequences (`../`) that escape the project root

This prevents an AI agent from reading or writing files outside the project boundary, even if it constructs a malicious path.

---

## Command Blocking

AIDF blocks suspicious shell patterns by default. The following are rejected when `block_suspicious` is enabled (which is the default):

- `eval` statements
- Backtick command substitution
- `$()` subshell execution
- Piping or chaining commands to `sudo`

These patterns are blocked because they can be used to escalate privileges or execute arbitrary code outside the intended scope.

### Configuration

The `block_suspicious` option defaults to `true`. To disable it (not recommended):

```yaml
# .ai/config.yml
permissions:
  block_suspicious: false
```

---

## Config Validation

All configuration is validated at load time using [Zod](https://zod.dev) schemas. This catches:

- Unknown or misspelled fields
- Invalid values (e.g., wrong provider type, negative iteration counts)
- Missing required fields
- Type mismatches (e.g., string where number is expected)

Validation errors are reported with clear messages before execution begins, preventing misconfigured runs from starting.

---

## Best Practices

- Use `strict` scope enforcement for automated/unattended runs
- Keep `block_suspicious: true` (the default)
- Define explicit `Forbidden` paths in tasks for sensitive files (`.env`, credentials, CI configs)
- Review AI-generated commits before pushing to shared branches
