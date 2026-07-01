import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface CreateAuditLogInput {
  actor: string;
  action: string;
  resource?: string;
  resourceId?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  result?: 'success' | 'failure';
  details?: Record<string, unknown>;
}

/**
 * AuditService — SRP: only stores and queries audit logs.
 * DIP: depends on PrismaService abstraction.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) { }

  async log(input: CreateAuditLogInput): Promise<void> {
    // The audit_logs table has a FK on actor → users.id.
    // Unauthenticated requests pass actor='anonymous' which is not a valid UUID
    // and violates the FK constraint. Skip the DB write for non-UUID actors;
    // the interceptor already logs these to stdout.
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(input.actor)) {
      this.logger.debug(
        `[Audit] Skipping DB write for non-user actor="${input.actor}" action="${input.action}"`,
      );
      return;
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          actor: input.actor,
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId,
          tenantId: input.tenantId,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          result: input.result ?? 'success',
          details: (input.details ?? {}) as never,
        },
      });
    } catch (err) {
      // Never let audit failures break the main flow
      this.logger.warn(`[Audit] Failed to write log: ${String(err)}`);
    }
  }

  async findAll(opts: {
    tenantId?: string;
    actor?: string;
    action?: string;
    resource?: string;
    page?: number;
    limit?: number;
    from?: Date;
    to?: Date;
  }) {
    const {
      tenantId,
      actor,
      action,
      resource,
      page = 1,
      limit = 30,
      from,
      to,
    } = opts;
    const skip = (page - 1) * limit;

    const where = {
      ...(tenantId && { tenantId }),
      ...(actor && { actor }),
      ...(action && {
        action: { contains: action, mode: 'insensitive' as const },
      }),
      ...(resource && { resource }),
      ...((from || to) && {
        createdAt: {
          ...(from && { gte: from }),
          ...(to && { lte: to }),
        },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findByAgent(
    agentId: string,
    tenantId: string,
    opts: { page?: number; limit?: number } = {},
  ) {
    const { page = 1, limit = 20 } = opts;
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where: { resourceId: agentId, resource: 'agent', tenantId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.auditLog.count({
        where: { resourceId: agentId, resource: 'agent', tenantId },
      }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
