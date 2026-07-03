import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { IndustryPackagesService } from '../admin-pool/services/industry-packages.service';
import { UserRole, Industry } from '@prisma/client';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import type {
  IOnboardingService,
  OnboardingStatePayload,
} from './interfaces/onboarding.interface';

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
    private readonly packagesService: IndustryPackagesService,
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
      step: (tenant.onboardingStep as OnboardingStatePayload['step']) ?? 'plan',
      tierId: tenant.tierId,
      company: {
        name: tenant.name,
        logoUrl: tenant.logoUrl ?? undefined,
        industry: tenant.industry ?? undefined,
      },
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
    const createdDepts: { id: string; name: string }[] = [];
    for (const item of structure) {
      const overrideName = overrides?.[item.name]?.name ?? item.name;
      const dept = await this.prisma.department.create({
        data: {
          tenantId,
          name: overrideName,
        },
      });
      createdDepts.push({ id: dept.id, name: dept.name });
    }

    // ─── Expand tier agent pool entries into Agents ────────────────────────
    let agentsCreated = 0;
    for (const pool of tenant.tier.tierAgentPools) {
      if (!pool.isDefaultSelected && !pool.isRequired) continue;
      const tmpl = pool.template;
      const deptForAgent = createdDepts[0]?.id ?? null;
      const overrideName = overrides?.[tmpl.name]?.name;
      const isSelected = overrides?.[tmpl.name]?.isSelected ?? true;

      await this.prisma.agent.create({
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
      });
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
    this.logger.log(`Onboarding completed for tenant ${tenantId}`);
    return { completedAt };
  }

  // ─── Admin-pool: recommend + deploy IndustryPackage ─────────────────

  async recommendPackage(industry: string, tierId: string) {
    // Cast free text to Industry enum. If not a valid enum value, return null.
    const industryEnum = industry as Industry;
    const valid: readonly Industry[] = [
      'HEALTHCARE',
      'LEGAL',
      'REAL_ESTATE',
      'ECOMMERCE',
      'SAAS',
      'EDUCATION',
      'FINANCE',
      'MARKETING_AGENCY',
      'CONSULTING',
      'MANUFACTURING',
      'GENERAL',
    ];
    if (!valid.includes(industryEnum)) return null;

    return this.packagesService.recommend(industryEnum, tierId);
  }

  async deployPackage(
    tenantId: string,
    packageId: string,
    selections?: Record<string, { isSelected?: boolean; name?: string }>,
  ) {
    const pkg = await this.prisma.industryPackage.findUnique({
      where: { id: packageId },
      include: {
        tier: {
          select: {
            id: true,
            slug: true,
            maxAgents: true,
            maxDepartments: true,
          },
        },
        entries: {
          include: { poolAgent: true },
          orderBy: [{ divisionSlug: 'asc' }, { slot: 'asc' }],
        },
      },
    });
    if (!pkg || !pkg.isActive) {
      throw new NotFoundException('IndustryPackage not found or inactive');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    if (pkg.tierId !== tenant.tierId) {
      throw new ForbiddenException(
        `Package tier (${pkg.tier.slug}) does not match tenant tier.`,
      );
    }

    // Tier-limit pre-flight
    const divisionSlugs = new Set(pkg.entries.map((e) => e.divisionSlug));
    if (divisionSlugs.size > pkg.tier.maxDepartments) {
      throw new ForbiddenException(
        `Package requires ${divisionSlugs.size} departments but tier allows ${pkg.tier.maxDepartments}.`,
      );
    }
    const existingSelected = await this.prisma.agent.count({
      where: { tenantId, isSelected: true },
    });
    const filteredEntries = pkg.entries.filter(
      (e) => selections?.[e.poolAgentId]?.isSelected !== false,
    );
    if (existingSelected + filteredEntries.length > pkg.tier.maxAgents) {
      throw new ForbiddenException(
        `Would exceed tier agent limit (${pkg.tier.maxAgents}). Deselect some agents or upgrade.`,
      );
    }

    // Upsert Departments per division
    const divisionLabels: Record<string, string> = {};
    const poolDepts = await this.prisma.poolDepartment.findMany({
      where: { slug: { in: Array.from(divisionSlugs) } },
    });
    for (const d of poolDepts) divisionLabels[d.slug] = d.name;

    const deptById = new Map<string, { id: string; name: string }>();
    for (const slug of divisionSlugs) {
      const name = divisionLabels[slug] ?? slug;
      // Find or create
      let dept = await this.prisma.department.findFirst({
        where: { tenantId, name },
      });
      if (!dept) {
        dept = await this.prisma.department.create({
          data: { tenantId, name, status: 'ACTIVE' },
        });
      }
      deptById.set(slug, dept);
    }

    // Upsert Agents (idempotent on `tenantId + poolSourceId`)
    let agentsCreated = 0;
    for (const entry of pkg.entries) {
      const sel =
        selections?.[entry.poolAgent.slug] ?? selections?.[entry.poolAgentId];
      if (sel?.isSelected === false && !entry.isRequired) continue;

      const dept = deptById.get(entry.divisionSlug);
      if (!dept) continue;

      await this.prisma.agent.upsert({
        where: {
          tenantId_poolSourceId: {
            tenantId,
            poolSourceId: entry.poolAgentId,
          },
        },
        update: {
          isSelected: sel?.isSelected ?? entry.isDefaultSelected,
        },
        create: {
          tenantId,
          name: sel?.name ?? entry.poolAgent.name,
          description: entry.poolAgent.description,
          type: 'FUNCTIONAL',
          status: 'IDLE',
          model: entry.defaultModel ?? 'gpt-4o-mini',
          systemPrompt: entry.poolAgent.systemPrompt,
          instructions: null,
          budgetPerDay: entry.defaultBudgetPerDay ?? 5,
          permissions: [],
          config: {},
          metadata: {
            source: 'industry-package',
            poolAgentId: entry.poolAgent.id,
            poolDepartmentSlug: entry.divisionSlug,
            industry: pkg.industry,
            packageId: pkg.id,
          },
          departmentId: dept.id,
          poolSourceId: entry.poolAgentId,
          createdById: null,
          isSelected: sel?.isSelected ?? entry.isDefaultSelected,
        },
      });
      agentsCreated++;
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { onboardingStep: 'review' },
    });

    this.logger.log(
      `Deployed IndustryPackage ${pkg.id} to tenant ${tenantId}: ${deptById.size} depts, ${agentsCreated} agents`,
    );

    return {
      departmentsCreated: deptById.size,
      agentsCreated,
      packageName: pkg.name,
    };
  }
}
