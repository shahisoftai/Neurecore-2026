/**
 * approval-chains module — NestJS Module
 *
 * Phase 4: Approval chain resolution.
 *
 * SOLID: Single Responsibility — wires approval chain dependencies.
 * DIP: binds IApprovalChainRepository to PrismaApprovalChainRepository via token.
 *
 * Audit-remediation: imports DeliverablesModule to obtain DELIVERABLE_REPOSITORY
 * for tenant-scoped deliverable lookup used by resolveChain.
 */

import { Module } from '@nestjs/common';
import { ApprovalChainsController } from './approval-chains.controller';
import { ApprovalChainsService } from './approval-chains.service';
import { PrismaApprovalChainRepository } from './repositories/prisma-approval-chain.repository';
import { APPROVAL_CHAIN_REPOSITORY } from './interfaces/approval-chain.interface';
import { DeliverablesModule } from '../deliverables/deliverables.module';

@Module({
  imports: [DeliverablesModule],
  controllers: [ApprovalChainsController],
  providers: [
    ApprovalChainsService,
    {
      provide: APPROVAL_CHAIN_REPOSITORY,
      useClass: PrismaApprovalChainRepository,
    },
  ],
  exports: [ApprovalChainsService],
})
export class ApprovalChainsModule {}
