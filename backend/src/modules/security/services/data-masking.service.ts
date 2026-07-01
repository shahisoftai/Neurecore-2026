/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Data Masking Service - Sensitive Data Protection
 * ═══════════════════════════════════════════════════════════════════════════
 * Provides utilities for masking sensitive data in logs and responses.
 * Follows SOLID principles - Single Responsibility for data masking.
 */

import { Injectable, Logger } from '@nestjs/common';
import { MaskableField } from '../../../shared/types/security.types';

/**
 * Default fields to mask
 */
const DEFAULT_MASK_FIELDS: MaskableField[] = [
  'password',
  'passwordHash',
  'token',
  'refreshToken',
  'accessToken',
  'secret',
  'apiKey',
  'creditCard',
  'ssn',
];

/**
 * Field patterns to auto-detect
 */
const SENSITIVE_FIELD_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api_?key/i,
  /access_?token/i,
  /refresh_?token/i,
  /credit_?card/i,
  /ssn/i,
  /social_?security/i,
  /private_?key/i,
  /auth/i,
  /credential/i,
  /bank_?account/i,
  /routing_?number/i,
];

@Injectable()
export class DataMaskingService {
  private readonly logger = new Logger(DataMaskingService.name);

  /**
   * Mask a single value
   */
  maskValue(value: unknown, field: string): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object') {
      return '[object]';
    }

    const stringValue = String(value);
    const length = stringValue.length;

    if (length <= 4) {
      return '*'.repeat(length);
    }

    // Show first 2 and last 2 characters
    const visibleStart = stringValue.substring(0, 2);
    const visibleEnd = stringValue.substring(length - 2);
    const maskedMiddle = '*'.repeat(Math.min(length - 4, 8));

    return `${visibleStart}${maskedMiddle}${visibleEnd}`;
  }

  /**
   * Mask an object field
   */
  maskField(value: unknown): string {
    if (value === null || value === undefined) {
      return '[null]';
    }

    if (typeof value === 'object') {
      return '[object]';
    }

    return this.maskValue(value, '');
  }

  /**
   * Mask sensitive fields in an object
   */
  maskObject<T extends Record<string, unknown>>(
    obj: T,
    additionalFields: string[] = [],
  ): T {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const fieldsToMask = [...DEFAULT_MASK_FIELDS, ...additionalFields];
    const result: Record<string, unknown> = { ...obj };

    for (const [key, value] of Object.entries(result)) {
      // Check if field should be masked
      const shouldMask =
        fieldsToMask.some((field) =>
          key.toLowerCase().includes(field.toLowerCase()),
        ) || SENSITIVE_FIELD_PATTERN_REGEX.some((pattern) => pattern.test(key));

      if (shouldMask) {
        result[key] = this.maskField(value);
      } else if (typeof value === 'object' && value !== null) {
        // Recursively mask nested objects
        result[key] = this.maskObject(value as Record<string, unknown>);
      }
    }

    return result as T;
  }

  /**
   * Mask sensitive fields in an array
   */
  maskArray<T extends Record<string, unknown>>(
    arr: T[],
    additionalFields: string[] = [],
  ): T[] {
    if (!Array.isArray(arr)) {
      return arr;
    }

    return arr.map((item) => this.maskObject(item, additionalFields));
  }

  /**
   * Mask a JSON string
   */
  maskJson(jsonString: string, additionalFields: string[] = []): string {
    try {
      const parsed = JSON.parse(jsonString);
      const masked = this.maskObject(parsed, additionalFields);
      return JSON.stringify(masked);
    } catch {
      return jsonString;
    }
  }

  /**
   * Mask email address
   */
  maskEmail(email: string): string {
    if (!email || !email.includes('@')) {
      return email;
    }

    const [localPart, domain] = email.split('@');

    if (localPart.length <= 2) {
      return `**@${domain}`;
    }

    return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`;
  }

  /**
   * Mask phone number
   */
  maskPhone(phone: string): string {
    if (!phone) {
      return phone;
    }

    // Keep only last 4 digits
    const digits = phone.replace(/\D/g, '');

    if (digits.length <= 4) {
      return '*'.repeat(digits.length);
    }

    return '*'.repeat(digits.length - 4) + digits.slice(-4);
  }

  /**
   * Mask credit card number
   */
  maskCreditCard(cardNumber: string): string {
    if (!cardNumber) {
      return cardNumber;
    }

    // Keep only last 4 digits
    const digits = cardNumber.replace(/\D/g, '');

    if (digits.length < 4) {
      return '*'.repeat(digits.length);
    }

    return '*'.repeat(digits.length - 4) + digits.slice(-4);
  }

  /**
   * Create a redaction function for logging
   */
  createRedactor(additionalFields: string[] = []) {
    return (obj: Record<string, unknown>) => {
      return this.maskObject(obj, additionalFields);
    };
  }

  /**
   * Mask user identifying information for privacy
   */
  maskUserData<T extends Record<string, unknown>>(userData: T): Partial<T> {
    const maskableFields = ['name', 'email', 'phone', 'address', 'ipAddress'];
    const masked = this.maskObject(userData, maskableFields);

    // Also explicitly remove certain fields
    const result = { ...masked };
    delete (result as Record<string, unknown>).password;
    delete (result as Record<string, unknown>).passwordHash;
    delete (result as Record<string, unknown>).refreshToken;
    delete (result as Record<string, unknown>).token;

    return result;
  }
}

// Create regex patterns for sensitive field detection
const SENSITIVE_FIELD_PATTERN_REGEX = SENSITIVE_FIELD_PATTERNS.map(
  (pattern) => new RegExp(pattern.source, 'i'),
);
