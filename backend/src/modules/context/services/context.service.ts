/**
 * src/modules/context/services/context.service.ts
 *
 * Business logic for cross-department context aggregation
 * SOLID:
 * - SRP: Aggregates context data only
 * - OCP: Methods can be extended without modification
 * - DIP: Depends on PrismaService abstraction
 */

import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type {
    ContextResponse,
    Initiative,
    Dependency,
} from '@/shared/types/context.types';

/**
 * ContextService
 * Aggregates initiatives and dependencies for departments
 *
 * SOLID:
 * - SRP: Only handles context aggregation
 * - OCP: Private methods can be extended
 * - DIP: Depends on PrismaService
 */
@Injectable()
export class ContextService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Get cross-functional context for a department
     *
     * SOLID: SRP - Public method delegates to private helpers
     *
     * @param tenantId - Tenant identifier
     * @param departmentId - Department identifier
     * @returns ContextResponse with initiatives and dependencies
     */
    async getContextForDepartment(
        tenantId: string,
        departmentId: string
    ): Promise<ContextResponse> {
        // Verify department exists
        const department = await this.prisma.department.findFirst({
            where: { id: departmentId, tenantId },
        });

        if (!department) {
            throw new HttpException(
                'Department not found',
                HttpStatus.NOT_FOUND
            );
        }

        try {
            // Fetch data in parallel for performance
            const [initiatives, blockers, waiters] = await Promise.all([
                this.getInitiatives(tenantId, departmentId),
                this.getUpstreamBlockers(tenantId, departmentId),
                this.getDownstreamWaiters(tenantId, departmentId),
            ]);

            // Compute summary stats
            const summary = {
                activeInitiatives: initiatives.filter(
                    (i) => i.status !== 'COMPLETED'
                ).length,
                blockedCount: initiatives.filter((i) => i.status === 'BLOCKED').length,
                dependenciesCount: blockers.length + waiters.length,
            };

            return {
                initiatives,
                dependencies: {
                    upstreamBlockers: blockers,
                    downstreamWaiters: waiters,
                    related: [], // Can be extended for related initiatives
                },
                summary,
            };
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            console.error('[ContextService] Error:', error);
            throw new HttpException(
                'Failed to fetch context',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Fetch initiatives involving this department
     *
     * SOLID: SRP - Only retrieves initiatives
     *
     * @private
     */
    private async getInitiatives(
        tenantId: string,
        departmentId: string
    ): Promise<Initiative[]> {
        try {
            // This example assumes an 'initiative' or 'project' table exists
            // If not available, return empty array as placeholder
            // In production, this would query from actual initiative table
            const initiatives = await this.prisma.initiative
                .findMany({
                    where: {
                        tenantId,
                        departments: {
                            some: { id: departmentId },
                        },
                        status: {
                            not: 'ARCHIVED',
                        },
                    },
                    include: {
                        departmentStats: true,
                    },
                    orderBy: { updatedAt: 'desc' },
                    take: 50,
                })
                .catch(() => []);

            return initiatives.map((init: any) => ({
                id: init.id,
                title: init.title,
                description: init.description,
                status: init.status,
                progressScore: init.progressScore || 0,
                departmentStats: init.departmentStats || [],
                createdAt: init.createdAt,
                updatedAt: init.updatedAt,
            }));
        } catch (error) {
            console.error('[ContextService] Error fetching initiatives:', error);
            return [];
        }
    }

    /**
     * Fetch upstream blockers for this department
     *
     * SOLID: SRP - Only retrieves blockers
     *
     * @private
     */
    private async getUpstreamBlockers(
        tenantId: string,
        departmentId: string
    ): Promise<Dependency[]> {
        try {
            // This example queries from approval/task table for blockers
            const blockers = await this.prisma.dependency
                .findMany({
                    where: {
                        tenantId,
                        targetDepartmentId: departmentId,
                        type: 'blocker',
                    },
                    orderBy: { priority: 'desc' },
                    take: 20,
                })
                .catch(() => []);

            return blockers.map((blocker: any) => ({
                id: blocker.id,
                source: blocker.sourceDepartmentId,
                target: blocker.targetDepartmentId,
                description: blocker.description,
                type: blocker.type,
                estimatedHours: blocker.estimatedHours,
                priority: blocker.priority,
            }));
        } catch (error) {
            console.error('[ContextService] Error fetching blockers:', error);
            return [];
        }
    }

    /**
     * Fetch downstream waiters for this department
     *
     * SOLID: SRP - Only retrieves waiters
     *
     * @private
     */
    private async getDownstreamWaiters(
        tenantId: string,
        departmentId: string
    ): Promise<Dependency[]> {
        try {
            // This example queries for teams waiting on this department
            const waiters = await this.prisma.dependency
                .findMany({
                    where: {
                        tenantId,
                        sourceDepartmentId: departmentId,
                        type: 'waiter',
                    },
                    orderBy: { priority: 'desc' },
                    take: 20,
                })
                .catch(() => []);

            return waiters.map((waiter: any) => ({
                id: waiter.id,
                source: waiter.sourceDepartmentId,
                target: waiter.targetDepartmentId,
                description: waiter.description,
                type: waiter.type,
                estimatedHours: waiter.estimatedHours,
                priority: waiter.priority,
            }));
        } catch (error) {
            console.error('[ContextService] Error fetching waiters:', error);
            return [];
        }
    }
}
