import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ConnectorRegistry } from '../connector.registry';
import { ICRMConnector } from '../interfaces/ICRMConnector';

/**
 * ConnectorService — Phase 4.2
 *
 * SRP:  Orchestrates connector lifecycle; does NOT implement HTTP calls.
 * OCP:  New connector types plug in through ConnectorRegistry without touching this service.
 * DIP:  Depends on ConnectorRegistry (interface-level lookup), not concrete adapters.
 */
@Injectable()
export class ConnectorService {
  private readonly logger = new Logger(ConnectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ConnectorRegistry,
  ) {}

  listAvailableProviders(): string[] {
    return this.registry.list();
  }

  async listConnectors(tenantId: string) {
    const where = tenantId ? { tenantId } : {};
    return this.prisma.crmConnector.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createConnector(
    tenantId: string,
    name: string,
    provider: string,
    config: Record<string, unknown> = {},
  ) {
    if (!this.registry.get(provider))
      throw new NotFoundException(`Provider not supported: ${provider}`);
    return this.prisma.crmConnector.create({
      data: {
        tenantId,
        name,
        provider,
        config: config as Prisma.InputJsonValue,
      },
    });
  }

  async deleteConnector(tenantId: string, id: string) {
    const existing = await this.prisma.crmConnector.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException(`Connector ${id} not found`);
    return this.prisma.crmConnector.delete({ where: { id } });
  }

  async connect(
    tenantId: string,
    id: string,
    config: Record<string, unknown>,
  ): Promise<void> {
    const record = await this.prisma.crmConnector.findFirst({
      where: { id, tenantId },
    });
    if (!record) throw new NotFoundException(`Connector ${id} not found`);
    await this.getAdapter(record.provider).connect(config);
    await this.prisma.crmConnector.update({
      where: { id },
      data: { config: config as Prisma.InputJsonValue, isActive: true },
    });
    this.logger.log(
      `Connector ${record.name} connected for tenant ${tenantId}`,
    );
  }

  async disconnect(tenantId: string, id: string): Promise<void> {
    const record = await this.prisma.crmConnector.findFirst({
      where: { id, tenantId },
    });
    if (!record) throw new NotFoundException(`Connector ${id} not found`);
    await this.getAdapter(record.provider).disconnect();
    await this.prisma.crmConnector.update({
      where: { id },
      data: { isActive: false },
    });
    this.logger.log(`Connector ${record.name} disconnected`);
  }

  async syncContacts(tenantId: string, id: string): Promise<void> {
    const record = await this.prisma.crmConnector.findFirst({
      where: { id, tenantId, isActive: true },
    });
    if (!record)
      throw new NotFoundException(`Active connector ${id} not found`);
    const adapter = this.getAdapter(record.provider);
    if (!adapter.syncContacts)
      throw new NotFoundException(
        `Provider ${record.provider} does not support contact sync`,
      );
    await adapter.syncContacts(tenantId);
  }

  async syncLeads(tenantId: string, id: string): Promise<void> {
    const record = await this.prisma.crmConnector.findFirst({
      where: { id, tenantId, isActive: true },
    });
    if (!record)
      throw new NotFoundException(`Active connector ${id} not found`);
    const adapter = this.getAdapter(record.provider);
    if (!adapter.syncLeads)
      throw new NotFoundException(
        `Provider ${record.provider} does not support lead sync`,
      );
    await adapter.syncLeads(tenantId);
  }

  private getAdapter(provider: string): ICRMConnector {
    const adapter = this.registry.get(provider);
    if (!adapter)
      throw new NotFoundException(`No adapter registered for: ${provider}`);
    return adapter;
  }
}
