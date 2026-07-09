import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EntityGraphService } from './entity-graph.service';
import { ConversationIntelligenceService } from './conversation-intelligence.service';
import type { EntityType } from '@prisma/client';
import { LLMFactory } from '../../models/services/llm-factory.service';

export interface DigestScope {
  type: 'AGENT' | 'DEPARTMENT' | 'GOAL' | 'PROJECT' | 'TENANT';
  id: string;
}

export interface DigestParams {
  scope: DigestScope;
  tenantId: string;
  period: { from: Date; to: Date };
}

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entityGraph: EntityGraphService,
    private readonly conversationIntelligence: ConversationIntelligenceService,
    private readonly llmFactory: LLMFactory,
  ) {}

  async generate(params: DigestParams): Promise<string> {
    const participantIds = await this.resolveParticipants(params);

    if (participantIds.length === 0) {
      return `No participants found in scope ${params.scope.type}:${params.scope.id}`;
    }

    const summaries = await Promise.all(
      participantIds.slice(0, 20).map((id) =>
        this.conversationIntelligence
          .summarize({
            participantType: 'AI_AGENT',
            participantId: id,
            tenantId: params.tenantId,
            from: params.period.from,
            to: params.period.to,
          })
          .catch((err) => {
            this.logger.warn(`summarize failed for ${id}: ${String(err)}`);
            return null;
          }),
      ),
    );

    const valid = summaries.filter(
      (s): s is NonNullable<typeof s> => s !== null,
    );

    if (valid.length === 0) {
      return `No activity recorded for ${params.scope.type}:${params.scope.id} in this period.`;
    }

    const merged = valid
      .map(
        (s, i) =>
          `[Agent ${i + 1}/${valid.length} ${s.participantId}]: ${s.narrative}`,
      )
      .join('\n\n');

    try {
      const result = await this.llmFactory.invoke(
        `Produce a concise weekly digest summarizing the following agent narratives. Group by themes, highlight key outcomes and outstanding action items.\n\n${merged}`,
        { temperature: 0.3, maxTokens: 800 },
      );
      return result.content;
    } catch {
      return merged.slice(0, 4000);
    }
  }

  private async resolveParticipants(params: DigestParams): Promise<string[]> {
    if (params.scope.type === 'TENANT') {
      const agents = await this.prisma.hermesAgent.findMany({
        where: { tenantId: params.tenantId, isActive: true },
        select: { id: true },
      });
      return agents.map((a) => a.id);
    }

    const entityType = this.scopeToEntityType(params.scope.type);
    if (!entityType) return [];

    const sub = await this.entityGraph.getSubgraph({
      entityType,
      entityId: params.scope.id,
      tenantId: params.tenantId,
      depth: 3,
    });

    const seen = new Set<string>();
    const result: string[] = [];
    for (const e of sub.entities) {
      if (e.type === ('AGENT' as EntityType) && !seen.has(e.id)) {
        seen.add(e.id);
        result.push(e.id);
      }
    }
    return result;
  }

  private scopeToEntityType(scope: string): EntityType | null {
    switch (scope) {
      case 'DEPARTMENT':
        return 'DEPARTMENT' as EntityType;
      case 'GOAL':
        return 'GOAL' as EntityType;
      case 'PROJECT':
        return 'PROJECT' as EntityType;
      default:
        return null;
    }
  }
}
