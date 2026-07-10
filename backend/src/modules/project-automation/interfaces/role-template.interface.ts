import { Agent } from '@prisma/client';

export interface RoleTemplateEntry {
  role: string;
  agentType: string;
}

export interface SpawnAgentsResult {
  spawned: Agent[];
  skipped: string[];
  errors: string[];
}
