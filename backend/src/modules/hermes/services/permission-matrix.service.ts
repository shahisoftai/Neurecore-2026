import { Injectable, Logger } from '@nestjs/common';
import { ToolPermissionLevel } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { getHermesToolSet } from '../../tools/built-in/hermes-tools';
import type { IPermissionMatrix } from '../interfaces/permission-matrix.interface';
import type {
  PermissionContext,
  PermissionMatrixRow,
  GrantPermissionInput,
  RevokePermissionInput,
} from '../interfaces/permission-matrix.interface';

@Injectable()
export class PermissionMatrixService implements IPermissionMatrix {
  private readonly logger = new Logger(PermissionMatrixService.name);

  constructor(private readonly prisma: PrismaService) {}

  async can(context: PermissionContext): Promise<boolean> {
    try {
      const tools = await this.getAllowedTools(
        context.hermesType,
        context.roles,
        context.tenantId,
      );

      if (tools.length === 0) return false;

      if (context.action === 'read') return true;

      const defaultToolSet = getHermesToolSet(context.hermesType);
      const writeTools = defaultToolSet
        .filter(
          (t) =>
            t.permission === ToolPermissionLevel.ALLOW ||
            t.permission === ToolPermissionLevel.WRITE_ONLY,
        )
        .map((t) => t.name);

      if (context.action === 'write' || context.action === 'execute') {
        return writeTools.length > 0;
      }

      if (context.action === 'delete') {
        const adminRoles = ['OWNER', 'ADMIN', 'PLATFORM_ADMIN'];
        return context.roles.some((r) =>
          adminRoles.includes(r),
        );
      }

      return false;
    } catch (err) {
      this.logger.error(
        `Permission check failed: ${(err as Error).message}`,
      );
      return false;
    }
  }

  async getAllowedTools(
    hermesType: string,
    roles: string[],
    tenantId: string,
  ): Promise<string[]> {
    const defaultToolSet = getHermesToolSet(hermesType as any);
    const adminRoles = ['OWNER', 'ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN'];
    const isAdmin = roles.some((r) => adminRoles.includes(r));

    return defaultToolSet
      .filter((t) => {
        if (t.permission === ToolPermissionLevel.DENY) return false;
        if (t.permission === ToolPermissionLevel.ALLOW) return true;
        if (t.permission === ToolPermissionLevel.READ_ONLY) {
          return true;
        }
        if (
          t.permission === ToolPermissionLevel.APPROVAL_REQUIRED
        ) {
          return isAdmin;
        }
        return false;
      })
      .map((t) => t.name);
  }

  async grant(params: GrantPermissionInput): Promise<void> {
    this.logger.log(
      `Granting permission: ${params.hermesType}/${params.role}/${params.tool}=${params.level}`,
    );

    // Permissions are enforced at the agent level via HermesToolPermission.
    // The matrix is computed dynamically based on agent type defaults.
    // Full persistence of role-based permissions requires a future migration
    // to add PermissionMatrix table. For now, this logs the grant.
  }

  async revoke(params: RevokePermissionInput): Promise<void> {
    this.logger.log(
      `Revoking permission: ${params.hermesType}/${params.role}/${params.tool}`,
    );
  }

  async getMatrix(
    tenantId: string,
  ): Promise<PermissionMatrixRow[]> {
    const agents = await this.prisma.hermesAgent.findMany({
      where: { tenantId },
      include: { toolPermissions: true },
    });

    const rows: PermissionMatrixRow[] = [];

    for (const agent of agents) {
      const defaultTools = getHermesToolSet(agent.type);

      for (const dt of defaultTools) {
        const override = agent.toolPermissions.find(
          (tp) => tp.toolName === dt.name,
        );

        rows.push({
          hermesType: agent.type,
          role: 'MEMBER' as any,
          tool: dt.name,
          level: override?.permission ?? dt.permission,
          conditions: (override?.conditions ?? dt.conditions) as any,
        });
      }

      for (const tp of agent.toolPermissions) {
        if (!defaultTools.some((dt) => dt.name === tp.toolName)) {
          rows.push({
            hermesType: agent.type,
            role: 'MEMBER' as any,
            tool: tp.toolName,
            level: tp.permission,
            conditions: tp.conditions as any,
          });
        }
      }
    }

    return rows;
  }
}
