import { Module } from '@nestjs/common';
import { AnalyticsController } from './controllers/analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { PrismaFeatureStore } from './services/featureStore.prisma';
import { HttpModelRunner } from './services/modelRunner.http';

/**
 * AnalyticsModule — Phase 4.1
 *
 * SOLID:
 *  SRP — each provider has one job (store, run model, orchestrate).
 *  OCP — drop-in replacement providers without touching existing code.
 *  DIP — AnalyticsService receives PrismaFeatureStore & HttpModelRunner
 *        via NestJS DI; callers never construct implementations.
 */
@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, PrismaFeatureStore, HttpModelRunner],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
