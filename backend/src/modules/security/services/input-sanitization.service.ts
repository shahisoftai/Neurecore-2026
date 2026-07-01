/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Input Sanitization Service - XSS and SQL Injection Prevention
 * ═══════════════════════════════════════════════════════════════════════════
 * Provides input validation and sanitization to prevent XSS and SQL injection.
 * Follows SOLID principles - Single Responsibility for input sanitization.
 */

import { Injectable, Logger } from '@nestjs/common';

/**
 * SQL injection patterns
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i,
  /('|(\\'))|(-{2})|(\/\*|\*\/)/,
  /(javascript:|vbscript:|data:text\/html)/i,
  /(on\w+\s*=)/i,
  /(<script|<\/script>)/i,
  /(exec\s*\(|execute\s*\(|xp_|sp_)/i,
  /(\bor\b\s+\d+\s*=\s*\d+)/i,
  /(\band\b\s+\d+\s*=\s*\d+)/i,
];

/**
 * XSS patterns
 */
const XSS_PATTERNS = [
  /(<script|<\/script>)/i,
  /(<iframe|<\/iframe>)/i,
  /(<object|<\/object>)/i,
  /(<embed|<\/embed>)/i,
  /(<link|<\/link>)/i,
  /(javascript:)/i,
  /(on\w+\s*=\s*)/i,
  /(data:text\/html)/i,
  /(<svg.*onload)/i,
  /(<img.*onerror)/i,
  /(\beval\s*\()/i,
  /(\bsetTimeout\s*\()/i,
  /(\bsetInterval\s*\()/i,
];

/**
 * HTML tags to strip
 */
const DANGEROUS_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'link',
  'style',
  'base',
  'meta',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'svg',
  'img',
  'video',
  'audio',
  'source',
  'track',
  'applet',
  'canvas',
  'details',
  'dialog',
  'menu',
  'menuitem',
];

/**
 * Dangerous attributes to strip
 */
const DANGEROUS_ATTRIBUTES = [
  'onclick',
  'ondblclick',
  'onmousedown',
  'onmouseup',
  'onmouseover',
  'onmousemove',
  'onmouseout',
  'onkeydown',
  'onkeypress',
  'onkeyup',
  'onload',
  'onerror',
  'onfocus',
  'onblur',
  'onsubmit',
  'onreset',
  'onchange',
  'onselect',
  'onabort',
  'oncanplay',
  'oncanplaythrough',
  'ondurationchange',
  'onemptied',
  'onended',
  'onloadeddata',
  'onloadedmetadata',
  'onloadstart',
  'onpause',
  'onplay',
  'onplaying',
  'onprogress',
  'onratechange',
  'onseeked',
  'onseeking',
  'onstalled',
  'onsuspend',
  'ontimeupdate',
  'onvolumechange',
  'onwaiting',
  'javascript:',
  'data:',
  'vbscript:',
];

@Injectable()
export class InputSanitizationService {
  private readonly logger = new Logger(InputSanitizationService.name);

  /**
   * Detect SQL injection in input
   */
  detectSqlInjection(input: string): boolean {
    if (!input || typeof input !== 'string') {
      return false;
    }

    for (const pattern of SQL_INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        this.logger.debug(`SQL injection pattern detected: ${pattern.source}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Detect XSS in input
   */
  detectXss(input: string): boolean {
    if (!input || typeof input !== 'string') {
      return false;
    }

    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(input)) {
        this.logger.debug(`XSS pattern detected: ${pattern.source}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Sanitize input to prevent XSS
   */
  sanitizeXss(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    let result = input;

    // First escape HTML entities
    result = this.escapeHtmlEntities(result);

    // Remove dangerous tags
    for (const tag of DANGEROUS_TAGS) {
      const tagPattern = new RegExp(`<\\/?${tag}[^>]*>`, 'gi');
      result = result.replace(tagPattern, '');
    }

    // Remove dangerous attributes
    for (const attr of DANGEROUS_ATTRIBUTES) {
      const attrPattern = new RegExp(
        `\\s*${attr}\\s*=\\s*["'][^"']*["']`,
        'gi',
      );
      result = result.replace(attrPattern, '');
    }

    // Remove event handlers
    const eventPattern = /\s*on\w+\s*=\s*["'][^"']*["']/gi;
    result = result.replace(eventPattern, '');

    return result;
  }

  /**
   * Sanitize object recursively
   */
  sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = this.sanitizeXss(value);
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          typeof item === 'string'
            ? this.sanitizeXss(item)
            : this.sanitizeObject(item as Record<string, unknown>),
        );
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.sanitizeObject(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result as T;
  }

  /**
   * Escape HTML entities
   */
  private escapeHtmlEntities(input: string): string {
    const htmlEntities: Record<string, string> = {
      '&': '&',
      '<': '<',
      '>': '>',
      '"': '"',
      "'": '&#x27;',
      '/': '&#x2F;',
      '`': '&#96;',
    };

    return input.replace(/[&<>"'`/]/g, (char) => htmlEntities[char] || char);
  }

  /**
   * Validate and sanitize string input
   */
  validateAndSanitize(
    input: string,
    options: {
      required?: boolean;
      minLength?: number;
      maxLength?: number;
      pattern?: RegExp;
      allowHtml?: boolean;
    } = {},
  ): { valid: boolean; sanitized?: string; errors: string[] } {
    const errors: string[] = [];
    let sanitized: string | undefined;

    // Check required
    if (options.required && (!input || input.trim() === '')) {
      errors.push('Input is required');
      return { valid: false, errors };
    }

    if (!input) {
      return { valid: true, sanitized: '', errors: [] };
    }

    // Check minimum length
    if (options.minLength && input.length < options.minLength) {
      errors.push(`Input must be at least ${options.minLength} characters`);
    }

    // Check maximum length
    if (options.maxLength && input.length > options.maxLength) {
      errors.push(`Input must be at most ${options.maxLength} characters`);
    }

    // Check pattern
    if (options.pattern && !options.pattern.test(input)) {
      errors.push('Input does not match required pattern');
    }

    // Check for SQL injection
    if (this.detectSqlInjection(input)) {
      errors.push('Potentially harmful SQL pattern detected');
    }

    // Sanitize
    if (options.allowHtml) {
      // Allow some HTML but still sanitize dangerous elements
      sanitized = this.sanitizeXss(input);
    } else {
      sanitized = this.escapeHtmlEntities(input);
    }

    // Check for XSS after sanitization
    if (!options.allowHtml && this.detectXss(sanitized)) {
      errors.push('Potentially harmful content detected');
    }

    return {
      valid: errors.length === 0,
      sanitized,
      errors,
    };
  }

  /**
   * Strip all HTML tags
   */
  stripHtml(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return input.replace(/<[^>]*>/g, '');
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): boolean {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
  }

  /**
   * Validate URL format
   */
  validateUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }
}
