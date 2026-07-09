/**
 * Customers Module — Wires up dependencies.
 */

import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { PrismaCustomerRepository } from './repositories/prisma-customer.repository';
import { CUSTOMER_REPOSITORY } from './interfaces/customer.interface';

@Module({
  controllers: [CustomersController],
  providers: [
    CustomersService,
    {
      provide: CUSTOMER_REPOSITORY,
      useClass: PrismaCustomerRepository,
    },
  ],
  exports: [CustomersService],
})
export class CustomersModule {}
