/**
 * Resource Access Validator
 *
 * SOLID: Single Responsibility — ONLY validates file/path resource access
 * SOLID: Open/Closed — Add new path rules via configuration
 * SOLID: Dependency Inversion — Uses interface, implementation swappable
 *
 * @module agents/security/validators
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  IResourceAccessValidator,
  IResourceValidationResult,
} from '../interfaces/security.interfaces';

/**
 * Path rules for resource validation
 */
interface PathRule {
  pattern: RegExp;
  allowed: boolean;
  description: string;
}

@Injectable()
export class ResourceAccessValidator implements IResourceAccessValidator {
  private readonly logger = new Logger(ResourceAccessValidator.name);

  /**
   * Critical system paths that should NEVER be accessible
   */
  private readonly BLOCKED_PATHS: PathRule[] = [
    {
      pattern: /^\/etc\/passwd$/,
      allowed: false,
      description: 'System passwd file',
    },
    {
      pattern: /^\/etc\/shadow$/,
      allowed: false,
      description: 'System shadow file',
    },
    {
      pattern: /^\/etc\/sudoers$/,
      allowed: false,
      description: 'Sudoers configuration',
    },
    {
      pattern: /^\/root\//,
      allowed: false,
      description: 'Root home directory',
    },
    {
      pattern: /^\/\.ssh\//,
      allowed: false,
      description: 'SSH keys directory',
    },
    { pattern: /^\/\.aws\//, allowed: false, description: 'AWS credentials' },
    {
      pattern: /^\/\.kube\//,
      allowed: false,
      description: 'Kubernetes credentials',
    },
    {
      pattern: /^\/proc\/1\//,
      allowed: false,
      description: 'Init process info',
    },
    { pattern: /^\/sys\//, allowed: false, description: 'System sysfs' },
    { pattern: /^\/boot\//, allowed: false, description: 'Boot directory' },
    {
      pattern: /\/\.\./,
      allowed: false,
      description: 'Directory traversal attempt',
    },
    {
      pattern: /\.\.\//,
      allowed: false,
      description: 'Parent directory traversal',
    },
  ];

  /**
   * Sensitive paths that require explicit allow
   */
  private readonly SENSITIVE_PATHS: PathRule[] = [
    { pattern: /^\/etc\//, allowed: true, description: 'System etc directory' },
    { pattern: /^\/var\/log\//, allowed: true, description: 'Log directory' },
    { pattern: /^\/var\/www\//, allowed: true, description: 'Web root' },
    {
      pattern: /^\/home\//,
      allowed: true,
      description: 'User home directories',
    },
    { pattern: /^\/tmp\//, allowed: true, description: 'Temporary directory' },
    {
      pattern: /^\/workspace\//,
      allowed: true,
      description: 'Workspace directory',
    },
  ];

  /**
   * Default allowed paths (workspace-relative)
   */
  private readonly DEFAULT_ALLOWED_PATHS: string[] = [
    '/workspace',
    '/tmp',
    '/app',
    '/uploads',
    '/data',
  ];

  /**
   * Validate resource access
   */
  validate(
    resource: string,
    context: 'read' | 'write' | 'execute',
  ): IResourceValidationResult {
    if (!resource || typeof resource !== 'string') {
      return {
        allowed: false,
        reason: 'Invalid resource: empty or non-string',
        blockedPath: resource || 'empty',
      };
    }

    const normalizedPath = this.normalizePath(resource);

    if (!normalizedPath) {
      return {
        allowed: false,
        reason: 'Invalid resource path format',
        blockedPath: resource,
      };
    }

    // Check blocked paths first
    for (const rule of this.BLOCKED_PATHS) {
      if (rule.pattern.test(normalizedPath)) {
        this.logger.warn(
          `Blocked path access denied: ${rule.description} - ${normalizedPath}`,
        );
        return {
          allowed: false,
          reason: `Access to ${rule.description} is not permitted`,
          blockedPath: normalizedPath,
        };
      }
    }

    // Check sensitive paths
    for (const rule of this.SENSITIVE_PATHS) {
      if (rule.pattern.test(normalizedPath)) {
        if (!rule.allowed) {
          return {
            allowed: false,
            reason: `Sensitive path ${rule.description} requires explicit allow`,
            blockedPath: normalizedPath,
          };
        }
      }
    }

    // For write operations, check additional restrictions
    if (context === 'write') {
      const writeValidation = this.validateWriteOperation(normalizedPath);
      if (!writeValidation.allowed) {
        return writeValidation;
      }
    }

    // For execute operations, check executable paths
    if (context === 'execute') {
      const executeValidation = this.validateExecuteOperation(normalizedPath);
      if (!executeValidation.allowed) {
        return executeValidation;
      }
    }

    // Check if path is within allowed directories
    if (!this.isPathAllowed(normalizedPath)) {
      return {
        allowed: false,
        reason: `Path is not within allowed directories`,
        blockedPath: normalizedPath,
      };
    }

    return {
      allowed: true,
      reason: 'Resource access permitted',
    };
  }

  /**
   * Normalize a path for consistent comparison
   */
  private normalizePath(path: string): string | null {
    try {
      // Remove duplicate slashes
      let normalized = path.replace(/\/+/g, '/');

      // Remove trailing slash (except for root)
      if (normalized !== '/' && normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
      }

      // Basic validation - no null bytes
      if (normalized.includes('\0')) {
        return null;
      }

      // No absolute paths outside workspace (for security)
      // But allow them for validation - the allowlist will handle it
      return normalized;
    } catch {
      return null;
    }
  }

  /**
   * Validate write operations have proper restrictions
   */
  private validateWriteOperation(path: string): IResourceValidationResult {
    // Check for dangerous file extensions
    const dangerousExtensions = [
      /\.exe$/i,
      /\.sh$/i,
      /\.bash$/i,
      /\.zsh$/i,
      /\.bat$/i,
      /\.cmd$/i,
      /\.ps1$/i,
      /\.dll$/i,
      /\.so$/i,
      /\.dylib$/i,
    ];

    for (const ext of dangerousExtensions) {
      if (ext.test(path)) {
        return {
          allowed: false,
          reason: `Writing executable files (${ext.source}) is not permitted`,
          blockedPath: path,
        };
      }
    }

    // Check for system file writes
    if (
      path.startsWith('/etc/') ||
      path.startsWith('/bin/') ||
      path.startsWith('/sbin/')
    ) {
      return {
        allowed: false,
        reason: 'Writing to system directories is not permitted',
        blockedPath: path,
      };
    }

    return { allowed: true, reason: 'Write operation permitted' };
  }

  /**
   * Validate execute operations
   */
  private validateExecuteOperation(path: string): IResourceValidationResult {
    // Only allow executing from known safe paths
    const allowedExecutablePaths = [
      '/usr/bin',
      '/usr/local/bin',
      '/workspace/bin',
    ];

    const isAllowedPath = allowedExecutablePaths.some(
      (allowedPath) =>
        path === allowedPath || path.startsWith(allowedPath + '/'),
    );

    if (!isAllowedPath) {
      return {
        allowed: false,
        reason:
          'Execute only allowed from /usr/bin, /usr/local/bin, or /workspace/bin',
        blockedPath: path,
      };
    }

    return { allowed: true, reason: 'Execute operation permitted' };
  }

  /**
   * Check if a path is within an allowed directory
   */
  private isPathAllowed(path: string): boolean {
    // Absolute paths must be within DEFAULT_ALLOWED_PATHS
    if (path.startsWith('/')) {
      return this.DEFAULT_ALLOWED_PATHS.some(
        (allowed) => path === allowed || path.startsWith(allowed + '/'),
      );
    }

    // Relative paths are allowed (they'll be resolved relative to workspace)
    return true;
  }
}
