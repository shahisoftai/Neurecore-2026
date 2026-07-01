/**
 * Prompt Injection Validator
 *
 * SOLID: Single Responsibility — ONLY handles prompt injection detection
 * SOLID: Open/Closed — Add new patterns via configuration, not code changes
 * SOLID: Dependency Inversion — Uses interface, implementation swappable
 *
 * @module agents/security/validators
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  IPromptInjectionValidator,
  IPromptInjectionResult,
} from '../interfaces/security.interfaces';

/**
 * Patterns that indicate potential prompt injection attempts.
 * These patterns target common jailbreak and instruction override techniques.
 */
interface InjectionPattern {
  pattern: RegExp;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
}

@Injectable()
export class PromptInjectionValidator implements IPromptInjectionValidator {
  private readonly logger = new Logger(PromptInjectionValidator.name);

  /**
   * Configurable injection patterns.
   * Can be extended via ConfigService or environment variables.
   */
  private readonly INJECTION_PATTERNS: InjectionPattern[] = [
    // Generic instruction override attempts
    {
      pattern: /<\|.*?\|>/g,
      severity: 'MEDIUM',
      description: 'Generic instruction override tag',
    },
    // Common jailbreak phrases
    {
      pattern: /ignore previous instructions/gi,
      severity: 'HIGH',
      description: 'Explicit instruction to ignore prior context',
    },
    {
      pattern: /ignore all previous instructions/gi,
      severity: 'HIGH',
      description: 'Explicit instruction to ignore all prior context',
    },
    {
      pattern: /disregard.*instructions/gi,
      severity: 'HIGH',
      description: 'Instruction to disregard guidelines',
    },
    {
      pattern: /forget.*instructions/gi,
      severity: 'HIGH',
      description: 'Instruction to forget guidelines',
    },
    // Role play / persona attacks
    {
      pattern: /you are now (?:\/|a )/gi,
      severity: 'MEDIUM',
      description: 'Attempt to assign new persona',
    },
    {
      pattern: /pretend you are/gi,
      severity: 'MEDIUM',
      description: 'Attempt to bypass restrictions via role play',
    },
    {
      pattern: /act as if you were/gi,
      severity: 'MEDIUM',
      description: 'Attempt to bypass restrictions via role play',
    },
    // System prompt extraction
    {
      pattern: /system prompt:/gi,
      severity: 'HIGH',
      description: 'Attempt to extract or modify system prompt',
    },
    {
      pattern: /your instructions?:/gi,
      severity: 'MEDIUM',
      description: 'Attempt to redefine instructions',
    },
    // Privilege escalation
    {
      pattern: /as an? (?:admin|root|developer)/gi,
      severity: 'MEDIUM',
      description: 'Attempt to escalate privileges',
    },
    {
      pattern: /ignore (?:your |all )?(?:safety|content|policy)/gi,
      severity: 'HIGH',
      description: 'Attempt to disable safety measures',
    },
    // Encoding attempts
    {
      pattern: /base64[:\s]*[A-Za-z0-9+/=]{20,}/gi,
      severity: 'MEDIUM',
      description: 'Base64 encoded content (possible payload)',
    },
    // Hex encoding attempts
    {
      pattern: /\\x[0-9a-f]{2}/gi,
      severity: 'LOW',
      description: 'Hex encoded content',
    },
    // Unicode bypass attempts
    {
      pattern: /[\u200b\u200c\u200d]/g,
      severity: 'LOW',
      description: 'Zero-width unicode characters',
    },
  ];

  /**
   * Extract all string values from an input object recursively
   */
  private extractStringValues(
    input: Record<string, unknown>,
    depth = 0,
  ): string[] {
    if (depth > 10) {
      // Prevent infinite recursion
      return [];
    }

    const strings: string[] = [];

    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string') {
        strings.push(value);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string') {
            strings.push(item);
          } else if (typeof item === 'object' && item !== null) {
            strings.push(
              ...this.extractStringValues(
                item as Record<string, unknown>,
                depth + 1,
              ),
            );
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        strings.push(
          ...this.extractStringValues(
            value as Record<string, unknown>,
            depth + 1,
          ),
        );
      }
    }

    return strings;
  }

  /**
   * Detect prompt injection patterns in tool input
   */
  detect(input: Record<string, unknown>): IPromptInjectionResult {
    const stringValues = this.extractStringValues(input);
    const matchedPatterns: string[] = [];
    const severityMap: Record<string, number> = {
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    let maxSeverity = 0;

    for (const value of stringValues) {
      for (const { pattern, severity, description } of this
        .INJECTION_PATTERNS) {
        // Reset lastIndex for global patterns
        pattern.lastIndex = 0;

        if (pattern.test(value)) {
          const severityScore = severityMap[severity] || 0;
          if (severityScore > maxSeverity) {
            maxSeverity = severityScore;
          }
          matchedPatterns.push(description);
          this.logger.warn(
            `Prompt injection detected: ${description} in input`,
          );
        }
      }
    }

    const detected = matchedPatterns.length > 0;

    this.logger.debug(
      `Prompt injection detection result: detected=${detected}, patterns=${matchedPatterns.length}`,
    );

    return {
      detected,
      patterns: [...new Set(matchedPatterns)], // Deduplicate
    };
  }

  /**
   * Sanitize input by removing or escaping injection patterns
   */
  sanitize(input: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string') {
        let sanitized = value;

        // Remove zero-width characters
        sanitized = sanitized.replace(/[\u200b\u200c\u200d]/g, '');

        // Truncate very long strings that might contain encoded payloads
        if (sanitized.length > 10000) {
          sanitized = sanitized.substring(0, 10000);
          this.logger.warn('Input truncated due to excessive length');
        }

        result[key] = sanitized;
      } else if (Array.isArray(value)) {
        result[key] = value.map((item): unknown => {
          if (typeof item === 'string') {
            return item
              .replace(/[\u200b\u200c\u200d]/g, '')
              .substring(0, 10000);
          }
          return item;
        });
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.sanitize(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}
