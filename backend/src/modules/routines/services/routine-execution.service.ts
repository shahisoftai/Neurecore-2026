/**
 * Routine Execution Service
 *
 * Implements IRoutineExecutor for running routines via LangGraph.
 * Handles routine execution, resumption, and cancellation.
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoutineGraph } from '../langgraph/routine-graph';
import { AgentCheckpointService } from '../../agents/langgraph/checkpoint.service';
import type {
  IRoutineExecutor,
  ExecuteRoutineParams,
  RoutineExecutionResult,
  RoutineGraphState,
  RoutineGraphDefinition,
  RoutineConfig,
  ValidationResult,
  RoutineRunStatus,
} from '../interfaces/routine.interface';
import {
  PrismaRoutineRepository,
  PrismaRoutineRunRepository,
  PrismaRoutineTriggerRepository,
} from '../repositories/prisma-routine.repository';
import { AgentsService } from '../../agents/services/agents.service';
import { ToolsService } from '../../tools/tools.service';
import type { Routine } from '@prisma/client';

@Injectable()
export class RoutineExecutionService implements IRoutineExecutor {
  private readonly logger = new Logger(RoutineExecutionService.name);

  constructor(
    private readonly routineRepository: PrismaRoutineRepository,
    private readonly runRepository: PrismaRoutineRunRepository,
    private readonly triggerRepository: PrismaRoutineTriggerRepository,
    private readonly routineGraph: RoutineGraph,
    private readonly checkpointService: AgentCheckpointService,
    private readonly agentsService: AgentsService,
    private readonly toolsService: ToolsService,
  ) {}

  /**
   * Execute a routine by ID
   */
  async execute(params: ExecuteRoutineParams): Promise<RoutineExecutionResult> {
    const {
      routineId,
      tenantId,
      input,
      triggerType,
      triggerId,
      agentId,
      userId,
    } = params;

    this.logger.log(`[execute] Starting routine: ${routineId}`);

    // Fetch routine with validation
    const routine = await this.routineRepository.findById(routineId, tenantId);
    if (!routine) {
      throw new NotFoundException(`Routine not found: ${routineId}`);
    }

    if (routine.status !== 'ACTIVE') {
      throw new BadRequestException(`Routine is not active: ${routine.status}`);
    }

    // Create run record
    const run = await this.runRepository.create({
      routineId,
      tenantId,
      triggerType,
      triggerId,
      input,
      agentId,
      createdById: userId,
    });

    const startTime = Date.now();

    try {
      // Update run status to running
      await this.runRepository.updateState(run.id, { status: 'RUNNING' });

      // Get graph definition and config
      const definition =
        routine.graphDefinition as unknown as RoutineGraphDefinition;
      const config = routine.config as unknown as RoutineConfig;

      // Validate graph
      const validation = this.validateGraph(definition);
      if (!validation.valid) {
        const errorMsg = validation.errors.map((e) => e.message).join(', ');
        await this.runRepository.fail(
          run.id,
          `Graph validation failed: ${errorMsg}`,
        );
        throw new BadRequestException(`Invalid graph: ${errorMsg}`);
      }

      // Execute the graph
      const result = await this.routineGraph.execute({
        routineId,
        runId: run.id,
        tenantId,
        definition,
        config,
        input,
        threadId: run.threadId,
      });

      // Complete the run
      await this.runRepository.complete(run.id, result.context || {});

      // Update trigger last fired time
      if (triggerId) {
        const nextFire =
          triggerType === 'SCHEDULE'
            ? this.calculateNextFire(triggerId)
            : undefined;
        await this.triggerRepository.updateLastFired(
          triggerId,
          new Date(),
          nextFire,
        );
      }

      const durationMs = Date.now() - startTime;

      return {
        runId: run.id,
        status: 'COMPLETED',
        output: result.context,
        durationMs,
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Execution failed';
      this.logger.error(`[execute] Routine failed: ${routineId}`, error);

      await this.runRepository.fail(run.id, errorMsg);

      return {
        runId: run.id,
        status: 'FAILED',
        error: errorMsg,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Resume a paused/cancelled routine run from checkpoint
   */
  async resume(runId: string): Promise<RoutineExecutionResult> {
    this.logger.log(`[resume] Resuming run: ${runId}`);

    const run = await this.runRepository.findById(runId, '');
    if (!run) {
      throw new NotFoundException(`Run not found: ${runId}`);
    }

    if (run.status !== 'RUNNING' && run.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot resume run with status: ${run.status}`,
      );
    }

    const routine = await this.routineRepository.findById(
      run.routineId,
      run.tenantId,
    );
    if (!routine) {
      throw new NotFoundException(`Routine not found: ${run.routineId}`);
    }

    const startTime = Date.now();

    try {
      const definition =
        routine.graphDefinition as unknown as RoutineGraphDefinition;
      const config = routine.config as unknown as RoutineConfig;

      const result = await this.routineGraph.execute({
        routineId: routine.id,
        runId: run.id,
        tenantId: run.tenantId,
        definition,
        config,
        input: run.input as Record<string, unknown>,
        threadId: run.threadId,
        resumeFromCheckpoint: true,
      });

      await this.runRepository.complete(run.id, result.context || {});

      return {
        runId: run.id,
        status: 'COMPLETED',
        output: result.context,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Resume failed';
      this.logger.error(`[resume] Failed: ${runId}`, error);

      await this.runRepository.fail(run.id, errorMsg);

      return {
        runId: run.id,
        status: 'FAILED',
        error: errorMsg,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Cancel a running routine
   */
  async cancel(runId: string): Promise<void> {
    this.logger.log(`[cancel] Cancelling run: ${runId}`);

    const run = await this.runRepository.findById(runId, '');
    if (!run) {
      throw new NotFoundException(`Run not found: ${runId}`);
    }

    if (run.status !== 'RUNNING' && run.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot cancel run with status: ${run.status}`,
      );
    }

    // Save checkpoint before cancelling
    if (this.checkpointService.isAvailable()) {
      try {
        await this.checkpointService.saveCheckpoint(
          { iterations: 0, currentNode: 'cancelled' } as any,
          { threadId: run.threadId, agentId: run.routineId },
        );
      } catch (error) {
        this.logger.warn(`[cancel] Failed to save checkpoint: ${error}`);
      }
    }

    await this.runRepository.cancel(runId);
  }

  /**
   * Get current state of a running routine
   */
  async getState(runId: string): Promise<RoutineGraphState | null> {
    const run = await this.runRepository.findById(runId, '');
    if (!run) {
      return null;
    }

    if (!run.state) {
      return null;
    }

    return {
      runId: run.id,
      currentNode: null,
      iteration: 0,
      nodes: {},
      context: run.state as Record<string, unknown>,
    };
  }

  /**
   * Validate routine graph definition
   */
  validateGraph(definition: RoutineGraphDefinition): ValidationResult {
    return this.routineGraph.validateGraph(definition);
  }

  /**
   * Calculate next fire time for schedule triggers
   */
  private calculateNextFire(triggerId: string): Date | undefined {
    // In production, use cron-parser or similar
    // For now, return undefined
    return undefined;
  }

  /**
   * Handle webhook trigger
   */
  async handleWebhookTrigger(
    webhookPath: string,
    payload: Record<string, unknown>,
  ): Promise<RoutineExecutionResult> {
    this.logger.log(`[webhook] Handling trigger for path: ${webhookPath}`);

    // Find trigger by path
    const trigger = await this.triggerRepository.findByWebhookPath(webhookPath);
    if (!trigger) {
      throw new NotFoundException(`Webhook not found: ${webhookPath}`);
    }

    if (!trigger.isActive) {
      throw new BadRequestException('Webhook trigger is disabled');
    }

    const routine = await this.routineRepository.findById(
      trigger.routineId,
      '',
    );
    if (!routine) {
      throw new NotFoundException('Routine not found');
    }

    // Execute routine with webhook payload as input
    return this.execute({
      routineId: routine.id,
      tenantId: routine.tenantId,
      input: payload,
      triggerType: 'WEBHOOK',
      triggerId: trigger.id,
    });
  }

  /**
   * Handle event trigger
   */
  async handleEventTrigger(
    tenantId: string,
    eventType: string,
    eventData: Record<string, unknown>,
  ): Promise<void> {
    this.logger.log(`[event] Handling ${eventType} for tenant: ${tenantId}`);

    // Find active event triggers for this tenant and event type
    // This would query triggers with eventType in their config
    // Then execute matching routines

    // Placeholder implementation
    this.logger.debug(`[event] No event triggers configured for ${eventType}`);
  }
}
