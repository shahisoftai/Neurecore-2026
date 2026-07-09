import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { EntityType, RelationshipType } from '@prisma/client';

@Injectable()
export class CostCenterService {
  constructor(private readonly prisma: PrismaService) {}

  async getDepartmentCost(
    deptId: string,
    tenantId: string,
    period: { from: Date; to: Date },
  ) {
    const agentEdges = await this.prisma.entityRelationship.findMany({
      where: {
        tenantId,
        fromType: 'DEPARTMENT' as EntityType,
        fromId: deptId,
        type: 'OPERATES_IN' as RelationshipType,
      },
    });
    const agentIds = agentEdges.map((e) => e.toId);

    const cost = await this.prisma.hermesAuditLog.aggregate({
      where: {
        tenantId,
        hermesAgentId: { in: agentIds.length > 0 ? agentIds : ['__none__'] },
        createdAt: { gte: period.from, lte: period.to },
      },
      _sum: { costUsd: true, tokensUsed: true },
      _count: true,
    });

    return {
      departmentId: deptId,
      totalCostUsd: cost._sum.costUsd ?? 0,
      totalTokens: cost._sum.tokensUsed ?? 0,
      totalActions: cost._count,
      period,
    };
  }
}
