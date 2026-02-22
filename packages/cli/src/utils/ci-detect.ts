import { CIEnvironment } from '../types/index.js';

/**
 * Detects the current CI environment and extracts relevant metadata.
 * Returns null if not running in a CI environment.
 */
export function detectCIEnvironment(): CIEnvironment | null {
  const env = process.env;

  // GitHub Actions
  if (env.GITHUB_ACTIONS === 'true') {
    return {
      ci: true,
      ciProvider: 'github-actions',
      ciBuildId: env.GITHUB_RUN_ID,
      ciBranch: extractBranchFromRef(env.GITHUB_REF),
      ciCommit: env.GITHUB_SHA,
    };
  }

  // GitLab CI
  if (env.GITLAB_CI === 'true') {
    return {
      ci: true,
      ciProvider: 'gitlab-ci',
      ciBuildId: env.CI_JOB_ID,
      ciBranch: env.CI_COMMIT_REF_NAME,
      ciCommit: env.CI_COMMIT_SHA,
    };
  }

  // Jenkins
  if (env.JENKINS_URL) {
    return {
      ci: true,
      ciProvider: 'jenkins',
      ciBuildId: env.BUILD_ID || env.BUILD_NUMBER,
      ciBranch: env.GIT_BRANCH,
      ciCommit: env.GIT_COMMIT,
    };
  }

  // CircleCI
  if (env.CIRCLECI === 'true') {
    return {
      ci: true,
      ciProvider: 'circleci',
      ciBuildId: env.CIRCLE_BUILD_NUM,
      ciBranch: env.CIRCLE_BRANCH,
      ciCommit: env.CIRCLE_SHA1,
    };
  }

  // Bitbucket Pipelines
  if (env.BITBUCKET_PIPELINE_UUID) {
    return {
      ci: true,
      ciProvider: 'bitbucket-pipelines',
      ciBuildId: env.BITBUCKET_BUILD_NUMBER,
      ciBranch: env.BITBUCKET_BRANCH,
      ciCommit: env.BITBUCKET_COMMIT,
    };
  }

  // Azure Pipelines
  if (env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI && env.SYSTEM_TEAMPROJECT) {
    return {
      ci: true,
      ciProvider: 'azure-pipelines',
      ciBuildId: env.BUILD_BUILDID,
      ciBranch: extractBranchFromRef(env.BUILD_SOURCEBRANCH),
      ciCommit: env.BUILD_SOURCEVERSION,
    };
  }

  // Generic CI detection via CI env var (fallback)
  if (env.CI === 'true') {
    return {
      ci: true,
      ciProvider: 'unknown',
      ciBuildId: undefined,
      ciBranch: undefined,
      ciCommit: undefined,
    };
  }

  return null;
}

/**
 * Extracts branch name from git ref formats like "refs/heads/main" or "main"
 */
function extractBranchFromRef(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  // Handle "refs/heads/branch-name" format
  if (ref.startsWith('refs/heads/')) {
    return ref.replace('refs/heads/', '');
  }
  // Handle plain branch name
  return ref;
}
