import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Request statistics
 */
interface RequestStats {
  totalRequests: number;
  totalResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsByStatus: Record<number, number>;
  requestsByMethod: Record<string, number>;
  requestsByEndpoint: Record<string, number>;
}

/**
 * Performance Monitoring Middleware
 *
 * Tracks request/response metrics for monitoring and alerting.
 * Follows Single Responsibility Principle - handles only performance monitoring.
 *
 * Provides:
 * - Response time tracking
 * - Request count by status code
 * - Request count by HTTP method
 * - Request count by endpoint
 * - Average, min, max response times
 */
@Injectable()
export class PerformanceMiddleware implements NestMiddleware {
  private readonly logger = new Logger(PerformanceMiddleware.name);
  private stats: RequestStats = {
    totalRequests: 0,
    totalResponseTime: 0,
    minResponseTime: Infinity,
    maxResponseTime: 0,
    requestsByStatus: {},
    requestsByMethod: {},
    requestsByEndpoint: {},
  };

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();

    // Track when response finishes
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      const method = req.method;
      const endpoint = this.normalizeEndpoint(req.path);

      this.recordRequest(duration, statusCode, method, endpoint);

      // Log slow requests
      if (duration > 5000) {
        this.logger.warn(
          `Slow request: ${method} ${endpoint} took ${duration}ms (status: ${statusCode})`,
        );
      }

      // Log error responses
      if (statusCode >= 400) {
        this.logger.debug(
          `Error response: ${method} ${endpoint} returned ${statusCode} in ${duration}ms`,
        );
      }
    });

    next();
  }

  /**
   * Record a request's metrics
   */
  private recordRequest(
    duration: number,
    statusCode: number,
    method: string,
    endpoint: string,
  ): void {
    this.stats.totalRequests++;
    this.stats.totalResponseTime += duration;
    this.stats.minResponseTime = Math.min(this.stats.minResponseTime, duration);
    this.stats.maxResponseTime = Math.max(this.stats.maxResponseTime, duration);

    // Count by status code
    this.stats.requestsByStatus[statusCode] =
      (this.stats.requestsByStatus[statusCode] || 0) + 1;

    // Count by method
    this.stats.requestsByMethod[method] =
      (this.stats.requestsByMethod[method] || 0) + 1;

    // Count by endpoint
    this.stats.requestsByEndpoint[endpoint] =
      (this.stats.requestsByEndpoint[endpoint] || 0) + 1;
  }

  /**
   * Normalize endpoint for grouping
   */
  private normalizeEndpoint(path: string): string {
    // Replace UUIDs and IDs with placeholder
    return path
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '/:id',
      )
      .replace(/\/[0-9]+/g, '/:id');
  }

  /**
   * Get current statistics
   */
  getStats(): RequestStats & { avgResponseTime: number; errorRate: number } {
    const avgResponseTime =
      this.stats.totalRequests > 0
        ? this.stats.totalResponseTime / this.stats.totalRequests
        : 0;

    // Calculate error rate (4xx and 5xx responses)
    const errorCount = Object.entries(this.stats.requestsByStatus)
      .filter(([code]) => parseInt(code) >= 400)
      .reduce((sum, [, count]) => sum + count, 0);

    const errorRate =
      this.stats.totalRequests > 0
        ? (errorCount / this.stats.totalRequests) * 100
        : 0;

    return {
      ...this.stats,
      avgResponseTime,
      errorRate,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      totalResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      requestsByStatus: {},
      requestsByMethod: {},
      requestsByEndpoint: {},
    };
    this.logger.log('Statistics reset');
  }

  /**
   * Get Prometheus-formatted metrics
   */
  getPrometheusMetrics(): string {
    const stats = this.getStats();
    const lines: string[] = [];

    // Request count
    lines.push(
      '# HELP neurecore_http_requests_total Total number of HTTP requests',
    );
    lines.push('# TYPE neurecore_http_requests_total counter');
    lines.push(`neurecore_http_requests_total ${stats.totalRequests}`);

    // Response time metrics
    lines.push(
      '# HELP neurecore_http_response_time_seconds Response time in seconds',
    );
    lines.push('# TYPE neurecore_http_response_time_seconds summary');
    lines.push(
      `neurecore_http_response_time_seconds_sum ${stats.totalResponseTime / 1000}`,
    );
    lines.push(
      `neurecore_http_response_time_seconds_count ${stats.totalRequests}`,
    );

    // Average response time
    lines.push(
      '# HELP neurecore_http_response_time_avg_seconds Average response time in seconds',
    );
    lines.push('# TYPE neurecore_http_response_time_avg_seconds gauge');
    lines.push(
      `neurecore_http_response_time_avg_seconds ${stats.avgResponseTime / 1000}`,
    );

    // Requests by status code
    lines.push(
      '# HELP neurecore_http_requests_by_status HTTP requests by status code',
    );
    lines.push('# TYPE neurecore_http_requests_by_status counter');
    for (const [code, count] of Object.entries(stats.requestsByStatus)) {
      lines.push(
        `neurecore_http_requests_by_status{status="${code}"} ${count}`,
      );
    }

    // Requests by method
    lines.push(
      '# HELP neurecore_http_requests_by_method HTTP requests by method',
    );
    lines.push('# TYPE neurecore_http_requests_by_method counter');
    for (const [method, count] of Object.entries(stats.requestsByMethod)) {
      lines.push(
        `neurecore_http_requests_by_method{method="${method}"} ${count}`,
      );
    }

    // Error rate
    lines.push(
      '# HELP neurecore_http_error_rate_percent Error rate percentage',
    );
    lines.push('# TYPE neurecore_http_error_rate_percent gauge');
    lines.push(`neurecore_http_error_rate_percent ${stats.errorRate}`);

    return lines.join('\n') + '\n';
  }
}
