import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export const HERMES_AGENT_KEY = 'hermes_agent_id';

@Injectable()
export class HermesTenantGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const hermesAgentId =
      request.params.hermesAgentId ?? request.body?.hermesAgentId;

    if (!user?.tenantId) {
      throw new ForbiddenException('No tenant context');
    }

    if (!hermesAgentId) {
      return true;
    }

    const agent = await this.prisma.hermesAgent.findFirst({
      where: { id: hermesAgentId },
      select: { id: true, tenantId: true, workspaceId: true, isActive: true },
    });

    if (!agent) {
      throw new NotFoundException(`HermesAgent ${hermesAgentId} not found`);
    }

    if (!agent.isActive) {
      throw new ForbiddenException('HermesAgent is not active');
    }

    if (agent.tenantId !== user.tenantId) {
      throw new ForbiddenException('Tenant isolation violation');
    }

    if (
      request.body?.workspaceId &&
      request.body.workspaceId !== agent.workspaceId
    ) {
      throw new ForbiddenException('Workspace mismatch');
    }

    request.hermesAgent = agent;
    return true;
  }
}
