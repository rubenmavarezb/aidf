// packages/cli/src/__tests__/e2e/helpers/types.ts

import type { AidfConfig } from '../../../types/index.js';

export interface TempProjectOptions {
  withGit?: boolean;
  config?: Partial<AidfConfig>;
  agentsContent?: string;
}

export interface TempProjectResult {
  projectRoot: string;
  aiDir: string;
  cleanup: () => Promise<void>;
}

export interface TaskFixtureDef {
  id: string;
  goal: string;
  type: string;
  allowedScope: string[];
  forbiddenScope: string[];
  requirements: string;
  definitionOfDone: string[];
}

export interface SkillFixtureDef {
  name: string;
  description: string;
  version?: string;
  tags?: string[];
  body: string;
}

export interface RoleFixtureDef {
  name: string;
  identity: string;
  expertise: string[];
  responsibilities: string[];
}

export interface ConfigFixtureOptions {
  config: Partial<AidfConfig>;
}
