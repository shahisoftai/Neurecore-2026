/**
 * Health Monitoring Types
 *
 * Type definitions for health checks and monitoring.
 * Follows SOLID principles with interface segregation.
 */

// ============================================================================
// Health Status Types
// ============================================================================

/**
 * Overall health status enumeration
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
}

/**
 * Health check result status
 */
export enum HealthCheckStatus {
  PASS = 'pass',
  FAIL = 'fail',
  WARN = 'warn',
}

/**
 * Detailed health check result
 */
export interface HealthCheckResult {
  /** Unique identifier for this health check */
  name: string;
  /** Current status of the health check */
  status: HealthCheckStatus;
  /** Human-readable message describing the status */
  message?: string;
  /** Duration of the health check in milliseconds */
  duration?: number;
  /** Additional metadata about the check */
  metadata?: Record<string, unknown>;
  /** Timestamp when the check was performed */
  timestamp: string;
}

/**
 * Aggregated health check response
 */
export interface HealthResponse {
  /** Overall health status */
  status: HealthStatus;
  /** Timestamp of the health check */
  timestamp: string;
  /** Duration of all health checks in milliseconds */
  duration?: number;
  /** Individual health check results */
  checks: Record<string, HealthCheckResult>;
  /** Version of the health check system */
  version?: string;
  /** Build information */
  build?: {
    version: string;
    timestamp: string;
    environment: string;
  };
}

// ============================================================================
// Component Health Check Types
// ============================================================================

/**
 * Database health check result
 */
export interface DatabaseHealthResult extends HealthCheckResult {
  name: 'database';
  metadata?: {
    /** Database type (postgresql, mysql, etc.) */
    type: string;
    /** Database name */
    database?: string;
    /** Number of active connections */
    activeConnections?: number;
    /** Maximum number of connections */
    maxConnections?: number;
    /** Query latency in milliseconds */
    queryLatency?: number;
    /** Whether the database is in read-only mode */
    readOnly?: boolean;
  };
}

/**
 * Cache/Redis health check result
 */
export interface CacheHealthResult extends HealthCheckResult {
  name: 'cache';
  metadata?: {
    /** Cache type (redis, memcached, etc.) */
    type: string;
    /** Whether it's an Upstash Redis instance */
    isUpstash?: boolean;
    /** Memory usage in bytes */
    memoryUsage?: number;
    /** Number of connected clients */
    connectedClients?: number;
    /** Cache hit rate percentage */
    hitRate?: number;
    /** Operation latency in milliseconds */
    latency?: number;
  };
}

/**
 * External service health check result
 */
export interface ExternalServiceHealthResult extends HealthCheckResult {
  name: string;
  metadata?: {
    /** Service URL */
    url?: string;
    /** HTTP status code */
    statusCode?: number;
    /** Response time in milliseconds */
    responseTime?: number;
    /** Whether circuit breaker is open */
    circuitOpen?: boolean;
    /** Number of consecutive failures */
    failures?: number;
  };
}

/**
 * Application health check result
 */
export interface ApplicationHealthResult extends HealthCheckResult {
  name: 'application';
  metadata?: {
    /** Application uptime in seconds */
    uptime: number;
    /** Number of active requests */
    activeRequests?: number;
    /** Memory usage in bytes */
    memoryUsage?: {
      heapUsed: number;
      heapTotal: number;
      external: number;
      rss: number;
    };
    /** CPU usage percentage */
    cpuUsage?: number;
    /** Event loop lag in milliseconds */
    eventLoopLag?: number;
  };
}

// ============================================================================
// Metrics Types
// ============================================================================

/**
 * Metric type enumeration
 */
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary',
}

/**
 * Prometheus metric format
 */
export interface PrometheusMetric {
  /** Metric name */
  name: string;
  /** Metric help text */
  help: string;
  /** Metric type */
  type: MetricType;
  /** Metric values */
  values: PrometheusMetricValue[];
}

/**
 * Individual metric value
 */
export interface PrometheusMetricValue {
  /** Metric value */
  value: number;
  /** Labels associated with this metric */
  labels?: Record<string, string>;
  /** Timestamp in milliseconds */
  timestamp?: number;
}

/**
 * Request/Response statistics
 */
export interface RequestStats {
  /** Total number of requests */
  totalRequests: number;
  /** Number of successful requests */
  successfulRequests: number;
  /** Number of failed requests */
  failedRequests: number;
  /** Number of requests by status code */
  requestsByStatus: Record<number, number>;
  /** Average response time in milliseconds */
  avgResponseTime: number;
  /** Min response time in milliseconds */
  minResponseTime: number;
  /** Max response time in milliseconds */
  maxResponseTime: number;
  /** P50 response time in milliseconds */
  p50ResponseTime: number;
  /** P95 response time in milliseconds */
  p95ResponseTime: number;
  /** P99 response time in milliseconds */
  p99ResponseTime: number;
  /** Requests per second */
  requestsPerSecond: number;
}

/**
 * System resource metrics
 */
export interface SystemMetrics {
  /** CPU usage percentage */
  cpu: {
    usage: number;
    cores: number;
  };
  /** Memory usage */
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  /** Event loop lag in milliseconds */
  eventLoop: {
    lag: number;
  };
  /** Heap memory */
  heap: {
    used: number;
    total: number;
    percentage: number;
  };
  /** External memory */
  external: number;
  /** RSS memory */
  rss: number;
  /** Timestamp */
  timestamp: string;
}

/**
 * Business metrics
 */
export interface BusinessMetrics {
  /** Active tenants count */
  activeTenants: number;
  /** Active users count */
  activeUsers: number;
  /** Total API calls */
  totalApiCalls: number;
  /** API calls in last hour */
  apiCallsLastHour: number;
  /** Average API latency */
  avgApiLatency: number;
  /** Error rate percentage */
  errorRate: number;
}

// ============================================================================
// Monitoring Configuration Types
// ============================================================================

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /** Enable or disable this health check */
  enabled: boolean;
  /** Timeout for the health check in milliseconds */
  timeout?: number;
  /** Interval between health checks in milliseconds */
  interval?: number;
  /** Critical threshold for unhealthy status */
  criticalThreshold?: number;
  /** Warning threshold for degraded status */
  warningThreshold?: number;
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time in milliseconds before attempting to close circuit */
  resetTimeout: number;
  /** Half-open state maximum attempts */
  halfOpenMaxAttempts: number;
  /** Whether the circuit breaker is enabled */
  enabled: boolean;
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  /** Alert name */
  name: string;
  /** Metric to monitor */
  metric: string;
  /** Condition for alert */
  condition: 'above' | 'below' | 'equals';
  /** Threshold value */
  threshold: number;
  /** Severity level */
  severity: 'info' | 'warning' | 'critical';
  /** Whether alert is enabled */
  enabled: boolean;
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  /** Health check configurations */
  health: {
    database: HealthCheckConfig;
    cache: HealthCheckConfig;
    external: HealthCheckConfig;
    application: HealthCheckConfig;
  };
  /** Circuit breaker configurations */
  circuitBreaker: {
    [serviceName: string]: CircuitBreakerConfig;
  };
  /** Alert configurations */
  alerts: AlertConfig[];
  /** Metrics collection interval in milliseconds */
  metricsInterval?: number;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Metrics endpoint response
 */
export interface MetricsResponse {
  /** Prometheus-formatted metrics */
  metrics: string;
  /** Timestamp */
  timestamp: string;
}

/**
 * Detailed health endpoint response with all checks
 */
export interface DetailedHealthResponse extends HealthResponse {
  /** System metrics */
  system?: SystemMetrics;
  /** Business metrics */
  business?: BusinessMetrics;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Health check function type
 */
export type HealthCheckFunction = () =>
  | Promise<HealthCheckResult>
  | HealthCheckResult;

/**
 * Metrics collector function type
 */
export type MetricsCollector = () =>
  | Promise<Record<string, number>>
  | Record<string, number>;
