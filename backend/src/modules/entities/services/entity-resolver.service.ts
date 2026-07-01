/**
 * EntityResolver — loads any EAOS-1 entity by (type, id) and returns a
 * normalized shape that all 10 capability panels can consume.
 *
 * Phase 3, Task 3.1 + 3.6 (per `EAOS-implementation-plan.md` §1, §9.4 +
 * `EAOS-api-contract.md` §8).
 *
 * Single Responsibility: given a type+id, return the underlying row OR
 * throw a 404. Capability panels consume the result, not the raw Prisma
 * model — this keeps panels stable as we add Solution Packs.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  EAOS_ENTITY_MODEL_MAP,
  EaosEntityType,
} from '../dto/entity.dto';

export interface ResolvedEntity {
  id: string;
  type: EaosEntityType;
  tenantId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string | null;
  raw: Record<string, unknown>;
}

@Injectable()
export class EntityResolverService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve an entity by type+id within the caller's tenant. Throws
   * NotFoundException if the row does not exist.
   */
  async resolve(
    type: EaosEntityType,
    id: string,
    tenantId: string,
  ): Promise<ResolvedEntity> {
    const model = EAOS_ENTITY_MODEL_MAP[type];
    if (!model) {
      throw new NotFoundException({
        code: 'ENTITY_TYPE_UNKNOWN',
        message: `Unknown entity type: ${type}`,
      });
    }

    // Prisma model access via dynamic key — typed as `any` because the
    // map's value is a string. The fallback chain handles type drift.
    const delegate = (this.prisma as unknown as Record<string, any>)[model];
    if (!delegate || typeof delegate.findFirst !== 'function') {
      throw new NotFoundException({
        code: 'ENTITY_MODEL_MISSING',
        message: `Prisma model "${model}" not available on client.`,
      });
    }

    const row = await delegate.findFirst({
      where: { id, tenantId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'ENTITY_NOT_FOUND',
        message: `${type} ${id} not found in this tenant.`,
      });
    }

    return {
      id: row.id as string,
      type,
      tenantId: row.tenantId as string,
      name: this.extractName(row, type),
      description: (row.description as string | null | undefined) ?? null,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
      ownerId:
        (row.ownerId as string | null | undefined) ??
        (row.createdById as string | null | undefined) ??
        null,
      raw: row as Record<string, unknown>,
    };
  }

  /**
   * Best-effort name extraction. Some models use `firstName`/`lastName`
   * (User), some use `name`, some use `title`.
   */
  private extractName(row: Record<string, unknown>, type: EaosEntityType): string {
    if (typeof row.name === 'string' && row.name.length > 0) return row.name;
    if (typeof row.title === 'string' && row.title.length > 0) return row.title;

    if (type === 'USER') {
      const first = typeof row.firstName === 'string' ? row.firstName : '';
      const last = typeof row.lastName === 'string' ? row.lastName : '';
      const full = `${first} ${last}`.trim();
      if (full.length > 0) return full;
    }
    return `${type} ${String(row.id).slice(0, 8)}`;
  }
}
