/**
 * Agent State Checkpoint Service
 *
 * Provides state persistence and resumption for LangGraph agents using Redis.
 * Enables:
 * - State recovery after interruptions
 * - Agent resumption from last checkpoint
 * - Multi-turn conversation memory
 *
 * Uses Redis for storage with automatic serialization.
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import type { AgentState } from './agent.state';

interface CheckpointMetadata {
  threadId: string;
  createdAt: number;
  updatedAt: number;
  iterations: number;
  nodeName: string;
}

/**
 * Checkpoint data structure stored in Redis
 */
interface CheckpointData {
  state: AgentState;
  metadata: CheckpointMetadata;
}

/**
 * Checkpoint options
 */
export interface CheckpointOptions {
  /** Unique thread/conversation ID */
  threadId: string;
  /** Agent ID for multi-agent scenarios */
  agentId?: string;
  /** TTL in seconds (default: 24 hours) */
  ttlSeconds?: number;
}

/**
 * Redis-backed checkpoint service for LangGraph state persistence
 */
@Injectable()
export class AgentCheckpointService {
  private readonly logger = new Logger(AgentCheckpointService.name);
  private readonly defaultTtl = 86400; // 24 hours

  constructor(
    @Optional() private readonly redis: RedisService | null,
    private readonly config: ConfigService,
  ) {}

  /**
   * Generate checkpoint key for Redis
   */
  private getCheckpointKey(threadId: string, agentId?: string): string {
    const prefix = agentId ? `agent:checkpoint:${agentId}` : 'agent:checkpoint';
    return `${prefix}:thread:${threadId}`;
  }

  /**
   * Generate metadata key for Redis
   */
  private getMetadataKey(threadId: string, agentId?: string): string {
    const prefix = agentId ? `agent:checkpoint:${agentId}` : 'agent:checkpoint';
    return `${prefix}:meta:${threadId}`;
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.redis !== null;
  }

  /**
   * Save agent state checkpoint
   */
  async saveCheckpoint(
    state: AgentState,
    options: CheckpointOptions,
  ): Promise<void> {
    const { threadId, agentId, ttlSeconds = this.defaultTtl } = options;

    if (!this.redis) {
      this.logger.warn('Redis unavailable, checkpoint not saved');
      return;
    }

    const stateKey = this.getCheckpointKey(threadId, agentId);
    const metaKey = this.getMetadataKey(threadId, agentId);

    const now = Date.now();
    const checkpointData: CheckpointData = {
      state,
      metadata: {
        threadId,
        createdAt: now,
        updatedAt: now,
        iterations: state.iterations,
        nodeName: state.currentNode,
      },
    };

    try {
      // Save state and metadata using setJson for type safety
      await Promise.all([
        this.redis.setJson(stateKey, checkpointData, ttlSeconds),
        this.redis.setJson(metaKey, checkpointData.metadata, ttlSeconds),
      ]);

      this.logger.debug(
        `Checkpoint saved for thread ${threadId}, node: ${state.currentNode}`,
      );
    } catch (error) {
      this.logger.error(`Failed to save checkpoint: ${error}`);
      throw error;
    }
  }

  /**
   * Load agent state from checkpoint
   */
  async loadCheckpoint(
    threadId: string,
    agentId?: string,
  ): Promise<AgentState | null> {
    if (!this.redis) {
      this.logger.warn('Redis unavailable, cannot load checkpoint');
      return null;
    }

    const stateKey = this.getCheckpointKey(threadId, agentId);

    try {
      const checkpointData = await this.redis.getJson<CheckpointData>(stateKey);

      if (!checkpointData) {
        this.logger.debug(`No checkpoint found for thread ${threadId}`);
        return null;
      }

      this.logger.debug(
        `Checkpoint loaded for thread ${threadId}, iterations: ${checkpointData.metadata.iterations}`,
      );

      return checkpointData.state;
    } catch (error) {
      this.logger.error(`Failed to load checkpoint: ${error}`);
      return null;
    }
  }

  /**
   * Get checkpoint metadata (without loading full state)
   */
  async getCheckpointMetadata(
    threadId: string,
    agentId?: string,
  ): Promise<CheckpointMetadata | null> {
    if (!this.redis) {
      return null;
    }

    const metaKey = this.getMetadataKey(threadId, agentId);

    try {
      const metadata = await this.redis.getJson<CheckpointMetadata>(metaKey);
      return metadata;
    } catch (error) {
      this.logger.error(`Failed to get checkpoint metadata: ${error}`);
      return null;
    }
  }

  /**
   * Delete checkpoint
   */
  async deleteCheckpoint(threadId: string, agentId?: string): Promise<void> {
    if (!this.redis) {
      return;
    }

    const stateKey = this.getCheckpointKey(threadId, agentId);
    const metaKey = this.getMetadataKey(threadId, agentId);

    try {
      await Promise.all([this.redis.del(stateKey), this.redis.del(metaKey)]);

      this.logger.debug(`Checkpoint deleted for thread ${threadId}`);
    } catch (error) {
      this.logger.error(`Failed to delete checkpoint: ${error}`);
    }
  }

  /**
   * List all checkpoints (for a specific agent or all agents)
   *
   * Note: In production, this would use Redis SCAN. For now, returns empty.
   */
  async listCheckpoints(_agentId?: string): Promise<CheckpointMetadata[]> {
    this.logger.debug(
      'Listing checkpoints - implement with Redis SCAN if needed',
    );
    return [];
  }

  /**
   * Check if a checkpoint exists for a thread
   */
  async hasCheckpoint(threadId: string, agentId?: string): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    const meta = await this.getCheckpointMetadata(threadId, agentId);
    return meta !== null;
  }

  /**
   * Extend checkpoint TTL by re-saving with new TTL
   *
   * Note: Redis doesn't support TTL extension directly, so we re-save.
   */
  async extendCheckpoint(
    threadId: string,
    agentId: string | undefined,
    additionalSeconds: number,
  ): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      // Load current checkpoint
      const checkpoint = await this.loadCheckpoint(threadId, agentId);
      if (!checkpoint) {
        this.logger.warn(
          `No checkpoint found to extend for thread ${threadId}`,
        );
        return;
      }

      // Re-save with extended TTL
      await this.saveCheckpoint(checkpoint, {
        threadId,
        agentId,
        ttlSeconds: additionalSeconds,
      });

      this.logger.debug(`Checkpoint TTL extended for thread ${threadId}`);
    } catch (error) {
      this.logger.error(`Failed to extend checkpoint TTL: ${error}`);
    }
  }
}
