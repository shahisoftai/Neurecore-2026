/**
 * Custom Jest Matchers for NeureCore Backend
 *
 * Provides custom matchers for common testing patterns in the application.
 * Following the Single Responsibility Principle - each matcher handles one validation concern.
 *
 * @version 1.0.0
 */

/* eslint-disable @typescript-eslint/no-namespace */

/**
 * Custom matcher: toBeValidUUID
 * Validates that a string is a valid UUID v4
 */
export function toBeValidUUID(received: string): {
  message: () => string;
  pass: boolean;
} {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const pass = uuidRegex.test(received);
  return {
    message: () =>
      `expected ${received} ${pass ? 'not ' : ''}to be a valid UUID`,
    pass,
  };
}

/**
 * Custom matcher: toBeWithinRange
 * Validates that a number is within a specified range
 */
export function toBeWithinRange(
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
}

/**
 * Custom matcher: toBeIsoDateString
 * Validates that a string is a valid ISO date string
 */
export function toBeIsoDateString(received: string): {
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
}

/**
 * Custom matcher: toContainAtLeast
 * Validates that an array contains at least the specified items
 */
export function toContainAtLeast<T>(
  received: T[],
  items: T[],
): { message: () => string; pass: boolean } {
  const pass = items.every((item) => received.includes(item));
  return {
    message: () =>
      `expected array to contain at least ${JSON.stringify(items)}`,
    pass,
  };
}

/**
 * Custom matcher: toMatchObjectShape
 * Validates that an object has at least the specified keys
 */
export function toMatchObjectShape(
  received: Record<string, unknown>,
  shape: Record<string, unknown>,
): { message: () => string; pass: boolean } {
  const receivedKeys = Object.keys(received);
  const shapeKeys = Object.keys(shape);
  const pass = shapeKeys.every((key) => receivedKeys.includes(key));
  return {
    message: () =>
      `expected object to have at least keys ${JSON.stringify(shapeKeys)}`,
    pass,
  };
}

/**
 * Custom matcher: toBeValidEmail
 * Validates that a string is a valid email format
 */
export function toBeValidEmail(received: string): {
  message: () => string;
  pass: boolean;
} {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const pass = emailRegex.test(received);
  return {
    message: () =>
      `expected ${received} ${pass ? 'not ' : ''}to be a valid email`,
    pass,
  };
}

/**
 * Custom matcher: toBeValidUrl
 * Validates that a string is a valid URL
 */
export function toBeValidUrl(received: string): {
  message: () => string;
  pass: boolean;
} {
  try {
    new URL(received);
    return { message: () => '', pass: true };
  } catch {
    return {
      message: () => `expected ${received} to be a valid URL`,
      pass: false,
    };
  }
}

/**
 * Custom matcher: toBeAlphanumeric
 * Validates that a string contains only alphanumeric characters
 */
export function toBeAlphanumeric(received: string): {
  message: () => string;
  pass: boolean;
} {
  const alphanumericRegex = /^[a-zA-Z0-9]+$/;
  const pass = alphanumericRegex.test(received);
  return {
    message: () =>
      `expected ${received} ${pass ? 'not ' : ''}to be alphanumeric`,
    pass,
  };
}

/**
 * Extend Jest with custom matchers
 */
export function extendJestMatchers(): void {
  expect.extend({
    toBeValidUUID,
    toBeWithinRange,
    toBeIsoDateString,
    toContainAtLeast,
    toMatchObjectShape,
    toBeValidEmail,
    toBeValidUrl,
    toBeAlphanumeric,
  });
}

// Type declaration for Jest expect
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeWithinRange(min: number, max: number): R;
      toBeIsoDateString(): R;
      toContainAtLeast<T>(items: T[]): R;
      toMatchObjectShape(shape: Record<string, unknown>): R;
      toBeValidEmail(): R;
      toBeValidUrl(): R;
      toBeAlphanumeric(): R;
    }
  }
}
