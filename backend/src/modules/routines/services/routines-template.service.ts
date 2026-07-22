/**
 * RoutinesTemplateService
 *
 * Stage 1 §4.7.3 — Materialises Routine runtime rows from TenantTemplate
 * (type=ROUTINE) definitions. Acts as the bridge between the
 * configuration-style template and the cron-scheduled Routine entity.
 *
 * SOLID:
 *  - SRP: this service ONLY materialises routines from templates.
 *  - DIP: depends on PrismaService + TenantTemplateRuntimeService abstractions.
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { TenantTemplateRuntimeService } from '../../tenant-templates/tenant-template-runtime.service';
import type { Routine } from '@prisma/client';

export interface MaterialiseFromTemplateParams {
  tenantId: string;
  templateSlug: string;
  actorId?: string;
}

@Injectable()
export class RoutinesTemplateService {
  private readonly logger = new Logger(RoutinesTemplateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templateRuntime: TenantTemplateRuntimeService,
  ) {}

  /**
   * Create a Routine row from a TenantTemplate (type=ROUTINE) definition.
   * Idempotent — returns the existing routine if (tenantId, templateSlug)
   * already maps to a routine.
   */
  async materialiseFromTemplate(
    params: MaterialiseFromTemplateParams,
  ): Promise<Routine> {
    const { tenantId, templateSlug, actorId } = params;

    const tplConfig = await this.templateRuntime.resolveRoutineConfig(
      tenantId,
      templateSlug,
    );
    if (!tplConfig) {
      throw new NotFoundException(
        `Routine template '${templateSlug}' not found for tenant ${tenantId}`,
      );
    }
    if (!tplConfig.action) {
      throw new BadRequestException(
        `Routine template '${templateSlug}' has no action defined`,
      );
    }

    // Idempotency: lookup existing routine by deterministic slug-derived name.
    const name = `tpl:${templateSlug}`;
    const existing = await this.prisma.routine.findFirst({
      where: { tenantId, name },
    });
    if (existing) return existing;

    const created = await this.prisma.routine.create({
      data: {
        tenantId,
        name,
        description: tplConfig.action,
        status: 'DRAFT',
        graphDefinition: {},
        config: {
          templateSlug,
          sourceTemplateId: tplConfig.sourceTemplateId,
          channels: tplConfig.channels ?? [],
          trigger: tplConfig.trigger,
          cronExpression: this.parseCronFromTrigger(tplConfig.trigger),
        },
        createdById: actorId ?? null,
      },
    });

    // Also create a SCHEDULE trigger if the template had a cron parseable.
    const cron = this.parseCronFromTrigger(tplConfig.trigger);
    if (cron) {
      await this.prisma.routineTrigger.create({
        data: {
          routineId: created.id,
          type: 'SCHEDULE',
          name: `${templateSlug}-schedule`,
          config: { cronExpression: cron },
        },
      });
    }

    this.logger.log(
      `Materialised routine ${created.id} from template ${templateSlug} for tenant ${tenantId}`,
    );
    return created;
  }

  /**
   * Parse simple "time: HH:MM daily" / "time: Monday 8:00 AM" / cron-style
   * triggers into a cron expression. Falls back to daily 09:00 for unknown
   * formats so the routine is still schedulable.
   */
  private parseCronFromTrigger(trigger?: string): string | null {
    if (!trigger) return null;
    const cronMatch = trigger.match(/(\S+\s+\S+\s+\S+\s+\S+\s+\S+)/);
    if (cronMatch) return cronMatch[1];

    const dailyMatch = trigger.match(/(\d{1,2}):(\d{2})\s*(?:daily)?/i);
    if (dailyMatch) {
      return `0 ${dailyMatch[2]} ${dailyMatch[1]} * * *`;
    }
    return '0 9 * * *';
  }
}