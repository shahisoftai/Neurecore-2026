import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { DeploymentService } from '../../agents/services/deployment.service';
import { ProjectTypesService } from '../../project-types/project-types.service';
import type { SpawnAgentsResult, RoleTemplateEntry } from '../interfaces/role-template.interface';
import type { Agent } from '@prisma/client';

@Injectable()
export class RoleTemplateService {
  private readonly logger = new Logger(RoleTemplateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deploymentService: DeploymentService,
    private readonly projectTypesService: ProjectTypesService,
  ) {}

  async spawnAgentsFromTemplate(
    projectId: string,
    projectTypeId: string,
    tenantId: string,
    actorId: string,
  ): Promise<SpawnAgentsResult> {
    const version = await this.projectTypesService.getCurrentVersion(
      projectTypeId,
      tenantId,
    );

    const result: SpawnAgentsResult = { spawned: [], skipped: [], errors: [] };

    if (!version || !version.roleTemplate || (version.roleTemplate as unknown[]).length === 0) {
      this.logger.debug(`No roleTemplate found for projectType ${projectTypeId} — skipping agent spawning`);
      return result;
    }

    const roleEntries = version.roleTemplate as RoleTemplateEntry[];

    for (const entry of roleEntries) {
      try {
        const template = await this.findTemplateByAgentType(entry.agentType);
        if (!template) {
          this.logger.warn(
            `No public agent template found for type "${entry.agentType}" — skipping role "${entry.role}"`,
          );
          result.skipped.push(entry.role);
          continue;
        }

        const agent = await this.deploymentService.spawnFromTemplate(
          template.id,
          {
            name: `${entry.role} — Project ${projectId.slice(0, 8)}`,
            tenantId,
            departmentId: undefined,
          },
          actorId,
          tenantId,
          'SYSTEM',
        );

        result.spawned.push(agent);
        this.logger.debug(
          `Spawned agent "${agent.name}" for role "${entry.role}" on project ${projectId}`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to spawn agent for role "${entry.role}": ${msg}`);
        result.errors.push(`${entry.role}: ${msg}`);
      }
    }

    return result;
  }

  private async findTemplateByAgentType(
    agentType: string,
  ): Promise<{ id: string; name: string } | null> {
    const template = await this.prisma.agentTemplate.findFirst({
      where: {
        type: agentType as never,
        isPublic: true,
        tenantId: null,
      },
      select: { id: true, name: true },
    });
    return template;
  }
}
