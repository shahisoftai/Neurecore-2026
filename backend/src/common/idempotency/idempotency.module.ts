import { Module, Global } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { PrismaService } from '../../infrastructure/database/prisma.service';

/**
 * IdempotencyModule — Phase 1 (Simulation-5) reusable idempotency layer.
 *
 * @Global so any controller in the app can use IdempotencyService and
 * IdempotencyInterceptor without re-importing the module.
 */
@Global()
@Module({
  providers: [IdempotencyService, IdempotencyInterceptor, PrismaService],
  exports: [IdempotencyService, IdempotencyInterceptor],
})
export class IdempotencyModule {}