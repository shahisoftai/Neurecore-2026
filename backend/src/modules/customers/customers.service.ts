/**
 * Customers Module — Business Logic Service
 *
 * Following SOLID:
 * - SRP: only customer business logic (validation + orchestration).
 * - DIP: depends on ICustomerRepository abstraction.
 */

import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type {
  ICustomerRepository,
  Customer,
  CustomerContact,
  CreateCustomerInput,
  UpdateCustomerInput,
  ListCustomersOptions,
} from './interfaces/customer.interface';
import { CUSTOMER_REPOSITORY } from './interfaces/customer.interface';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly repository: ICustomerRepository,
  ) {}

  async create(
    input: CreateCustomerInput,
    tenantId: string,
  ): Promise<Customer> {
    if (!input.name || input.name.trim().length === 0) {
      throw new BadRequestException('Customer name is required');
    }
    return this.repository.create(
      { ...input, name: input.name.trim() },
      tenantId,
    );
  }

  async findById(id: string, tenantId: string): Promise<Customer> {
    const found = await this.repository.findById(id, tenantId);
    if (!found) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    return found;
  }

  async findAll(
    tenantId: string,
    options: ListCustomersOptions = {},
  ): Promise<{ data: Customer[]; total: number }> {
    return this.repository.findAll(options, tenantId);
  }

  async update(
    id: string,
    tenantId: string,
    input: UpdateCustomerInput,
  ): Promise<Customer> {
    await this.findById(id, tenantId);
    return this.repository.update(id, tenantId, input);
  }

  async archive(id: string, tenantId: string): Promise<Customer> {
    await this.findById(id, tenantId);
    return this.repository.archive(id, tenantId);
  }

  async unarchive(id: string, tenantId: string): Promise<Customer> {
    await this.findById(id, tenantId);
    return this.repository.update(id, tenantId, { status: 'ACTIVE' });
  }

  async addContact(
    customerId: string,
    tenantId: string,
    dto: {
      name: string;
      email: string;
      phone?: string;
      role?: string;
      isPrimary?: boolean;
    },
  ): Promise<CustomerContact> {
    await this.findById(customerId, tenantId);
    return this.repository.addContact(customerId, dto);
  }

  async listContacts(
    customerId: string,
    tenantId: string,
  ): Promise<CustomerContact[]> {
    await this.findById(customerId, tenantId);
    return this.repository.listContacts(customerId);
  }
}
