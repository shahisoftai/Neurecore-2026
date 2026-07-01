/**
 * Service Mock Factories for NeureCore Backend
 *
 * Provides mock factories following the Dependency Inversion Principle.
 * These mocks can be injected into test modules to replace real dependencies.
 *
 * @version 1.0.0
 */

/**
 * Creates a mock Prisma client for testing
 * Following Single Responsibility - each method creates one specific mock
 */
export function createMockPrismaClient() {
  return {
    // User operations
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    // Tenant operations
    tenant: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    // Analytics operations
    analyticsModel: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    // Settings operations
    settings: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    // Invoice operations
    invoice: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    // Connector operations
    connector: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    // Transaction support
    $transaction: jest.fn((fn: (...args: any[]) => any) => fn()),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
}

/**
 * Creates a mock Redis cache service
 */
export function createMockRedisService() {
  return {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    ping: jest.fn(),
    mget: jest.fn(),
    mset: jest.fn(),
    incr: jest.fn(),
    decr: jest.fn(),
    hget: jest.fn(),
    hset: jest.fn(),
    hgetall: jest.fn(),
    publish: jest.fn(),
    subscribe: jest.fn(),
    on: jest.fn(),
    quit: jest.fn(),
  };
}

/**
 * Creates a mock HTTP service (for external API calls)
 */
export function createMockHttpService() {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    request: jest.fn(),
    interceptors: {
      request: {
        use: jest.fn(),
        eject: jest.fn(),
        clear: jest.fn(),
      },
      response: {
        use: jest.fn(),
        eject: jest.fn(),
        clear: jest.fn(),
      },
    },
  };
}

/**
 * Creates a mock JWT service
 */
export function createMockJwtService() {
  return {
    sign: jest.fn(),
    verify: jest.fn(),
    decode: jest.fn(),
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };
}

/**
 * Creates a mock Config service
 */
export function createMockConfigService(
  overrides: Record<string, unknown> = {},
) {
  return {
    get: jest.fn((key: string) => overrides[key] ?? null),
    getOrThrow: jest.fn((key: string) => {
      if (overrides[key] === undefined) {
        throw new Error(`Configuration key "${key}" not found`);
      }
      return overrides[key];
    }),
  };
}

/**
 * Creates a mock Event Emitter
 */
export function createMockEventEmitter() {
  return {
    emit: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    off: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    listenerCount: jest.fn(),
  };
}

/**
 * Creates a mock Logger
 */
export function createMockLogger() {
  return {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    setContext: jest.fn(),
  };
}

/**
 * Creates a mock Model Runner service
 */
export function createMockModelRunner() {
  return {
    runModel: jest.fn(),
    forecast: jest.fn(),
    detectAnomalies: jest.fn(),
    embed: jest.fn(),
    healthCheck: jest.fn(),
  };
}

/**
 * Creates a mock Feature Store
 */
export function createMockFeatureStore() {
  return {
    save: jest.fn(),
    getLatest: jest.fn(),
    list: jest.fn(),
    delete: jest.fn(),
    getHistory: jest.fn(),
  };
}

/**
 * Creates a mock Billing Service
 */
export function createMockBillingService() {
  return {
    createInvoice: jest.fn(),
    calculateAmount: jest.fn(),
    processPayment: jest.fn(),
    refund: jest.fn(),
    getInvoice: jest.fn(),
    listInvoices: jest.fn(),
  };
}

/**
 * Creates a mock OAuth Service
 */
export function createMockOAuthService() {
  return {
    getAuthUrl: jest.fn(),
    exchangeCode: jest.fn(),
    refreshToken: jest.fn(),
    revokeToken: jest.fn(),
    getUserInfo: jest.fn(),
  };
}

/**
 * Creates a mock Connector Service
 */
export function createMockConnectorService() {
  return {
    connect: jest.fn(),
    disconnect: jest.fn(),
    sync: jest.fn(),
    getStatus: jest.fn(),
    getRecords: jest.fn(),
    pushRecords: jest.fn(),
  };
}

/**
 * Creates a mock Security Service
 */
export function createMockSecurityService() {
  return {
    validateToken: jest.fn(),
    hashPassword: jest.fn(),
    comparePassword: jest.fn(),
    maskSensitiveData: jest.fn(),
    sanitizeInput: jest.fn(),
    checkRateLimit: jest.fn(),
  };
}

/**
 * Type for mocked services
 */
export interface MockedServices {
  prisma: ReturnType<typeof createMockPrismaClient>;
  redis: ReturnType<typeof createMockRedisService>;
  httpService: ReturnType<typeof createMockHttpService>;
  jwtService: ReturnType<typeof createMockJwtService>;
  configService: ReturnType<typeof createMockConfigService>;
  eventEmitter: ReturnType<typeof createMockEventEmitter>;
  logger: ReturnType<typeof createMockLogger>;
  modelRunner: ReturnType<typeof createMockModelRunner>;
  featureStore: ReturnType<typeof createMockFeatureStore>;
  billingService: ReturnType<typeof createMockBillingService>;
  oauthService: ReturnType<typeof createMockOAuthService>;
  connectorService: ReturnType<typeof createMockConnectorService>;
  securityService: ReturnType<typeof createMockSecurityService>;
}

/**
 * Creates all mock services at once
 */
export function createAllMockServices(): MockedServices {
  return {
    prisma: createMockPrismaClient(),
    redis: createMockRedisService(),
    httpService: createMockHttpService(),
    jwtService: createMockJwtService(),
    configService: createMockConfigService(),
    eventEmitter: createMockEventEmitter(),
    logger: createMockLogger(),
    modelRunner: createMockModelRunner(),
    featureStore: createMockFeatureStore(),
    billingService: createMockBillingService(),
    oauthService: createMockOAuthService(),
    connectorService: createMockConnectorService(),
    securityService: createMockSecurityService(),
  };
}
