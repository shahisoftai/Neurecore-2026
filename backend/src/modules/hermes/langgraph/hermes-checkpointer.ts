import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { HermesMemoryService } from '../services/hermes-memory.service';

const logger = new Logger('HermesCheckpointer');

export class HermesCheckpointer {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memoryService: HermesMemoryService,
  ) {}

  async save(threadId: string, state: Record<string, unknown>): Promise<void> {
    try {
      const session = await this.prisma.hermesSession.findFirst({
        where: { threadId },
        select: { id: true, context: true },
      });

      if (!session) {
        logger.warn(
          `No session found for thread ${threadId}`,
        );
        return;
      }

      await this.prisma.hermesSession.update({
        where: { id: session.id },
        data: {
          context: {
            ...((session.context as Record<string, unknown>) ?? {}),
            checkpoint: state,
            checkpointSavedAt: new Date().toISOString(),
          } as any,
          updatedAt: new Date(),
        },
      });

      if (state.hermesAgentId && state.pendingMemory) {
        await this.memoryService.rememberEpisode(
          state.hermesAgentId as string,
          state.tenantId as string,
          `Session checkpoint: ${JSON.stringify(state.pendingMemory).substring(0, 500)}`,
        );
      }

      logger.debug(`Saved checkpoint for thread ${threadId}`);
    } catch (err) {
      logger.error(
        `Failed to save checkpoint: ${(err as Error).message}`,
      );
    }
  }

  async load(
    threadId: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      const session = await this.prisma.hermesSession.findFirst({
        where: { threadId },
        select: {
          id: true,
          context: true,
          hermesAgentId: true,
          tenantId: true,
        },
      });

      if (!session) return null;

      const context = (session.context as Record<string, unknown>) ?? {};
      const checkpoint = context?.checkpoint as
        | Record<string, unknown>
        | undefined;

      if (!checkpoint) return null;

      if (session.hermesAgentId) {
        const memoryContext = await this.memoryService.getContext(
          session.hermesAgentId,
          session.tenantId,
        );

        checkpoint.personalMemory = memoryContext;
      }

      logger.debug(
        `Loaded checkpoint for thread ${threadId}`,
      );

      return checkpoint;
    } catch (err) {
      logger.error(
        `Failed to load checkpoint: ${(err as Error).message}`,
      );
      return null;
    }
  }

  async delete(threadId: string): Promise<void> {
    try {
      const session = await this.prisma.hermesSession.findFirst({
        where: { threadId },
        select: { id: true },
      });

      if (!session) return;

      await this.prisma.hermesSession.update({
        where: { id: session.id },
        data: {
          context: {},
          updatedAt: new Date(),
        },
      });

      logger.debug(
        `Deleted checkpoint for thread ${threadId}`,
      );
    } catch (err) {
      logger.error(
        `Failed to delete checkpoint: ${(err as Error).message}`,
      );
    }
  }
}
