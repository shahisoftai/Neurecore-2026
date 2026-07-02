/**
 * context.service.ts - Business logic for context aggregation
 * STUB: minimal implementation. Real implementation deferred.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';

@Injectable()
export class ContextService {
    constructor(private readonly prisma: PrismaService) {}

    async getContext(tenantId: string, userId: string): Promise<any> {
        return {
            id: 'context-stub',
            tenantId,
            userId,
            agents: 0,
            projects: 0,
            goals: 0,
            tasks: 0,
            workflows: 0,
            updatedAt: new Date().toISOString(),
        };
    }

    async getContextForDepartment(tenantId: string, departmentId: string): Promise<any> {
        return {
            id: 'context-stub-dept',
            tenantId,
            departmentId,
            initiatives: [],
            dependencies: [],
            updatedAt: new Date().toISOString(),
        };
    }
}
