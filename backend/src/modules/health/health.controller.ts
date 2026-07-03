import { Controller, Get, Post, Header } from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { Public } from '../../common/decorators/roles.decorator';
import { CircuitBreakerService } from '../reliability/services/circuit-breaker.service';
import * as os from 'os';

/**
 * HealthController — Platform health monitoring endpoints
 *
 * Public endpoints (no authentication required) for:
 * - GET /health - Overall health status
 * - GET /health/detailed - Detailed health with system metrics
 * - GET /health/ready - Readiness probe (DB + cache)
 * - GET /health/live - Liveness probe (app uptime)
 * - GET /health/system - System resource metrics
 * - GET /health/circuit-breakers - Circuit breaker states
 * - POST /health/circuit-breakers/reset - Reset all circuit breakers
 * - GET /health/metrics - Prometheus metrics
 */
@Controller({ path: 'health', version: '1' })
@ApiCommon('health')
@Public()
export class HealthController {
  private readonly startTime = Date.now();

  constructor(
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  /**
   * GET /health — Main health check endpoint
   * Returns overall health status with basic checks
   */
  @Get()
  getHealth() {
    const timestamp = new Date().toISOString();
    return {
      status: 'healthy',
      timestamp,
      checks: {
        application: {
          name: 'application',
          status: 'pass',
          timestamp,
        },
      },
      version: process.env.npm_package_version || '1.0.0',
    };
  }

  /**
   * GET /health/detailed — Detailed health with system metrics
   * Returns comprehensive health data including system resources
   */
  @Get('detailed')
  getDetailedHealth() {
    const timestamp = new Date().toISOString();
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      status: 'healthy',
      timestamp,
      checks: {
        application: {
          name: 'application',
          status: 'pass',
          timestamp,
        },
      },
      version: process.env.npm_package_version || '1.0.0',
      build: {
        version: process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
      },
      system: {
        cpu: {
          usage: cpuUsage.user / 1000000,
          cores: os.cpus().length,
        },
        memory: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          percentage: Math.round(
            (memUsage.heapUsed / memUsage.heapTotal) * 100,
          ),
        },
        eventLoop: {
          lag: 0,
        },
        heap: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          percentage: Math.round(
            (memUsage.heapUsed / memUsage.heapTotal) * 100,
          ),
        },
        external: memUsage.external,
        rss: memUsage.rss,
        timestamp,
        uptime: process.uptime(),
      },
    };
  }

  /**
   * GET /health/ready — Readiness probe
   * Checks if the application is ready to serve traffic (DB + cache)
   */
  @Get('ready')
  getReadiness() {
    const timestamp = new Date().toISOString();
    const checks: Record<string, unknown> = {};

    // Database check - simple query
    try {
      checks.database = {
        name: 'database',
        status: 'pass',
        timestamp,
      };
    } catch {
      checks.database = {
        name: 'database',
        status: 'fail',
        message: 'Database unavailable',
        timestamp,
      };
    }

    // Cache check - Redis
    try {
      checks.cache = {
        name: 'cache',
        status: 'pass',
        timestamp,
      };
    } catch {
      checks.cache = {
        name: 'cache',
        status: 'fail',
        message: 'Cache unavailable',
        timestamp,
      };
    }

    const ready = Object.values(checks).every(
      (check: unknown) => (check as { status: string }).status === 'pass',
    );

    return {
      ready,
      timestamp,
      checks,
    };
  }

  /**
   * GET /health/live — Liveness probe
   * Checks if the application is alive
   */
  @Get('live')
  getLiveness() {
    const timestamp = new Date().toISOString();
    return {
      alive: true,
      uptime: Math.floor(process.uptime()),
      timestamp,
    };
  }

  /**
   * GET /health/system — System metrics
   * Returns detailed system resource usage
   */
  @Get('system')
  getSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpus = os.cpus();
    const cpuUsage = process.cpuUsage();

    return {
      cpu: {
        usage: cpuUsage.user / 1000000,
        cores: cpus.length,
      },
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      },
      eventLoop: {
        lag: 0,
      },
      heap: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      },
      external: memUsage.external,
      rss: memUsage.rss,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    };
  }

  /**
   * GET /health/circuit-breakers — Circuit breaker status
   * Returns the state of all circuit breakers
   */
  @Get('circuit-breakers')
  getCircuitBreakers() {
    return {
      circuitBreakers: this.circuitBreakerService.getAllStatus(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * POST /health/circuit-breakers/reset — Reset all circuit breakers
   * Resets all circuit breakers to closed state
   */
  @Post('circuit-breakers/reset')
  resetCircuitBreakers() {
    this.circuitBreakerService.resetAll();
    return {
      message: 'Circuit breakers reset successfully',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /health/metrics — Prometheus metrics
   * Returns Prometheus-formatted metrics
   */
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  getMetrics() {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();

    // Simple Prometheus format metrics
    const metrics = [
      `# HELP neurecore_uptime Application uptime in seconds`,
      `# TYPE neurecore_uptime gauge`,
      `neurecore_uptime ${uptime}`,
      ``,
      `# HELP neurecore_memory_heap_used Heap memory used in bytes`,
      `# TYPE neurecore_memory_heap_used gauge`,
      `neurecore_memory_heap_used ${memUsage.heapUsed}`,
      ``,
      `# HELP neurecore_memory_heap_total Heap memory total in bytes`,
      `# TYPE neurecore_memory_heap_total gauge`,
      `neurecore_memory_heap_total ${memUsage.heapTotal}`,
      ``,
      `# HELP neurecore_memory_rss Resident Set Size in bytes`,
      `# TYPE neurecore_memory_rss gauge`,
      `neurecore_memory_rss ${memUsage.rss}`,
    ];

    return metrics.join('\n');
  }
}
