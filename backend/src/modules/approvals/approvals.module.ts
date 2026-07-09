/**
 * src/modules/approvals/approvals.module.ts
 *
 * NestJS module for approvals feature
 * SOLID:
 * - OCP: Extensible without modification
 * - DIP: Binds IApprovalRepository to PrismaApprovalRepository via token
 */

import { Module } from '@nestjs/common';
import { ApprovalsService } from './services/approvals.service';
import { ApprovalsController } from './controllers/approvals.controller';
import { PrismaApprovalRepository } from './repositories/prisma-approval.repository';
import { APPROVAL_REPOSITORY } from './interfaces/approval.interface';

@Module({
    controllers: [ApprovalsController],
    providers: [
        ApprovalsService,
        {
            provide: APPROVAL_REPOSITORY,
            useClass: PrismaApprovalRepository,
        },
    ],
    exports: [ApprovalsService],
})
export class ApprovalsModule { }
