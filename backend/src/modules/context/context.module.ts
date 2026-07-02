/**
 * src/modules/context/context.module.ts
 *
 * NestJS module registration for context functionality
 * SOLID: Dependency Injection - Centralizes module setup
 */

import { Module } from '@nestjs/common';
import { ContextService } from './services/context.service';
import { ContextProvider } from './controllers/context.controller';

/**
 * ContextModule
 * Provides context/initiative aggregation service and provider
 * Injected by departments module
 */
@Module({
    providers: [ContextService, ContextProvider],
    exports: [ContextService, ContextProvider],
})
export class ContextModule { }
