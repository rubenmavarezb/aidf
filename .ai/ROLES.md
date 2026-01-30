# Role Selection Guide

Use this guide to select the appropriate AI role for your task.

---

## Quick Reference

| Task Type | Primary Role | When to Use |
|-----------|--------------|-------------|
| New feature/component | `developer` | Building new functionality |
| System design | `architect` | Planning, designing systems |
| Bug fix | `developer` | Fixing specific issues |
| Add tests | `tester` | Improving test coverage |
| Code review | `reviewer` | Reviewing PRs, code quality |
| Documentation | `documenter` | Writing/improving docs |
| Refactoring | `architect` + `developer` | Restructuring code |
| Performance | `architect` | Optimization planning |

---

## Role Descriptions

### Architect

**Use when**: Designing new systems, planning refactors, making architectural decisions.

**Strengths**: Big picture thinking, pattern selection, trade-off analysis.

**Limitations**: Does not implement code directly.

### Developer

**Use when**: Building features, fixing bugs, implementing designs.

**Strengths**: Clean code, following patterns, writing tests.

**Limitations**: Should not make architectural decisions unilaterally.

### Tester

**Use when**: Writing tests, improving coverage, finding edge cases.

**Strengths**: Test strategy, edge cases, accessibility testing.

**Limitations**: Does not modify implementation code.

### Reviewer

**Use when**: Reviewing code for quality, security, and conventions.

**Strengths**: Finding issues, suggesting improvements, verifying standards.

**Limitations**: Does not rewrite code, only suggests changes.

### Documenter

**Use when**: Writing documentation, adding code comments, creating guides.

**Strengths**: Clear technical writing, examples, API documentation.

**Limitations**: Does not modify code logic.

---

## Combining Roles

For complex tasks, specify primary and secondary roles:

```markdown
## Suggested Roles
- architect (primary - design the approach)
- developer (secondary - implement after design approval)
```

---

## Adding Custom Roles

Create new roles in `.ai/roles/` when you have:

- Recurring specialized tasks
- Domain-specific expertise needs
- Project-specific personas

See existing roles for the template structure.
