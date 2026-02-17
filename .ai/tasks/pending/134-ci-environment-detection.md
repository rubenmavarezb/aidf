# TASK: CI/CD Environment Detection

## Goal
Create a utility module that detects CI/CD environments from standard environment variables and enriches execution reports with CI-specific metadata.

Detect CI environment from standard env vars:
- `CI` -- generic CI detection
- `GITHUB_ACTIONS` -- GitHub Actions
- `GITLAB_CI` -- GitLab CI
- `JENKINS_URL` -- Jenkins
- `CIRCLECI` -- CircleCI
- `BITBUCKET_PIPELINE_UUID` -- Bitbucket Pipelines
- `AZURE_PIPELINE` -- Azure DevOps Pipelines

When in CI, add to report:
- `environment.ci = true`
- `environment.ciProvider` (e.g., "github-actions", "gitlab-ci", "jenkins", "circleci", "bitbucket-pipelines", "azure-pipelines")
- `environment.ciBuildId` (from provider-specific env vars)
- `environment.ciBranch` (from provider-specific env vars)
- `environment.ciCommit` (from provider-specific env vars)

Create `utils/ci-detect.ts` with `detectCIEnvironment(): CIEnvironment | null`.

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/utils/ci-detect.ts
- packages/cli/src/utils/ci-detect.test.ts
- packages/cli/src/types/index.ts

### Forbidden
- packages/cli/src/core/executor.ts (read-only)
- packages/cli/src/commands/** (read-only)

## Requirements
- Define `CIEnvironment` interface in `types/index.ts`: `{ ci: true, ciProvider: string, ciBuildId?: string, ciBranch?: string, ciCommit?: string }`
- Return `null` when not in a CI environment
- Provider-specific env var mappings:
  - GitHub Actions: `GITHUB_RUN_ID` (buildId), `GITHUB_REF_NAME` (branch), `GITHUB_SHA` (commit)
  - GitLab CI: `CI_JOB_ID` (buildId), `CI_COMMIT_BRANCH` (branch), `CI_COMMIT_SHA` (commit)
  - Jenkins: `BUILD_ID` (buildId), `GIT_BRANCH` (branch), `GIT_COMMIT` (commit)
  - CircleCI: `CIRCLE_BUILD_NUM` (buildId), `CIRCLE_BRANCH` (branch), `CIRCLE_SHA1` (commit)
  - Bitbucket: `BITBUCKET_BUILD_NUMBER` (buildId), `BITBUCKET_BRANCH` (branch), `BITBUCKET_COMMIT` (commit)
  - Azure: `BUILD_BUILDID` (buildId), `BUILD_SOURCEBRANCH` (branch), `BUILD_SOURCEVERSION` (commit)
- Pure function with no side effects -- only reads `process.env`
- Should be integrated into MetricsCollector during task 129

## Definition of Done
- [ ] `CIEnvironment` interface defined in `types/index.ts`
- [ ] `detectCIEnvironment()` function created in `utils/ci-detect.ts`
- [ ] Detects all 6 CI providers correctly
- [ ] Returns `null` when not in CI
- [ ] Extracts buildId, branch, and commit for each provider
- [ ] Unit tests with mocked env vars for each provider
- [ ] Unit tests verify `null` return when not in CI
- [ ] TypeScript compiles with no errors (`pnpm typecheck`)
- [ ] All tests pass (`pnpm test`)

## Notes
- Part of PLAN-v080-observability.md
- Independent utility module
- Should be integrated during task 129 (executor metrics integration)
