/**
 * command-center.module.ts
 *
 * Module for command center aggregation endpoints.
 * Orchestrates dashboard data from multiple sources.
 *
 * SOLID: SRP - Only command center concerns
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infrastructure/database/database.module';
import { CommandCenterController } from './controllers/command-center.controller';
import { CommandCenterService } from './services/command-center.service';

@Module({
    imports: [DatabaseModule],
    controllers: [CommandCenterController],
    providers: [CommandCenterService],
    exports: [CommandCenterService],
})
export class CommandCenterModule { }
