/**
 * src/modules/approvals/approvals.module.ts
 *
 * NestJS module for approvals feature
 * SOLID: OCP - Extensible without modification
 */

import { Module } from '@nestjs/common';
import { ApprovalsService } from './services/approvals.service';
import { ApprovalsController } from './controllers/approvals.controller';

/**
 * ApprovalsModule
 *
 * SOLID:
 * - OCP: New services added without modifying this module
 * - DIP: All providers injected via module system
 */
@Module({
    controllers: [ApprovalsController],
    providers: [ApprovalsService],
    exports: [ApprovalsService],
})
export class ApprovalsModule { }
