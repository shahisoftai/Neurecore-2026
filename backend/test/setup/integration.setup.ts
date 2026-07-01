/**
 * Integration Test Setup for NeureCore Backend
 *
 * This file runs before integration tests and provides:
 * - Test database setup and teardown
 * - Real service connections (with cleanup)
 * - Test isolation for integration tests
 *
 * @version 1.0.0
 */

import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

// Global test instances
let testPrisma: PrismaClient;
let testRedis: Redis;

/**
 * Get test Prisma client
 */
export function getTestPrisma(): PrismaClient {
  if (!testPrisma) {
    testPrisma = new PrismaClient({
      datasources: {
        db: {
          url:
            process.env.DATABASE_TEST_URL ||
            'postgresql://test:test@localhost:5432/neurecore_test',
        },
      },
    });
  }
  return testPrisma;
}

/**
 * Get test Redis client
 */
export function getTestRedis(): Redis {
  if (!testRedis) {
    testRedis = new Redis({
      host: process.env.REDIS_TEST_HOST || 'localhost',
      port: parseInt(process.env.REDIS_TEST_PORT || '6379'),
      password: process.env.REDIS_TEST_PASSWORD,
      db: parseInt(process.env.REDIS_TEST_DB || '1'),
      lazyConnect: true,
    });
  }
  return testRedis;
}

/**
 * Clean database before each test
 * Uses a generic approach that works with any schema
 */
export async function cleanDatabase(): Promise<void> {
  const prisma = getTestPrisma();

  try {
    // Use raw SQL for generic cleanup (works with any schema)
    await prisma.$executeRaw`TRUNCATE TABLE users, tenants, analytics_models CASCADE`;
  } catch (error) {
    // Tables might not exist yet, ignore
    console.log('Database cleanup warning:', error);
  }
}

// Setup before all tests
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL =
    process.env.DATABASE_TEST_URL ||
    'postgresql://test:test@localhost:5432/neurecore_test';

  // Initialize test database connection
  testPrisma = getTestPrisma();

  try {
    await testPrisma.$connect();
    await cleanDatabase();
  } catch (error) {
    console.log('Database connection warning:', error);
  }

  // Try to connect to Redis (optional for integration tests)
  try {
    testRedis = getTestRedis();
    await testRedis.connect();
  } catch (error) {
    console.log('Redis connection warning:', error);
  }
});

// Cleanup after all tests
afterAll(async () => {
  // Clean database
  try {
    await cleanDatabase();
    await testPrisma?.$disconnect();
  } catch (error) {
    console.log('Database disconnect warning:', error);
  }

  // Disconnect Redis
  try {
    await testRedis?.quit();
  } catch (error) {
    console.log('Redis disconnect warning:', error);
  }
});

// Reset database before each test
beforeEach(async () => {
  try {
    await cleanDatabase();
  } catch (error) {
    console.log('Database reset warning:', error);
  }
});

/**
 * Create a test app instance
 */
export async function createTestApp() {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  return moduleFixture.createNestApplication();
}

/**
 * Test app factory options
 */
export interface TestAppOptions {
  enableValidation?: boolean;
  enableCors?: boolean;
  globalPrefix?: string;
}

/**
 * Create a configured test app instance
 */
export async function createTestAppWithOptions(options: TestAppOptions = {}) {
  const {
    enableValidation = true,
    enableCors = true,
    globalPrefix = 'api',
  } = options;

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  if (enableCors) {
    app.enableCors();
  }

  if (enableValidation) {
    app.useGlobalPipes();
  }

  if (globalPrefix) {
    app.setGlobalPrefix(globalPrefix);
  }

  await app.init();

  return app;
}
