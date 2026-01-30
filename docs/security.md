# Security

AIDF executes AI agents that can read, write, and delete files, and run arbitrary commands. This guide covers the security features available to control and limit what agents can do.

## Overview

AIDF provides 5 security layers:

| Layer | What it protects | Where it's configured |
|-------|-----------------|----------------------|
| [Scope Enforcement](#scope-enforcement) | File access boundaries | Task `.md` files |
| [Permission Control](#permission-control) | Claude CLI permission prompts | `config.yml` → `security.skip_permissions` |
| [Command Policy](#command-policy) | Dangerous command execution | `config.yml` → `security.commands` |
| [Secrets Protection](#secrets-protection) | Credentials in config files | `config.yml` → `${ENV_VAR}` syntax |
| [Skill Validation](#skill-validation) | Prompt injection via skills | `config.yml` → `skills.block_suspicious` |

## Scope Enforcement

Every task defines which files the AI agent can modify. The `ScopeGuard` validates file changes against these boundaries.

### Task Scope Definition

```markdown
## Scope

### Allowed
- `packages/cli/src/core/**`
- `packages/cli/src/types/index.ts`

### Forbidden
- `templates/**`
- `.env*`
```

### Enforcement Modes

Configure in `config.yml`:

```yaml
behavior:
  scopeEnforcement: strict  # strict | ask | permissive
```

| Mode | Behavior |
|------|----------|
| `strict` | Block all changes outside allowed scope. Revert forbidden changes. |
| `ask` | Prompt the user before allowing out-of-scope changes. |
| `permissive` | Warn but allow. Only forbidden paths are blocked. |

### How It Works

- **CLI providers** (claude-cli, cursor-cli): Scope is validated **after** each iteration using `git status`. Out-of-scope changes are detected and can be reverted.
- **API providers** (anthropic-api, openai-api): Scope is validated **before** each `write_file` operation. The agent receives an error message explaining which paths are allowed, so it can self-correct.

## Permission Control

By default, AIDF passes `--dangerously-skip-permissions` to Claude CLI, giving the AI agent unrestricted access. You can disable this.

### Configuration

```yaml
security:
  skip_permissions: true    # default: true (backward compatible)
  warn_on_skip: true        # default: true — shows warning at execution start
```

### Recommendations

| Environment | Setting | Why |
|-------------|---------|-----|
| Development (trusted tasks) | `skip_permissions: true` | Faster iteration, no prompts |
| CI/CD | `skip_permissions: true` | Non-interactive, no one to answer prompts |
| Untrusted tasks or skills | `skip_permissions: false` | Claude will ask before file operations |

When `skip_permissions: true` and `warn_on_skip: true`, AIDF displays:

> Running with --dangerously-skip-permissions. The AI agent has unrestricted access to your filesystem and commands. Set security.skip_permissions: false in config.yml to require permission prompts.

## Command Policy

API providers (anthropic-api, openai-api) use a `run_command` tool that lets the AI execute shell commands. The command policy controls what's allowed.

### Default Blocklist

These patterns are **always blocked**, even without configuration:

| Pattern | What it blocks |
|---------|---------------|
| `rm -rf /` | Recursive deletion of root filesystem |
| `sudo` | Privilege escalation |
| `curl ... \| sh` | Remote code execution via pipe to shell |
| `wget ... \| bash` | Remote code execution via pipe to shell |
| `chmod 777` | Overly permissive file permissions |
| `> /dev/sda` | Direct disk writes |

### Custom Policy

```yaml
security:
  commands:
    allowed:
      - "pnpm test"
      - "pnpm lint"
      - "pnpm typecheck"
      - "pnpm build"
    blocked:
      - "npm publish"
      - "rm -rf"
    strict: false  # true = only allowed commands can run
```

### Strict Mode

When `strict: true`, **only** commands in the `allowed` list can be executed. Everything else is blocked with a descriptive error message returned to the AI.

When `strict: false` (default), commands run freely unless they match the `blocked` list or the default blocklist.

### Override Behavior

If a command matches the default blocklist but is explicitly in `allowed`, it's **permitted**. This lets you allow specific commands like `sudo pnpm install` if needed:

```yaml
security:
  commands:
    allowed:
      - "sudo pnpm install"  # overrides default sudo block for this specific command
```

### Scope

Command policy only applies to **API providers**. CLI providers (claude-cli, cursor-cli) delegate execution to Claude/Cursor, which have their own permission systems.

## Secrets Protection

Avoid committing API keys, webhook URLs, and passwords in `config.yml`.

### Environment Variable Syntax

Use `${VAR}` or `$VAR` in any config value:

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

AIDF resolves these at execution time from the system environment. If a variable is missing, execution fails with a clear error.

### Plaintext Detection

AIDF warns when it detects values that look like secrets in plaintext. It checks for config keys containing: `key`, `secret`, `password`, `token`, `webhook` — and warns if the value doesn't use `${...}` syntax.

```
⚠ Possible plaintext secret detected: notifications.slack.webhook_url
  Consider using environment variables: ${AIDF_SLACK_WEBHOOK}
```

This is a best-effort heuristic, not a security guarantee.

### Recommendations

1. Use `${ENV_VAR}` for all sensitive values
2. Add `.ai/config.local.yml` to `.gitignore` for local overrides
3. Set environment variables in your shell profile or CI/CD secrets
4. Never commit `.env` files with real credentials

## Skill Validation

Skills (SKILL.md files) are loaded as context into the AI prompt. A malicious skill could attempt prompt injection — overriding the agent's instructions.

### Security Scanning

AIDF scans skill content for suspicious patterns:

**Danger (potentially malicious):**

| Pattern | Example |
|---------|---------|
| Instruction override | "ignore previous instructions", "disregard above" |
| Role hijacking | "you are now", "you are a" |
| System prompt injection | `system:`, `<system>` |
| Encoded content | Base64 strings, long hex sequences |
| Code execution in instructions | `eval()`, `exec()`, `Function()` outside code blocks |

**Warning (suspicious but possibly legitimate):**

| Pattern | Example |
|---------|---------|
| Privilege escalation | `sudo`, `chmod`, `chown` |
| External URLs | Links to external domains |
| Sensitive file paths | `.env`, `/etc/`, `~/.ssh/` |
| Dangerous flags | `--dangerously-skip-permissions` |
| Destructive commands | `rm -rf`, `delete` |

### Configuration

```yaml
skills:
  enabled: true
  block_suspicious: false  # true = block skills with danger-level warnings
```

When `block_suspicious: true`, skills with danger-level warnings are not loaded into the prompt.

### Validation Command

Check skills manually:

```bash
aidf skills validate
```

This shows all security warnings with color-coded severity (yellow for warning, red for danger), including the line number and description of each detected pattern.

### Code Block Exclusion

Patterns like `eval()` and `exec()` inside markdown code blocks (`` ``` ``) are **not** flagged, since they're typically code examples, not instructions.

## Full Security Configuration Example

```yaml
version: "1.0"
project:
  name: my-project
  type: web-app
provider:
  type: claude-cli
  api_key: ${ANTHROPIC_API_KEY}
behavior:
  scopeEnforcement: strict
  autoCommit: false
security:
  skip_permissions: false
  warn_on_skip: true
  commands:
    allowed:
      - "pnpm test"
      - "pnpm lint"
      - "pnpm typecheck"
      - "pnpm build"
    blocked:
      - "npm publish"
    strict: true
skills:
  enabled: true
  block_suspicious: true
notifications:
  slack:
    webhook_url: ${AIDF_SLACK_WEBHOOK}
```

## Threat Model

| Threat | Mitigation | Limitation |
|--------|-----------|------------|
| AI modifies files outside scope | ScopeGuard (strict mode) | CLI providers: reactive (detects after), not preventive |
| AI runs destructive commands | Command policy + default blocklist | Only for API providers; CLI providers use their own permissions |
| Secrets in committed config | `${ENV_VAR}` syntax + plaintext detection | Detection is heuristic, not exhaustive |
| Prompt injection via skills | Content scanning + `block_suspicious` | Pattern-based detection; sophisticated attacks may evade |
| AI escalates privileges | `sudo` blocked by default | Can be overridden via `allowed` list |
| Malicious third-party skills | Security validation on load | No signature verification or trust chain (yet) |

## Future Considerations

- **Skill signatures**: Cryptographic verification of skill authorship
- **Sandboxed execution**: Run commands in isolated environments
- **Audit logging**: Record all file operations and commands for review
- **Network policy**: Control outbound network access during execution
