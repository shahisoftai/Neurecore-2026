import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { HermesRegistryService } from './hermes-registry.service';
import type {
  IParticipantResolver,
  ParticipantProfile,
  ParticipantRef,
} from '../interfaces/IParticipantResolver';
import type { ParticipantType } from '@prisma/client';

const cacheKey = (type: ParticipantType, id: string, tenantId: string) =>
  `${tenantId}:${type}:${id}`;

@Injectable()
export class ParticipantResolver implements IParticipantResolver {
  private readonly logger = new Logger(ParticipantResolver.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hermesRegistry: HermesRegistryService,
  ) {}

  async resolve(
    type: ParticipantType,
    id: string,
    tenantId: string,
  ): Promise<ParticipantProfile | null> {
    switch (type) {
      case 'USER': {
        const user = await this.prisma.user.findFirst({
          where: { id, tenantId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            departmentId: true,
          },
        });
        if (!user) return null;
        const displayName =
          [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
          user.id;
        return {
          id: user.id,
          type,
          displayName,
          tenantId,
          avatarUrl: user.avatarUrl ?? undefined,
          departmentId: user.departmentId ?? undefined,
        };
      }
      case 'AI_AGENT': {
        const agent = await this.hermesRegistry.findById(id);
        if (!agent || agent.tenantId !== tenantId) return null;
        return {
          id: agent.id,
          type,
          displayName: agent.name,
          tenantId,
          status: agent.status,
        };
      }
      case 'SYSTEM':
        return { id, type, displayName: 'System', tenantId };
      case 'WORKFLOW':
        return {
          id,
          type,
          displayName: `Workflow ${id.slice(0, 8)}`,
          tenantId,
        };
      case 'EXTERNAL':
        return {
          id,
          type,
          displayName: `External ${id.slice(0, 8)}`,
          tenantId,
        };
      default:
        return null;
    }
  }

  async resolveBatch(
    participants: ParticipantRef[],
  ): Promise<Map<string, ParticipantProfile>> {
    const out = new Map<string, ParticipantProfile>();
    await Promise.all(
      participants.map(async (p) => {
        const profile = await this.resolve(p.type, p.id, p.tenantId);
        if (profile) {
          out.set(cacheKey(p.type, p.id, p.tenantId), profile);
        }
      }),
    );
    return out;
  }

  async search(
    query: string,
    tenantId: string,
    types?: ParticipantType[],
  ): Promise<ParticipantProfile[]> {
    const want = new Set<ParticipantType>(
      types && types.length > 0
        ? types
        : ['USER', 'AI_AGENT', 'SYSTEM', 'WORKFLOW', 'EXTERNAL'],
    );
    const results: ParticipantProfile[] = [];

    if (want.has('USER')) {
      const users = await this.prisma.user.findMany({
        where: {
          tenantId,
          isActive: true,
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: 20,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      });
      results.push(
        ...users.map((u) => ({
          id: u.id,
          type: 'USER' as ParticipantType,
          displayName:
            [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.id,
          tenantId,
          avatarUrl: u.avatarUrl ?? undefined,
        })),
      );
    }

    if (want.has('AI_AGENT')) {
      const agents = await this.prisma.hermesAgent.findMany({
        where: {
          tenantId,
          isActive: true,
          name: { contains: query, mode: 'insensitive' },
        },
        take: 20,
        select: { id: true, name: true, status: true },
      });
      results.push(
        ...agents.map((a) => ({
          id: a.id,
          type: 'AI_AGENT' as ParticipantType,
          displayName: a.name,
          tenantId,
          status: a.status,
        })),
      );
    }

    return results;
  }
}
