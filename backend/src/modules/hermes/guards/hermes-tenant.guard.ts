import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class HermesTenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.tenantId) {
      return false;
    }

    const hermesAgentId =
      request.params.hermesAgentId ??
      request.params.agentId ??
      request.body?.hermesAgentId;

    if (!hermesAgentId) {
      return true;
    }

    const hermes = await this.prisma.hermesAgent.findUnique({
      where: { id: hermesAgentId },
      select: { tenantId: true, isActive: true, workspaceId: true },
    });

    if (!hermes || !hermes.isActive) {
      throw new ForbiddenException({
        code: 'HERMES_AGENT_NOT_FOUND',
        message: 'Hermes agent not found or inactive',
      });
    }

    if (hermes.tenantId !== user.tenantId) {
      throw new ForbiddenException({
        code: 'HERMES_TENANT_ISOLATION_VIOLATION',
        message: 'Cannot access Hermes agent from another tenant',
      });
    }

    if (
      request.body?.workspaceId &&
      hermes.workspaceId &&
      request.body.workspaceId !== hermes.workspaceId
    ) {
      throw new ForbiddenException({
        code: 'HERMES_WORKSPACE_MISMATCH',
        message: 'Workspace does not match agent workspace',
      });
    }

    return true;
  }
}
