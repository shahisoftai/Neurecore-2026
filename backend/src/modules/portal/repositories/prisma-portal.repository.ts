import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  IPortalRepository,
  PortalProject,
  PortalDeliverable,
} from '../interfaces/portal.interface';
import type { CustomerContact } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class PrismaPortalRepository implements IPortalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findProjectForPortal(
    projectId: string,
    contactId: string,
  ): Promise<PortalProject | null> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        customer: {
          contacts: {
            some: { id: contactId },
          },
        },
      },
      include: {
        customer: { select: { name: true } },
        stages: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            name: true,
            status: true,
            order: true,
          },
        },
        deliverables: {
          where: { clientFacing: true },
          include: {
            versions: {
              orderBy: { version: 'desc' },
              take: 1,
              select: {
                version: true,
                summary: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!project) return null;

    const deliverables: PortalDeliverable[] = project.deliverables.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      status: d.status,
      clientFacing: d.clientFacing,
      createdAt: d.createdAt,
      latestVersion: d.versions[0] ?? null,
    }));

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      customerName: project.customer?.name ?? null,
      targetDate: project.targetDate,
      startDate: project.startDate,
      budgetType: project.budgetType ?? null,
      budgetAmount: project.budgetAmount
        ? Number(project.budgetAmount)
        : null,
      budgetCurrency: project.budgetCurrency,
      stages: project.stages.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        order: s.order,
      })),
      deliverables,
    };
  }

  async validatePortalToken(
    contactId: string,
    token: string,
  ): Promise<CustomerContact | null> {
    const contact = await this.prisma.customerContact.findUnique({
      where: { id: contactId },
    });

    if (!contact) return null;

    const { portalToken, portalTokenExpiresAt } = contact;
    if (!portalToken || portalTokenExpiresAt === null) return null;

    const expected = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    if (portalToken !== expected) return null;
    if (portalTokenExpiresAt < new Date()) return null;

    return contact;
  }

  async createPortalToken(contactId: string, projectId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.customerContact.update({
      where: { id: contactId },
      data: {
        portalToken: tokenHash,
        portalTokenExpiresAt: expiresAt,
      },
    });

    return `${projectId}:${contactId}:${token}`;
  }
}
