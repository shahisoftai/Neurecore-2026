/**
 * TenantTemplateRuntimeService
 *
 * Stage 1 §4.7 — Runtime consumer for `TenantTemplate` configs.
 *
 * Each tenant-scoped template type is consumed by a specific existing or new
 * service. Without this wiring, templates are database rows no one reads.
 *
 * This service is the single read-side facade that the consuming services
 * (DeploymentService, RoutinesRunner, TasksService, DepartmentsService) call
 * to resolve template-derived values. It is injected as `@Optional()` so
 * that the module remains usable even if `TenantTemplatesModule` is not
 * imported (e.g. test harnesses).
 *
 * SOLID:
 *  - SRP: this service ONLY reads tenant templates and shapes them for runtime
 *         consumers. No write paths — create/update lives in TenantTemplateService.
 *  - OCP: new template type consumption = new method here. No consumer changes.
 *  - DIP: consumers depend on this abstraction, not on prisma directly.
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TemplateType } from '@prisma/client';
import type { TenantTemplate } from '@prisma/client';

export interface AgentRoleOverride {
  systemPrompt?: string;
  kpis?: Array<{ name: string; target?: string }>;
  sourceTemplateId?: string;
  sourceTemplateVersion?: number;
}

export interface RoutineTemplateConfig {
  trigger?: string;
  action?: string;
  channels?: string[];
  sourceTemplateId?: string;
}

export interface TaskTemplateSummary {
  slug: string;
  name: string;
  description?: string;
  estimatedDuration?: string;
  assignToRole?: string;
  subtasks: string[];
  sourceTemplateId?: string;
}

export interface DepartmentStructureTemplate {
  name: string;
  roles: string[];
}

export interface DepartmentTemplateConfig {
  departments: DepartmentStructureTemplate[];
  sourceTemplateId?: string;
}

@Injectable()
export class TenantTemplateRuntimeService {
  private readonly logger = new Logger(TenantTemplateRuntimeService.name);

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  private async findTenantTemplate(
    tenantId: string,
    slug: string,
    templateType: TemplateType,
  ): Promise<TenantTemplate | null> {
    if (!this.prisma) return null;
    return this.prisma.tenantTemplate.findUnique({
      where: {
        tenantId_slug_templateType: { tenantId, slug, templateType },
      },
    });
  }

  private async findActiveTemplates(
    tenantId: string,
    templateType: TemplateType,
    industrySlug?: string | null,
  ): Promise<TenantTemplate[]> {
    if (!this.prisma) return [];
    return this.prisma.tenantTemplate.findMany({
      where: {
        tenantId,
        templateType,
        isActive: true,
        ...(industrySlug ? { industrySlug } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  // ── 1. AGENT_ROLE → DeploymentService.spawnFromTemplate ──────────────
  //
  // If the tenant has an AGENT_ROLE template with the same slug as the
  // platform template being spawned, merge its systemPrompt + kpis over
  // the platform defaults. Tenant-authored content wins.

  async resolveAgentRoleOverride(
    tenantId: string,
    templateSlug: string,
  ): Promise<AgentRoleOverride | null> {
    const tpl = await this.findTenantTemplate(
      tenantId,
      templateSlug,
      'AGENT_ROLE',
    );
    if (!tpl) return null;

    const cfg = (tpl.config ?? {}) as {
      systemPrompt?: string;
      kpis?: Array<{ name: string; target?: string }>;
    };

    return {
      systemPrompt: cfg.systemPrompt,
      kpis: cfg.kpis,
      sourceTemplateId: tpl.id,
      sourceTemplateVersion: tpl.version,
    };
  }

  // ── 2. ROUTINE → RoutinesRunner ──────────────────────────────────────
  //
  // Returns the template-driven trigger/action/channels for a routine
  // that was instantiated from a template slug. Runtime Routine rows
  // (the cron registration) still live in the routines table; this is
  // the descriptive content shown in notifications and audit logs.

  async resolveRoutineConfig(
    tenantId: string,
    templateSlug: string,
  ): Promise<RoutineTemplateConfig | null> {
    const tpl = await this.findTenantTemplate(
      tenantId,
      templateSlug,
      'ROUTINE',
    );
    if (!tpl) return null;
    const cfg = (tpl.config ?? {}) as {
      trigger?: string;
      action?: string;
      channels?: string[];
    };
    return {
      trigger: cfg.trigger,
      action: cfg.action,
      channels: cfg.channels,
      sourceTemplateId: tpl.id,
    };
  }

  async listActiveRoutinesForTenant(
    tenantId: string,
    industrySlug?: string | null,
  ): Promise<RoutineTemplateConfig[]> {
    const tpls = await this.findActiveTemplates(
      tenantId,
      'ROUTINE',
      industrySlug,
    );
    return tpls.map((t) => {
      const cfg = (t.config ?? {}) as {
        trigger?: string;
        action?: string;
        channels?: string[];
      };
      return {
        trigger: cfg.trigger,
        action: cfg.action,
        channels: cfg.channels,
        sourceTemplateId: t.id,
      };
    });
  }

  // ── 3. TASK_TEMPLATE → TasksService.createFromTemplate ──────────────
  //
  // Returns the subtask list + default assignee for project task seeding.
  // Called by the project creation flow to seed initial tasks.

  async listTaskTemplatesForIndustry(
    tenantId: string,
    industrySlug?: string | null,
  ): Promise<TaskTemplateSummary[]> {
    const tpls = await this.findActiveTemplates(
      tenantId,
      'TASK_TEMPLATE',
      industrySlug,
    );
    return tpls.map((t) => {
      const cfg = (t.config ?? {}) as {
        description?: string;
        estimatedDuration?: string;
        assignToRole?: string;
        subtasks?: string[];
      };
      return {
        slug: t.slug,
        name: t.name,
        description: cfg.description,
        estimatedDuration: cfg.estimatedDuration,
        assignToRole: cfg.assignToRole,
        subtasks: cfg.subtasks ?? [],
        sourceTemplateId: t.id,
      };
    });
  }

  // ── 4. DEPARTMENT_DEFAULT → DepartmentsService.autoCreate ───────────
  //
  // Reads the department structure from a tenant's DEPARTMENT_DEFAULT
  // template. Returns the full department + role list to be created.

  async resolveDepartmentTemplate(
    tenantId: string,
    templateSlug = 'financial-dept-structure',
  ): Promise<DepartmentTemplateConfig | null> {
    const tpl = await this.findTenantTemplate(
      tenantId,
      templateSlug,
      'DEPARTMENT_DEFAULT',
    );
    if (!tpl) return null;
    const cfg = (tpl.config ?? {}) as {
      departments?: DepartmentStructureTemplate[];
    };
    return {
      departments: cfg.departments ?? [],
      sourceTemplateId: tpl.id,
    };
  }

  async listDepartmentTemplatesForTenant(
    tenantId: string,
    industrySlug?: string | null,
  ): Promise<DepartmentTemplateConfig[]> {
    const tpls = await this.findActiveTemplates(
      tenantId,
      'DEPARTMENT_DEFAULT',
      industrySlug,
    );
    return tpls.map((t) => {
      const cfg = (t.config ?? {}) as {
        departments?: DepartmentStructureTemplate[];
      };
      return {
        departments: cfg.departments ?? [],
        sourceTemplateId: t.id,
      };
    });
  }

  // ── 5. CUSTOMER_LIFECYCLE → CustomerLifecycleService ─────────────────
  //
  // Returns the lifecycle stage pipeline + default stage + custom field
  // definitions for the tenant. The frontend reads this via REST.

  async resolveCustomerLifecycle(
    tenantId: string,
    templateSlug?: string,
  ): Promise<{
    stages: Array<{ key: string; label: string; order: number }>;
    defaultStage?: string;
    customerFieldDefinitions: Array<{
      key: string;
      label: string;
      type: string;
      options?: string[];
    }>;
    sourceTemplateId?: string;
  } | null> {
    const tpl = templateSlug
      ? await this.findTenantTemplate(
          tenantId,
          templateSlug,
          'CUSTOMER_LIFECYCLE',
        )
      : this.prisma
        ? await this.prisma.tenantTemplate.findFirst({
            where: {
              tenantId,
              templateType: 'CUSTOMER_LIFECYCLE',
              isActive: true,
            },
            orderBy: { name: 'asc' },
          })
        : null;
    if (!tpl) return null;
    const cfg = (tpl.config ?? {}) as {
      stages?: Array<{ key: string; label: string; order: number }>;
      defaultStage?: string;
      customerFieldDefinitions?: Array<{
        key: string;
        label: string;
        type: string;
        options?: string[];
      }>;
    };
    return {
      stages: cfg.stages ?? [],
      defaultStage: cfg.defaultStage,
      customerFieldDefinitions: cfg.customerFieldDefinitions ?? [],
      sourceTemplateId: tpl.id,
    };
  }

  // ── 6. REPORT → ReportEngine ────────────────────────────────────────
  //
  // Returns the report config for a tenant template. Backend reads
  // metrics/period/format to assemble data.

  async resolveReportTemplate(
    tenantId: string,
    templateSlug: string,
  ): Promise<{
    metrics: string[];
    period?: string;
    format?: string;
    sourceTemplateId?: string;
  } | null> {
    const tpl = await this.findTenantTemplate(tenantId, templateSlug, 'REPORT');
    if (!tpl) return null;
    const cfg = (tpl.config ?? {}) as {
      metrics?: string[];
      period?: string;
      format?: string;
    };
    return {
      metrics: cfg.metrics ?? [],
      period: cfg.period,
      format: cfg.format,
      sourceTemplateId: tpl.id,
    };
  }
}
