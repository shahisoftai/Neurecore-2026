import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ReliabilityModule } from '../reliability/reliability.module';

/**
 * HealthModule — Platform health monitoring endpoints
 *
 * Provides public health check endpoints for:
 * - Overall health status
 * - Readiness probes (database, cache)
 * - Liveness probes (application uptime)
 * - System metrics (CPU, memory, event loop)
 * - Circuit breaker status
 *
 * These endpoints are public (no auth) for load balancer and
 * Kubernetes probe compatibility.
 */
@Module({
  imports: [ReliabilityModule],
  controllers: [HealthController],
  exports: [],
})
export class HealthModule {}
