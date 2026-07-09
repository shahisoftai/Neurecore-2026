/**
 * Customers Module — Controller
 *
 * SOLID: thin HTTP layer that delegates to CustomersService.
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantIsolated } from '../../common/guards/tenant-isolated.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { CustomersService } from './customers.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  AddCustomerContactDto,
  ListCustomersQueryDto,
} from './dto/customer.dto';

@Controller({ path: 'customers', version: '1' })
@ApiCommon('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(
      {
        name: dto.name,
        industry: dto.industry,
        primaryEmail: dto.primaryEmail,
        primaryPhone: dto.primaryPhone,
        billingInfo: dto.billingInfo,
        tags: dto.tags,
      },
      user.tenantId!,
    );
  }

  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListCustomersQueryDto,
  ) {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;
    return this.customersService.findAll(user.tenantId!, {
      search: query.search,
      status: query.status,
      page,
      limit,
      sortKey: query.sortKey,
      sortDir: query.sortDir,
    });
  }

  @Get(':id')
  @TenantIsolated()
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.customersService.findById(id, user.tenantId!);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, user.tenantId!, {
      name: dto.name,
      industry: dto.industry,
      primaryEmail: dto.primaryEmail,
      primaryPhone: dto.primaryPhone,
      billingInfo: dto.billingInfo,
      status: dto.status,
      tags: dto.tags,
    });
  }

  @Post(':id/archive')
  archive(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.customersService.archive(id, user.tenantId!);
  }

  @Post(':id/unarchive')
  unarchive(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.customersService.unarchive(id, user.tenantId!);
  }

  @Post(':id/contacts')
  addContact(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AddCustomerContactDto,
  ) {
    return this.customersService.addContact(id, user.tenantId!, {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      role: dto.role,
      isPrimary: dto.isPrimary,
    });
  }

  @Get(':id/contacts')
  listContacts(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.customersService.listContacts(id, user.tenantId!);
  }
}
