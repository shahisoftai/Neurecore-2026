/**
 * Customers Module — Prisma Repository Implementation
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  ICustomerRepository,
  Customer,
  CustomerContact,
  CreateCustomerInput,
  UpdateCustomerInput,
  ListCustomersOptions,
} from '../interfaces/customer.interface';

@Injectable()
export class PrismaCustomerRepository implements ICustomerRepository {
  private readonly logger = new Logger(PrismaCustomerRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateCustomerInput, tenantId: string): Promise<Customer> {
    this.logger.debug(`Creating customer: ${data.name}`);
    const created = await this.prisma.customer.create({
      data: {
        tenantId,
        name: data.name,
        industry: data.industry ?? null,
        primaryEmail: data.primaryEmail ?? null,
        primaryPhone: data.primaryPhone ?? null,
        billingInfo: data.billingInfo
          ? (data.billingInfo as object)
          : undefined,
        tags: data.tags ?? [],
      },
    });
    return this.mapToCustomer(created);
  }

  async findById(id: string, tenantId: string): Promise<Customer | null> {
    const found = await this.prisma.customer.findFirst({
      where: { id, tenantId },
    });
    return found ? this.mapToCustomer(found) : null;
  }

  async findAll(
    options: ListCustomersOptions,
    tenantId: string,
  ): Promise<{ data: Customer[]; total: number }> {
    const where: Record<string, unknown> = tenantId !== '*' ? { tenantId } : {};
    if (options.status) where.status = options.status;
    if (options.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { industry: { contains: options.search, mode: 'insensitive' } },
        { primaryEmail: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const page = options.page || 1;
    const limit = options.limit || 20;

    // Sort allow-list — never trust user-supplied sort keys directly.
    const sortKey = options.sortKey ?? 'createdAt';
    const sortDir = options.sortDir ?? 'desc';
    const SORTABLE: Record<string, true> = {
      name: true,
      industry: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    };
    const safeSortKey = SORTABLE[sortKey] ? sortKey : 'createdAt';
    const safeSortDir: 'asc' | 'desc' = sortDir === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [safeSortKey]: safeSortDir },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data: items.map((c) => this.mapToCustomer(c)),
      total,
    };
  }

  /**
   * Note on tenant scoping: Prisma's `update({ where: { id, tenantId } })`
   * silently ignores `tenantId` because the model's unique selector is only
   * `id`. The service layer MUST call `findById(id, tenantId)` first to
   * verify tenant ownership (it does). For defense in depth, we use a
   * `findFirst` + scoped `update` flow here as well.
   */
  async update(
    id: string,
    tenantId: string,
    data: UpdateCustomerInput,
  ): Promise<Customer> {
    const existing = await this.prisma.customer.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Customer ${id} not found`);
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.industry !== undefined) updateData.industry = data.industry;
    if (data.primaryEmail !== undefined)
      updateData.primaryEmail = data.primaryEmail;
    if (data.primaryPhone !== undefined)
      updateData.primaryPhone = data.primaryPhone;
    if (data.billingInfo !== undefined) {
      updateData.billingInfo = data.billingInfo
        ? (data.billingInfo as object)
        : null;
    }
    if (data.status !== undefined) updateData.status = data.status;
    if (data.tags !== undefined) updateData.tags = data.tags;

    const updated = await this.prisma.customer.update({
      where: { id: existing.id },
      data: updateData,
    });
    return this.mapToCustomer(updated);
  }

  async archive(id: string, tenantId: string): Promise<Customer> {
    const existing = await this.prisma.customer.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    const updated = await this.prisma.customer.update({
      where: { id: existing.id },
      data: { status: 'ARCHIVED' },
    });
    return this.mapToCustomer(updated);
  }

  async addContact(
    customerId: string,
    dto: {
      name: string;
      email: string;
      phone?: string | null;
      role?: string | null;
      isPrimary?: boolean;
    },
  ): Promise<CustomerContact> {
    if (dto.isPrimary) {
      await this.prisma.customerContact.updateMany({
        where: { customerId },
        data: { isPrimary: false },
      });
    }
    const created = await this.prisma.customerContact.create({
      data: {
        customerId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone ?? null,
        role: dto.role ?? null,
        isPrimary: dto.isPrimary ?? false,
      },
    });
    return this.mapToContact(created);
  }

  async listContacts(customerId: string): Promise<CustomerContact[]> {
    const rows = await this.prisma.customerContact.findMany({
      where: { customerId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => this.mapToContact(r));
  }

  private mapToCustomer(row: {
    id: string;
    tenantId: string;
    name: string;
    industry: string | null;
    primaryEmail: string | null;
    primaryPhone: string | null;
    billingInfo: unknown;
    status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
  }): Customer {
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      industry: row.industry,
      primaryEmail: row.primaryEmail,
      primaryPhone: row.primaryPhone,
      billingInfo: (row.billingInfo as Record<string, unknown> | null) ?? null,
      status: row.status,
      tags: row.tags || [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapToContact(row: {
    id: string;
    customerId: string;
    name: string;
    email: string;
    phone: string | null;
    role: string | null;
    isPrimary: boolean;
    createdAt: Date;
  }): CustomerContact {
    return {
      id: row.id,
      customerId: row.customerId,
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      isPrimary: row.isPrimary,
      createdAt: row.createdAt,
    };
  }
}
