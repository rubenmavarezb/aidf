# PLAN: v0.6.0 — Security & Hygiene

## Status: COMPLETED

## Overview

Fix known npm vulnerabilities, harden the tool-handler against command injection and path traversal, and resolve logging inconsistencies. This is prerequisite work before any new features.

## Goals

- Zero known vulnerabilities in `npm audit`
- Zero deprecated dependencies
- Secure tool-handler (command injection, path traversal)
- Consistent logging (no raw console.warn in library code)
- Global error handler for uncaught exceptions

## Non-Goals

- New features
- Refactoring executor or commands
- Adding new tests for existing commands (that's Phase 2)

## Tasks

### Phase 1: Dependency updates

- [x] `061-update-nodemailer.md` — Updated nodemailer 6.10.1 → 8.x (fixes GHSA-rcmh-qjqh-p98v HIGH, GHSA-mm7p-fcc7-pg87 moderate).
- [x] `062-update-glob.md` — Updated glob 10.5.0 → 11.x (deprecated, known vulnerabilities). Also updated minimatch to 10.2.0. Eliminates transitive node-domexception.

### Phase 2: Security hardening

- [x] `063-harden-tool-handler.md` — Added 6 new blocked patterns in `validateCommand()`: pipe/chain/semicolon to sudo, `eval`, backtick execution, `$()` subshells. Implemented `resolveSafePath()` for path traversal protection on `read_file`, `write_file`, `list_files`. Added 11 new tests.
- [x] `064-skill-security-defaults.md` — Changed `block_suspicious` default to `true`. Replaced all `console.warn` with `logger.warn` in SkillLoader class.

### Phase 3: Quick wins

- [x] `065-global-error-handler.md` — Added `process.on('unhandledRejection')` and `process.on('uncaughtException')` in index.ts with Logger output and exit(1).
- [x] `066-console-to-logger.md` — Replaced all `console.warn`/`console.log` in skill-loader.ts (6 instances) and parallel-executor.ts (5 instances) with logger equivalents.

## Results

- 532 tests passing (up from 298+), all green
- Zero typecheck errors
- nodemailer 8.x, glob 11.x, minimatch 10.2.0
- Path traversal protection with symlink-aware resolution
- Zero console.warn/log in library code
