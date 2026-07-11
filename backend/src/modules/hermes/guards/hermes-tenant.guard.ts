import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: { tenantId?: string; id?: string };
}

@Injectable()
export class HermesTenantGuard implements CanActivate {
  private readonly logger = new Logger(HermesTenantGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const userRole = (user as { role?: string } | undefined)?.role;

    // SUPER_ADMIN bypasses tenant scoping — they are the only role
    // authorized to inspect across tenants.
    if (userRole === 'SUPER_ADMIN') {
      return true;
    }

    const tenantId =
      (request.params as Record<string, string>).tenantId ?? user?.tenantId;

    if (!tenantId) {
      throw new ForbiddenException(
        'Tenant isolation required for Hermes operations',
      );
    }

    const params = request.params as Record<string, string>;
    const body = request.body as Record<string, unknown>;
    const hermesAgentId =
      params.hermesAgentId ??
      params.agentId ??
      (body?.hermesAgentId as string | undefined);
    if (hermesAgentId) {
      const agent = await this.prisma.hermesAgent.findUnique({
        where: { id: hermesAgentId },
        select: { tenantId: true },
      });
      if (!agent || agent.tenantId !== tenantId) {
        throw new ForbiddenException(
          `HermesAgent ${hermesAgentId} does not belong to tenant ${tenantId}`,
        );
      }
    }

    return true;
  }
}
