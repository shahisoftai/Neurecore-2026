/**
 * Unit Test Setup for NeureCore Backend
 *
 * This file runs before each unit test and provides:
 * - Global test utilities
 * - Mock resets
 * - Jest custom matchers
 * - Test isolation setup
 *
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';

// Extend Jest with custom matchers
expect.extend({
  /**
   * Custom matcher: toBeValidUUID
   * Validates that a string is a valid UUID v4
   */
  toBeValidUUID(received: string): { message: () => string; pass: boolean } {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    return {
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be a valid UUID`,
      pass,
    };
  },

  /**
   * Custom matcher: toBeWithinRange
   * Validates that a number is within a specified range
   */
  toBeWithinRange(
    received: number,
    min: number,
    max: number,
  ): { message: () => string; pass: boolean } {
    const pass = received >= min && received <= max;
    return {
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be within range ${min}-${max}`,
      pass,
    };
  },

  /**
   * Custom matcher: toHaveBeenCalledWithMatch
   * Validates that a mock was called with arguments matching a partial object
   */
  toHaveBeenCalledWithMatch(
    mockFn: jest.Mock,
    matchObj: Record<string, unknown>,
  ): { message: () => string; pass: boolean } {
    const calls = mockFn.mock.calls;
    const pass = calls.some((call) => {
      if (call.length === 0) return false;
      const lastArg = call[call.length - 1];
      if (typeof lastArg !== 'object' || lastArg === null) return false;

      return Object.entries(matchObj).every(
        ([key, value]) => (lastArg as Record<string, unknown>)[key] === value,
      );
    });
    return {
      message: () =>
        `expected mock to have been called with matching ${JSON.stringify(matchObj)}`,
      pass,
    };
  },

  /**
   * Custom matcher: toBeIsoDateString
   * Validates that a string is a valid ISO date string
   */
  toBeIsoDateString(received: string): {
    message: () => string;
    pass: boolean;
  } {
    const date = new Date(received);
    const pass = !isNaN(date.getTime()) && received === date.toISOString();
    return {
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be a valid ISO date string`,
      pass,
    };
  },
});

// Global test timeout
jest.setTimeout(30000);

// Setup global mocks
beforeAll(() => {
  // Mock console.error in test environment to reduce noise
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    // Suppress specific warnings that are expected in tests
    const message = args[0];
    if (typeof message === 'string' && message.includes('[SECURITY]')) {
      return;
    }
    originalError.call(console, ...args);
  };
});

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

// Global teardown
afterAll(() => {
  // Close any remaining handles
  jest.useRealTimers();
});

/**
 * Test helper utilities
 */
export const testHelpers = {
  /**
   * Generate a unique ID for test isolation
   */
  generateUniqueId: () => uuidv4(),

  /**
   * Wait for a specified duration (useful for async tests)
   */
  wait: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),

  /**
   * Create a mock function with typed return value
   */
  mockFn: <T = unknown>(returnValue?: T) =>
    jest.fn().mockReturnValue(returnValue),

  /**
   * Create a rejected mock function
   */
  mockRejectedFn: <T = unknown>(error: Error) =>
    jest.fn().mockRejectedValue(error),

  /**
   * Create a resolved mock function
   */
  mockResolvedFn: <T = unknown>(value: T) => jest.fn().mockResolvedValue(value),
};

/**
 * Re-export for convenience
 */
export * from './matchers';
export * from './test-data';
