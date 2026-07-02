/**
 * command-center.service.ts - Business logic for command center dashboard
 *
 * SOLID Principles:
 * - SRP: Aggregates data from multiple sources
 * - DIP: Depends on repository interfaces, not implementations
 * - ISP: Service interface focused on command center concerns
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { TimelineEvent, TimelineResponse } from '@/shared/types/timeline.types';

// ─── Types ────────────────────────────────────────────────────────────────

export interface CommandCenterSummary {
    agents: {
        total: number;
        active: number;
        running: number;
        paused: number;
        error: number;
        list: Array<{
            id: string;
            name: string;
            type: string;
            status: string;
            model: string | null;
            departmentId: string | null;
            _count: { tasks: number };
        }>;
    };
    tasks: {
        total: number;
        pending: number;
        running: number;
        completed: number;
        failed: number;
        list: Array<{
            id: string;
            title: string;
            status: string;
            priority: string;
            agentId: string | null;
            createdAt: string;
        }>;
    };
    workflows: {
        total: number;
        active: number;
        list: Array<{
            id: string;
            name: string;
            isActive: boolean;
            createdAt: string;
        }>;
    };
    departments: {
        total: number;
        list: Array<{
            id: string;
            name: string;
            status: string;
        }>;
    };
    approvals: { pending: number };
    costs: { monthCents: number; budgetCents: number };
    activity: Array<{
        id: string;
        message: string;
        severity: string;
        timestamp: string;
    }>;
    fetchedAt: string;
}

export interface TimelineQueryOptions {
    sort: 'impact' | 'recent' | 'priority';
    filter: 'all' | 'urgent' | 'my-action' | 'opportunities' | 'blockers';
    search?: string;
    limit: number;
    page: number;
}

// ─── Service ──────────────────────────────────────────────────────────────

@Injectable()
export class CommandCenterService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Get command center dashboard summary
     * Aggregates: agents, tasks, workflows, departments, approvals, costs, activity
     *
     * SOLID: SRP - Orchestrates multiple repository calls
     */
    async getCommandCenterSummary(tenantId: string): Promise<CommandCenterSummary> {
        const [agents, tasks, workflows, departments, approvals, costs, activity] =
            await Promise.all([
                this.prisma.agent.findMany({
                    where: { tenantId },
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                    include: { _count: { select: { tasks: true } } },
                }),
                this.prisma.task.findMany({
                    where: { tenantId },
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                }),
                this.prisma.workflow.findMany({
                    where: { tenantId },
                    take: 5,
                    orderBy: { createdAt: 'desc' },
                }),
                this.prisma.department.findMany({
                    where: { tenantId },
                    take: 10,
                }),
                this.prisma.approvalRequest.count({
                    where: { tenantId, status: 'PENDING' },
                }),
                this.prisma.costRecord.aggregate({
                    where: {
                        tenantId,
                        timestamp: {
                            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                            lte: new Date(),
                        },
                    },
                    _sum: { costCents: true },
                }),
                this.prisma.auditLog.findMany({
                    where: { tenantId },
                    take: 10,
                    orderBy: { timestamp: 'desc' },
                }),
            ]);

        // Calculate totals
        const taskStats = {
            total: await this.prisma.task.count({ where: { tenantId } }),
            pending: tasks.filter((t) => t.status === 'PENDING').length,
            running: tasks.filter((t) => t.status === 'RUNNING' || t.status === 'IN_PROGRESS').length,
            completed: tasks.filter((t) => t.status === 'COMPLETED').length,
            failed: tasks.filter((t) => t.status === 'FAILED').length,
        };

        const agentStats = {
            total: await this.prisma.agent.count({ where: { tenantId } }),
            active: agents.filter((a) => a.status === 'ACTIVE').length,
            running: agents.filter((a) => a.status === 'RUNNING').length,
            paused: agents.filter((a) => a.status === 'PAUSED').length,
            error: agents.filter((a) => a.status === 'ERROR').length,
        };

        return {
            agents: {
                ...agentStats,
                list: agents as never[],
            },
            tasks: {
                ...taskStats,
                list: tasks as never[],
            },
            workflows: {
                total: await this.prisma.workflow.count({ where: { tenantId } }),
                active: workflows.filter((w) => w.isActive).length,
                list: workflows.map((w) => ({
                    id: w.id,
                    name: w.name,
                    isActive: w.isActive,
                    createdAt: w.createdAt.toISOString(),
                })),
            },
            departments: {
                total: departments.length,
                list: departments.map((d) => ({
                    id: d.id,
                    name: d.name,
                    status: d.status,
                })),
            },
            approvals: {
                pending: approvals,
            },
            costs: {
                monthCents: costs._sum.costCents || 0,
                budgetCents: await this.getTenantBudgetCents(tenantId),
            },
            activity: activity.map((a) => ({
                id: a.id,
                message: a.action,
                severity: a.severity || 'info',
                timestamp: a.timestamp.toISOString(),
            })),
            fetchedAt: new Date().toISOString(),
        };
    }

    /**
     * Get timeline events sorted by impact
     *
     * Aggregates events from multiple sources:
     * - Approval requests (APPROVAL_NEEDED)
     * - Task completions (ACTION_TAKEN)
     * - Agent status changes (FYI)
     * - Cost alerts (ALERT)
     * - Opportunities (OPPORTUNITY)
     *
     * SOLID: SRP - Timeline aggregation logic
     */
    async getTimelineEvents(
        tenantId: string,
        options: TimelineQueryOptions,
    ): Promise<TimelineResponse> {
        const { sort, filter, search, limit, page } = options;

        // Fetch events from multiple sources
        const [approvals, tasks, alerts, opportunities] = await Promise.all([
            this.getApprovalEvents(tenantId, search),
            this.getTaskEvents(tenantId, search),
            this.getAlertEvents(tenantId, search),
            this.getOpportunityEvents(tenantId, search),
        ]);

        // Combine all events
        let allEvents: TimelineEvent[] = [
            ...approvals,
            ...tasks,
            ...alerts,
            ...opportunities,
        ];

        // Apply filter
        allEvents = this.applyTimelineFilter(allEvents, filter);

        // Apply search if provided
        if (search) {
            allEvents = allEvents.filter(
                (e) =>
                    e.title.toLowerCase().includes(search.toLowerCase()) ||
                    e.description?.toLowerCase().includes(search.toLowerCase()),
            );
        }

        // Sort events
        allEvents = this.sortTimelineEvents(allEvents, sort);

        // Pagination
        const offset = (page - 1) * limit;
        const paginatedEvents = allEvents.slice(offset, offset + limit);

        // Count by filter type for UI display
        const eventCounts = this.countEventsByFilter(allEvents);

        return {
            events: paginatedEvents,
            summary: {
                urgentCount: eventCounts.urgent,
                myActionCount: eventCounts['my-action'],
                totalToday: allEvents.filter(
                    (e) => new Date(e.timestamp).toDateString() === new Date().toDateString(),
                ).length,
                unreadCount: allEvents.filter((e) => !e.read).length,
            },
            pagination: {
                page,
                limit,
                total: allEvents.length,
            },
        };
    }

    // ─── Private helpers ──────────────────────────────────────────────────

    /**
     * Fetch approval events
     * SOLID: SRP - Approval event creation
     */
    private async getApprovalEvents(
        tenantId: string,
        search?: string,
    ): Promise<TimelineEvent[]> {
        const approvals = await this.prisma.approvalRequest.findMany({
            where: {
                tenantId,
                status: 'PENDING',
                ...(search && {
                    OR: [
                        { title: { contains: search, mode: 'insensitive' } },
                        { description: { contains: search, mode: 'insensitive' } },
                    ],
                }),
            },
            take: 50,
            orderBy: { createdAt: 'desc' },
            include: { agent: true, department: true },
        });

        return approvals.map((a) => ({
            id: a.id,
            type: 'APPROVAL_NEEDED',
            title: a.title,
            description: a.description,
            impact: (a.riskLevel as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW') || 'HIGH',
            timestamp: a.createdAt,
            actions: [
                {
                    label: 'Review',
                    action: 'navigate',
                    target: `/service-desk/approvals/${a.id}`,
                    isPrimary: true,
                },
            ],
            metadata: {
                agent: a.agent ? { id: a.agent.id, name: a.agent.name } : undefined,
                department: a.department ? { id: a.department.id, name: a.department.name } : undefined,
                amount: a.amount,
            },
            read: false,
        }));
    }

    /**
     * Fetch task completion events
     * SOLID: SRP - Task event creation
     */
    private async getTaskEvents(
        tenantId: string,
        search?: string,
    ): Promise<TimelineEvent[]> {
        const tasks = await this.prisma.task.findMany({
            where: {
                tenantId,
                status: { in: ['COMPLETED', 'FAILED'] },
                completedAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
                },
                ...(search && {
                    OR: [
                        { title: { contains: search, mode: 'insensitive' } },
                        { description: { contains: search, mode: 'insensitive' } },
                    ],
                }),
            },
            take: 50,
            orderBy: { completedAt: 'desc' },
            include: { agent: true },
        });

        return tasks.map((t) => ({
            id: t.id,
            type: t.status === 'FAILED' ? 'BLOCKER' : 'ACTION_TAKEN',
            title: t.title,
            description: t.description,
            impact: (t.priority as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW') || 'MEDIUM',
            timestamp: t.completedAt || t.createdAt,
            metadata: {
                agent: t.agent ? { id: t.agent.id, name: t.agent.name } : undefined,
            },
            read: false,
        }));
    }

    /**
     * Fetch alert events
     * SOLID: SRP - Alert event creation
     */
    private async getAlertEvents(
        tenantId: string,
        search?: string,
    ): Promise<TimelineEvent[]> {
        const alerts = await this.prisma.auditLog.findMany({
            where: {
                tenantId,
                severity: { in: ['error', 'warning'] },
                timestamp: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                },
                ...(search && {
                    action: { contains: search, mode: 'insensitive' },
                }),
            },
            take: 30,
            orderBy: { timestamp: 'desc' },
        });

        return alerts.map((a) => ({
            id: a.id,
            type: 'ALERT',
            title: `${a.severity.toUpperCase()}: ${a.action}`,
            description: a.details,
            impact: a.severity === 'error' ? 'CRITICAL' : 'HIGH',
            timestamp: a.timestamp,
            read: false,
        }));
    }

    /**
     * Fetch opportunity events
     * SOLID: SRP - Opportunity event creation
     */
    private async getOpportunityEvents(
        tenantId: string,
        search?: string,
    ): Promise<TimelineEvent[]> {
        // Opportunities could be high-potential approvals, new leads, etc.
        // For now, we'll fetch high-value approvals marked as opportunities
        const opportunities = await this.prisma.approvalRequest.findMany({
            where: {
                tenantId,
                status: 'PENDING',
                amount: { gte: 100000 }, // High value
                riskLevel: 'LOW', // Low risk = opportunity
                ...(search && {
                    OR: [
                        { title: { contains: search, mode: 'insensitive' } },
                    ],
                }),
            },
            take: 20,
            orderBy: { createdAt: 'desc' },
            include: { agent: true, department: true },
        });

        return opportunities.map((o) => ({
            id: `opp-${o.id}`,
            type: 'OPPORTUNITY',
            title: `Opportunity: ${o.title}`,
            description: `${o.description} - High value, low risk`,
            impact: 'MEDIUM',
            timestamp: o.createdAt,
            actions: [
                {
                    label: 'Approve',
                    action: 'navigate',
                    target: `/service-desk/approvals/${o.id}`,
                    isPrimary: true,
                },
            ],
            metadata: {
                agent: o.agent ? { id: o.agent.id, name: o.agent.name } : undefined,
                department: o.department ? { id: o.department.id, name: o.department.name } : undefined,
                amount: o.amount,
            },
            read: false,
        }));
    }

    /**
     * Apply timeline filter
     * SOLID: SRP - Filtering logic
     */
    private applyTimelineFilter(events: TimelineEvent[], filter: string): TimelineEvent[] {
        switch (filter) {
            case 'urgent':
                return events.filter((e) => e.impact === 'CRITICAL' || e.impact === 'HIGH');
            case 'my-action':
                return events.filter((e) => e.type === 'APPROVAL_NEEDED' || e.type === 'ACTION_TAKEN');
            case 'opportunities':
                return events.filter((e) => e.type === 'OPPORTUNITY');
            case 'blockers':
                return events.filter((e) => e.type === 'BLOCKER' || e.type === 'ALERT');
            case 'all':
            default:
                return events;
        }
    }

    /**
     * Sort timeline events
     * SOLID: SRP - Sorting logic
     */
    private sortTimelineEvents(
        events: TimelineEvent[],
        sort: 'impact' | 'recent' | 'priority',
    ): TimelineEvent[] {
        const impactOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

        switch (sort) {
            case 'impact':
                return [...events].sort((a, b) => {
                    const aImpact = impactOrder[a.impact] ?? 999;
                    const bImpact = impactOrder[b.impact] ?? 999;
                    if (aImpact !== bImpact) return aImpact - bImpact;
                    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                });
            case 'recent':
                return [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            case 'priority':
                // Priority based on type + impact
                const typeOrder = {
                    APPROVAL_NEEDED: 0,
                    BLOCKER: 1,
                    ALERT: 2,
                    ACTION_TAKEN: 3,
                    OPPORTUNITY: 4,
                };
                return [...events].sort((a, b) => {
                    const aType = typeOrder[a.type as keyof typeof typeOrder] ?? 999;
                    const bType = typeOrder[b.type as keyof typeof typeOrder] ?? 999;
                    if (aType !== bType) return aType - bType;
                    return impactOrder[a.impact] - impactOrder[b.impact];
                });
            default:
                return events;
        }
    }

    /**
     * Count events by filter type
     * SOLID: SRP - Counting logic
     */
    private countEventsByFilter(events: TimelineEvent[]) {
        return {
            all: events.length,
            urgent: events.filter((e) => e.impact === 'CRITICAL' || e.impact === 'HIGH').length,
            'my-action': events.filter((e) => e.type === 'APPROVAL_NEEDED' || e.type === 'ACTION_TAKEN').length,
            opportunities: events.filter((e) => e.type === 'OPPORTUNITY').length,
            blockers: events.filter((e) => e.type === 'BLOCKER' || e.type === 'ALERT').length,
        };
    }

    /**
     * Get tenant budget (placeholder)
     * SOLID: SRP - Budget fetching
     */
    private async getTenantBudgetCents(tenantId: string): Promise<number> {
        const tier = await this.prisma.tier.findFirst({
            where: { tenantId },
        });
        return tier?.monthlyBudgetCents || 1000000; // $10,000 default
    }
}
