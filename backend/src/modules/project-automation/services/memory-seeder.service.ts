import { Injectable, Logger } from '@nestjs/common';
import { ProjectMemoryService } from '../../project-memory/project-memory.service';

export interface SeedResult {
  seeded: boolean;
  entryId: string | null;
  error: string | null;
}

@Injectable()
export class MemorySeederService {
  private readonly logger = new Logger(MemorySeederService.name);

  constructor(private readonly memoryService: ProjectMemoryService) {}

  async seedInitialMemory(
    projectId: string,
    tenantId: string,
    projectName: string,
  ): Promise<SeedResult> {
    try {
      const entry = await this.memoryService.create(tenantId, {
        projectId,
        category: 'NOTE',
        content: `Project "${projectName}" was initiated. AI workforce is being assembled.`,
        authorType: 'SYSTEM',
        isAiGenerated: true,
        isPinned: false,
      });

      await this.memoryService.create(tenantId, {
        projectId,
        category: 'CONSTRAINT',
        content: `Information requirements discovery is in progress. The Enterprise Information Engine will continuously assess what is known and unknown about this project.`,
        authorType: 'SYSTEM',
        isAiGenerated: true,
        isPinned: false,
      });

      this.logger.debug(`Seeded initial memory for project ${projectId}`);
      return { seeded: true, entryId: entry.id, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to seed initial memory for project ${projectId}: ${msg}`);
      return { seeded: false, entryId: null, error: msg };
    }
  }
}
