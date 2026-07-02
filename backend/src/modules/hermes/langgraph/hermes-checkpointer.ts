/**
 * hermes-checkpointer.ts — Checkpoint persistence for Hermes LangGraph sessions.
 *
 * Integrates with PrismaService to persist and restore HermesGraphState,
 * and uses HermesMemoryService to include personal memory in restored state.
 *
 * SOLID — SRP: Only responsible for state checkpoint save/restore for Hermes.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { HermesMemoryService } from '../services/hermes-memory.service';
import type { HermesGraphState } from './hermes-node';

export interface HermesCheckpoint {
    threadId: string;
    state: HermesGraphState;
    suspendedAt?: Date;
    workflowId?: string;
}

@Injectable()
export class HermesCheckpointer {
    private readonly logger = new Logger(HermesCheckpointer.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly memoryService: HermesMemoryService,
    ) { }

    /**
     * Persist a Hermes graph state snapshot for the given thread.
     */
    async save(threadId: string, state: HermesGraphState): Promise<void> {
        await this.prisma.hermesSession.updateMany({
            where: { threadId },
            data: {
                context: state as object,
                updatedAt: new Date(),
            },
        });

        this.logger.debug(`[HermesCheckpointer] Saved checkpoint for thread ${threadId}`);
    }

    /**
     * Load a persisted Hermes graph state snapshot.
     * Enriches with current personal memory context.
     */
    async load(threadId: string): Promise<HermesGraphState | null> {
        const session = await this.prisma.hermesSession.findUnique({
            where: { threadId },
            select: { context: true, hermesAgentId: true, tenantId: true },
        });

        if (!session?.context) return null;

        const state = session.context as HermesGraphState;

        // Enrich with current personal memory context
        if (session.hermesAgentId) {
            try {
                const memoryContext = await this.memoryService.getContext(
                    session.hermesAgentId,
                    session.tenantId,
                    10,
                );
                // Attach memory context to state for consumption by the runtime
                (state as Record<string, unknown>)['_personalMemoryContext'] = memoryContext;
            } catch (err) {
                this.logger.warn(
                    `[HermesCheckpointer] Failed to load memory context for ${session.hermesAgentId}: ${(err as Error).message}`,
                );
            }
        }

        this.logger.debug(`[HermesCheckpointer] Loaded checkpoint for thread ${threadId}`);
        return state;
    }

    /**
     * Save a suspended state (waiting for human approval).
     */
    async saveSuspended(
        threadId: string,
        state: HermesGraphState,
        workflowId: string,
    ): Promise<void> {
        const suspendedState = {
            ...state,
            _suspendedAt: new Date().toISOString(),
            _workflowId: workflowId,
        };

        await this.prisma.hermesSession.updateMany({
            where: { threadId },
            data: {
                status: 'SUSPENDED',
                context: suspendedState as object,
                updatedAt: new Date(),
            },
        });

        this.logger.log(
            `[HermesCheckpointer] Session for thread ${threadId} suspended, awaiting workflow ${workflowId}`,
        );
    }

    /**
     * Clear a checkpoint after the session has completed.
     */
    async clear(threadId: string): Promise<void> {
        await this.prisma.hermesSession.updateMany({
            where: { threadId },
            data: {
                status: 'COMPLETED',
                context: {},
                updatedAt: new Date(),
            },
        });

        this.logger.debug(`[HermesCheckpointer] Cleared checkpoint for thread ${threadId}`);
    }
}
