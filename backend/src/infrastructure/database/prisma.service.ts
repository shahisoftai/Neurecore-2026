import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Single Responsibility: manages Prisma connection lifecycle only.
// Dependency Inversion: injected everywhere as PrismaService abstraction.
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  // Workaround: in some Windows/dev setups Prisma Client generation can be blocked
  // by a locked query engine DLL, leaving TypeScript with stale client typings.
  // This wrapper keeps $transaction available on PrismaService regardless.

  $transaction(...args: any[]): any {
    // Call the base class implementation without illegal `super` casting.

    return (PrismaClient.prototype.$transaction as any).apply(this, args);
  }

  async onModuleInit(): Promise<void> {
    // Attempt to connect to the database but do not block startup indefinitely.
    const connectPromise = this.$connect();
    const timeoutMs = 5000;
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Prisma connect timeout')), timeoutMs),
    );

    try {
      await Promise.race([connectPromise, timeout]);
      this.logger.log('Database connected');
    } catch (err) {
      this.logger.warn(
        `Database did not connect within ${timeoutMs}ms: ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}
