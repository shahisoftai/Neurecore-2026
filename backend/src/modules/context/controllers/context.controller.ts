/**
 * src/modules/context/controllers/context.provider.ts
 *
 * Context endpoint provider service
 * SOLID:
 * - SRP: Provides context endpoint logic to be used by DepartmentsController
 * - DIP: Depends on ContextService abstraction
 */

import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ContextService } from '../services/context.service';
import type { ContextResponse } from '@/shared/types/context.types';

/**
 * ContextProvider
 * Provides context endpoint handler for departments controller
 *
 * SOLID: SRP - Only context endpoint logic
 */
@Injectable()
export class ContextProvider {
    private readonly logger = new Logger(ContextProvider.name);

    constructor(private readonly contextService: ContextService) { }

    /**
     * Get cross-functional context for a department
     *
     * SOLID: SRP - Only handles business logic, validation delegated to service
     *
     * @param tenantId - Tenant ID
     * @param departmentId - Department ID
     * @returns ContextResponse with initiatives and dependencies
     */
    async getContextForDepartment(
        tenantId: string,
        departmentId: string
    ): Promise<ContextResponse> {
        if (!departmentId) {
            throw new HttpException(
                'Department ID is required',
                HttpStatus.BAD_REQUEST
            );
        }

        if (!tenantId) {
            throw new HttpException(
                'Tenant ID is required',
                HttpStatus.BAD_REQUEST
            );
        }

        try {
            return await this.contextService.getContextForDepartment(
                tenantId,
                departmentId
            );
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            this.logger.error(`[ContextProvider] Error: ${error}`);
            throw new HttpException(
                'Failed to fetch context',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
