import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UserRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import type {
  IOnboardingService,
  OnboardingStatePayload,
} from './interfaces/onboarding.interface';
import { ChecklistService } from './checklist/checklist.service';
import { ProjectTypeAllocatorService } from '../project-types/allocators/project-type-allocator.service';
import { TenantTemplateSeederService } from '../tenant-templates/tenant-template-seeder.service';
import { DepartmentsService } from '../departments/services/departments.service';

interface DeptTemplateStructureItem {
  name: string;
  description?: string;
  headAgentType?: string;
  parentName?: string;
}

const INVITE_EXPIRY_DAYS = 14;

@Injectable()
export class OnboardingService implements IOnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly checklist: ChecklistService,
    @Optional()
    private readonly allocator?: ProjectTypeAllocatorService,
    @Optional()
    private readonly templateSeeder?: TenantTemplateSeederService,
    @Optional()
    private readonly departmentsService?: DepartmentsService,
  ) {}

  async getState(tenantId: string): Promise<OnboardingStatePayload> {
    const [tenant, agentCount, deptCount] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { tier: true },
      }),
      this.prisma.agent.count({
        where: { tenantId, isSelected: true },
      }),
      this.prisma.department.count({
        where: { tenantId },
      }),
    ]);
    if (!tenant) throw new NotFoundException('Tenant not found');

    return {
      // WS-2.1: default to 'company' when onboarding hasn't started so the
      // wizard always begins at step 1 on fresh signups. 'plan' is only
      // returned when the user explicitly transitioned past company/logo/
      // localization (i.e. onboardingStep was set to 'plan' or later).
      step:
        (tenant.onboardingStep as OnboardingStatePayload['step']) ?? 'company',
      tierId: tenant.tierId,
      company: {
        name: tenant.name,
        logoUrl: tenant.logoUrl ?? undefined,
        industry: tenant.industry ?? undefined,
      },
      // WS-2.1: expose timezone + currency so the wizard can resume correctly.
      timezone: tenant.timezone ?? undefined,
      currency: tenant.currency ?? undefined,
      templateSlug: undefined,
      departmentOverrides: {},
      agentOverrides: {},
    };
  }

  async updateState(
    tenantId: string,
    partial: Partial<OnboardingStatePayload>,
  ): Promise<OnboardingStatePayload> {
    const existing = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!existing) throw new NotFoundException('Tenant not found');

    const updateData: Record<string, unknown> = {};
    if (partial.step) updateData.onboardingStep = partial.step;
    if (partial.company) {
      if (partial.company.name !== undefined)
        updateData.name = partial.company.name;
      if (partial.company.logoUrl !== undefined)
        updateData.logoUrl = partial.company.logoUrl;
      if (partial.company.industry !== undefined)
        updateData.industry = partial.company.industry;
    }

    // INDUSTRY-GROUPS-CONCEPT.md §5 — auto-derive industryGroup from the
    // selected Industry. Keeps Tenant.industryGroup in sync for fast rail
    // branching without forcing the frontend to send both fields.
    if (
      updateData.industry !== undefined &&
      typeof updateData.industry === 'string'
    ) {
      const industry = await this.prisma.industry.findUnique({
        where: { slug: updateData.industry },
        select: { industryGroup: true },
      });
      updateData.industryGroup = industry?.industryGroup ?? null;
    }
    // WS-2.1: persist timezone + currency (was silently dropped pre-PR-2).
    if (partial.timezone !== undefined) updateData.timezone = partial.timezone;
    if (partial.currency !== undefined) updateData.currency = partial.currency;

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
    });

    return this.getState(tenantId);
  }

  async selectTier(tenantId: string, tierId: string) {
    const tier = await this.prisma.tier.findUnique({ where: { id: tierId } });
    if (!tier || !tier.isActive) {
      throw new NotFoundException('Tier not found or inactive');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { tierId, onboardingStep: 'template' },
    });

    this.logger.log(`Tenant ${tenantId} selected tier ${tier.slug}`);
    return { tier: { id: tier.id, name: tier.name, slug: tier.slug } };
  }

  async selectTemplate(
    tenantId: string,
    templateSlug: string,
    overrides?: OnboardingStatePayload['agentOverrides'],
  ) {
    const template = await this.prisma.departmentTemplate.findUnique({
      where: { slug: templateSlug },
    });
    if (!template) throw new NotFoundException('Template not found');

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        tier: {
          include: {
            tierAgentPools: { include: { template: true } },
          },
        },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    // ─── WS-7 guard: enforce maxDepartments before expansion ───────────────
    const structure =
      (template.structure as unknown as DeptTemplateStructureItem[]) ?? [];
    const projectedDeptCount = structure.length;
    if (projectedDeptCount > tenant.tier.maxDepartments) {
      throw new ForbiddenException(
        `Template "${templateSlug}" requires ${projectedDeptCount} departments but tier "${tenant.tier.slug}" allows ${tenant.tier.maxDepartments}. Upgrade your tier or choose a smaller template.`,
      );
    }

    // Existing agents check — never silently exceed tier maxAgents
    const existingAgents = await this.prisma.agent.count({
      where: { tenantId, isSelected: true },
    });
    const projectedAgents = Math.max(1, Math.ceil(projectedDeptCount * 1.5));
    if (existingAgents + projectedAgents > tenant.tier.maxAgents) {
      throw new ForbiddenException(
        `Template would exceed tier agent limit (${tenant.tier.maxAgents}). Deselect existing agents or upgrade.`,
      );
    }

    // ─── Expand template into Departments ─────────────────────────────────
    interface CreatedDept {
      id: string;
      name: string;
      headAgentType: string;
    }
    const createdDepts: CreatedDept[] = [];
    for (const item of structure) {
      const overrideName = overrides?.[item.name]?.name ?? item.name;
      const dept = await this.prisma.department.create({
        data: {
          tenantId,
          name: overrideName,
        },
      });
      createdDepts.push({
        id: dept.id,
        name: dept.name,
        headAgentType: item.headAgentType ?? 'FUNCTIONAL',
      });
    }

    // Bucket departments by the agent type they expect to lead them.
    // Multiple departments may share the same headAgentType, so we use
    // an array and round-robin through it for agent assignment.
    const deptsByHeadType = new Map<string, CreatedDept[]>();
    for (const dept of createdDepts) {
      const bucket = deptsByHeadType.get(dept.headAgentType) ?? [];
      bucket.push(dept);
      deptsByHeadType.set(dept.headAgentType, bucket);
    }
    // Round-robin cursors per type — indexed each time we assign an agent.
    const rrCursor = new Map<string, number>();
    const deptHeadIdAssigned = new Set<string>();

    // ─── Expand tier agent pool entries into Agents ────────────────────────
    let agentsCreated = 0;
    for (const pool of tenant.tier.tierAgentPools) {
      if (!pool.isDefaultSelected && !pool.isRequired) continue;
      const tmpl = pool.template;
      const overrideName = overrides?.[tmpl.name]?.name;
      const isSelected = overrides?.[tmpl.name]?.isSelected ?? true;

      // Pick the next department in round-robin order for this agent type.
      const typedBucket = deptsByHeadType.get(tmpl.type);
      const fallbackBucket = createdDepts[0] ? [createdDepts[0]] : [];
      const bucket = typedBucket ?? fallbackBucket;
      const cursor = rrCursor.get(tmpl.type) ?? 0;
      const matchingDept =
        bucket.length > 0
          ? (bucket[cursor % bucket.length] ?? createdDepts[0] ?? null)
          : null;
      rrCursor.set(tmpl.type, cursor + 1);
      const deptForAgent = matchingDept?.id ?? null;

      const created = await this.prisma.agent.create({
        data: {
          tenantId,
          name: overrideName ?? tmpl.name,
          type: tmpl.type,
          model: tmpl.model,
          systemPrompt: tmpl.systemPrompt ?? undefined,
          instructions: tmpl.instructions ?? undefined,
          permissions: (tmpl.permissions as never) ?? [],
          config: (tmpl.config as never) ?? {},
          templateId: tmpl.id,
          templateVersion: tmpl.version,
          tierAgentPoolId: pool.id,
          departmentId: deptForAgent,
          isSelected,
        },
        select: { id: true, type: true, departmentId: true },
      });

      // Pin the FIRST agent of each type to its matching department as head.
      // Departments outside the matched bucket are never assigned a head here.
      if (
        matchingDept &&
        !deptHeadIdAssigned.has(matchingDept.id) &&
        deptsByHeadType.get(created.type)?.some((d) => d.id === matchingDept.id)
      ) {
        await this.prisma.department.update({
          where: { id: matchingDept.id },
          data: { headAgentId: created.id },
        });
        deptHeadIdAssigned.add(matchingDept.id);
      }

      agentsCreated++;
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { onboardingStep: 'review' },
    });

    this.logger.log(
      `Template "${templateSlug}" deployed for tenant ${tenantId}: ${createdDepts.length} depts, ${agentsCreated} agents`,
    );
    return { departmentsCreated: createdDepts.length, agentsCreated };
  }

  async inviteMembers(
    tenantId: string,
    invitedById: string,
    invites: Array<{ email: string; role: UserRole }>,
  ) {
    if (!invites?.length) throw new BadRequestException('invites[] required');
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const tenantUserCount = await this.prisma.user.count({
      where: { tenantId },
    });
    const tier = await this.prisma.tier.findUnique({
      where: { id: tenant.tierId },
    });
    if (!tier) throw new NotFoundException('Tier missing');
    if (tenantUserCount + invites.length > tier.maxUsers) {
      throw new ForbiddenException(
        `Inviting ${invites.length} members would exceed tier limit of ${tier.maxUsers}.`,
      );
    }

    const tokens: string[] = [];
    const expiresAt = new Date(
      Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );

    for (const inv of invites) {
      const existing = await this.prisma.onboardingInvitation.findFirst({
        where: { tenantId, email: inv.email.toLowerCase(), acceptedAt: null },
      });
      if (existing) {
        tokens.push(existing.token);
        continue;
      }
      const token = randomBytes(24).toString('base64url');
      const row = await this.prisma.onboardingInvitation.create({
        data: {
          tenantId,
          email: inv.email.toLowerCase(),
          role: inv.role ?? UserRole.USER,
          token,
          expiresAt,
          invitedById,
        },
      });
      tokens.push(row.token);
    }

    return { tokens };
  }

  async acceptInvite(
    token: string,
    payload: { firstName: string; lastName: string; password: string },
  ) {
    const invite = await this.prisma.onboardingInvitation.findUnique({
      where: { token },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.acceptedAt)
      throw new ConflictException('Invite already accepted');
    if (invite.expiresAt < new Date())
      throw new ForbiddenException('Invite expired');

    const existingUser = await this.prisma.user.findUnique({
      where: { email: invite.email },
    });
    if (existingUser) {
      throw new ConflictException(
        'An account with this email already exists. Sign in instead.',
      );
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: invite.email,
        firstName: payload.firstName,
        lastName: payload.lastName,
        passwordHash,
        role: invite.role,
        tenantId: invite.tenantId,
        isActive: true,
      },
    });
    await this.prisma.onboardingInvitation.update({
      where: { token },
      data: { acceptedAt: new Date() },
    });

    return { userId: user.id, tenantId: invite.tenantId };
  }

  async complete(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const completedAt = new Date();
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        onboardingCompletedAt: completedAt,
        onboardingStep: 'complete',
      },
    });

    // Phase 2G: clone system ProjectTypes for this tenant's industry.
    // Idempotent — on re-run, existing clones are skipped.
    // Failure here does NOT abort onboarding (wrapped in try/catch).
    if (this.allocator) {
      try {
        const result = await this.allocator.allocateForTenant(
          tenantId,
          tenant.industry,
        );
        this.logger.log(
          `ProjectType allocation for tenant ${tenantId}: ` +
            `allocated=${result.allocated} skipped=${result.skipped}`,
        );
      } catch (err) {
        this.logger.error(
          `ProjectType allocation failed for tenant ${tenantId}: ` +
            `${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Stage 1: Seed tenant-scoped templates from industry system seeds.
    // Idempotent — on re-run, existing clones are skipped.
    // Failure here does NOT abort onboarding (wrapped in try/catch).
    if (this.templateSeeder && tenant.industry) {
      try {
        const templateCount = await this.templateSeeder.seedForTenant(
          tenantId,
          tenant.industry,
        );
        this.logger.log(
          `Seeded ${templateCount} templates for tenant ${tenantId} (industry: ${tenant.industry})`,
        );
      } catch (err) {
        this.logger.error(
          `Template seeding failed for tenant ${tenantId}: ` +
            `${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Stage 1 §4.7: Auto-create departments from DEPARTMENT_DEFAULT template
    // (Stage 1 tenant-owned template path — runs after the legacy
    // DepartmentTemplate path above so the existing behaviour is preserved).
    if (this.departmentsService) {
      try {
        const result =
          await this.departmentsService.autoCreateFromTemplate(tenantId);
        if (result.created > 0 || result.skipped > 0) {
          this.logger.log(
            `Department auto-create from template for tenant ${tenantId}: created=${result.created} skipped=${result.skipped}`,
          );
        }
      } catch (err) {
        this.logger.error(
          `Department auto-create from template failed for tenant ${tenantId}: ` +
            `${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // WS-2.1: Seed the progressive onboarding checklist. Idempotent — safe to
    // call on tenants that already have checklist rows (e.g. re-running
    // /onboarding/complete after a bug fix or a re-deploy).
    try {
      await this.checklist.seed(tenantId);
    } catch (err) {
      // Don't fail the whole complete() if seeding blows up — log loudly so
      // ops can reconcile. The checklist can be re-seeded via a one-off
      // script (see memory-bank-new/plans/onboarding-progressive-wizard.md §6).
      this.logger.error(
        `Checklist seed failed for tenant ${tenantId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    this.logger.log(`Onboarding completed for tenant ${tenantId}`);
    return { completedAt };
  }
}
