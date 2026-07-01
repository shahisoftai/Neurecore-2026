/**
 * Command Pattern Validator
 *
 * SOLID: Single Responsibility — ONLY validates shell command patterns
 * SOLID: Open/Closed — Add new patterns via configuration
 * SOLID: Dependency Inversion — Uses interface, implementation swappable
 *
 * @module agents/security/validators
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  ICommandPatternValidator,
  ICommandValidationResult,
} from '../interfaces/security.interfaces';

/**
 * Shell tools that require command validation
 */
const SHELL_TOOLS = [
  'bash',
  'shell',
  'exec',
  'run_command',
  'run_shell',
  'execute_command',
  'system_command',
];

/**
 * Dangerous patterns that should NEVER be allowed in shell commands
 */
interface DangerousPattern {
  pattern: RegExp;
  description: string;
}

@Injectable()
export class CommandPatternValidator implements ICommandPatternValidator {
  private readonly logger = new Logger(CommandPatternValidator.name);

  /**
   * Dangerous command patterns that are always blocked
   * Order matters: more specific patterns should come first
   */
  private readonly DANGEROUS_PATTERNS: DangerousPattern[] = [
    // Data destruction
    { pattern: /rm\s+-rf\s+\//, description: 'Recursive root deletion' },
    {
      pattern: /rm\s+-rf\s+\*$/,
      description: 'Recursive deletion in current dir',
    },
    { pattern: /dd\s+if=.*of=\/dev\//, description: 'Direct disk write' },
    { pattern: /mkfs\./, description: 'Filesystem creation (destructive)' },
    { pattern: /wipefs?/, description: 'Filesystem wipe' },
    { pattern: /shred\s+-zu/, description: 'Secure file deletion' },

    // Privilege escalation
    { pattern: /sudo\s+su/, description: 'Sudo to root shell' },
    { pattern: /:\s*\(;:\s*\)/, description: 'Fork bomb' },
    {
      pattern: /\(\)\s*\{\s*:\|:\s*&\s*\};/,
      description: 'Fork bomb variant',
    },

    // Network attacks
    { pattern: /nc\s+-e\s+\//, description: 'Netcat reverse shell' },
    { pattern: /nc\s+-l\s+-p/, description: 'Netcat listener' },
    {
      pattern: /curl\s+http:\/\//,
      description: 'HTTP request (potential SSRF)',
    },
    { pattern: /wget\s+http:\/\//, description: 'Download from HTTP' },
    { pattern: /telnet\s+/, description: 'Telnet connection' },

    // Credential theft
    { pattern: /cat\s+\/etc\/passwd/, description: 'Read passwd file' },
    { pattern: /cat\s+\/etc\/shadow/, description: 'Read shadow file' },
    {
      pattern: /\.ssh\/authorized_keys/,
      description: 'SSH authorized keys access',
    },
    { pattern: /id_rsa/, description: 'SSH private key access' },
    { pattern: /\.netrc/, description: 'Netrc credential storage' },

    // System modification
    { pattern: /chmod\s+[47]777/, description: 'World-writable permissions' },
    { pattern: /chmod\s+u\+s/, description: 'SetUID bit modification' },
    { pattern: /ln\s+-s\s+\//, description: 'Symbolic link to root' },
    { pattern: />\s*\/etc\//, description: 'Write to system directory' },
    {
      pattern: /2>\s*\/etc\//,
      description: 'Redirect stderr to system directory',
    },

    // Process manipulation
    { pattern: /kill\s+-9\s+1/, description: 'Kill init process' },
    { pattern: /killall\s+-9/, description: 'Kill all processes' },
    { pattern: /pkill\s+-9/, description: 'Pattern kill processes' },

    // Environment manipulation
    { pattern: /export\s+PATH=/, description: 'PATH environment modification' },
    { pattern: /LD_PRELOAD=/, description: 'LD_PRELOAD injection' },
    { pattern: /unset\s+PATH/, description: 'PATH removal' },

    // File download/execution
    {
      pattern: /curl\s+.*\|\s*sh/,
      description: 'Pipe to shell (coin miner pattern)',
    },
    { pattern: /wget\s+.*\|\s*sh/, description: 'Wget pipe to shell' },
    {
      pattern: /python\s+-m\s+http\.server/,
      description: 'Python HTTP server',
    },
    { pattern: /ruby\s+-rsocket/, description: 'Ruby socket creation' },

    // Database destruction
    { pattern: /DROP\s+TABLE/i, description: 'SQL DROP TABLE' },
    { pattern: /DROP\s+DATABASE/i, description: 'SQL DROP DATABASE' },
    { pattern: /DELETE\s+FROM\s+\w+\s*;/i, description: 'SQL DELETE all' },
    { pattern: /TRUNCATE\s+TABLE/i, description: 'SQL TRUNCATE' },

    // Archive extraction to sensitive locations
    {
      pattern: /tar\s+.*-C\s+\/(etc|var|usr)/,
      description: 'Extract archive to system dir',
    },
    {
      pattern: /unzip.*-d\s+\/(etc|var|usr)/,
      description: 'Unzip to system dir',
    },
  ];

  /**
   * Patterns that require additional review (not outright blocked)
   */
  private readonly SUSPICIOUS_PATTERNS: DangerousPattern[] = [
    { pattern: /curl\s+/, description: 'HTTP request' },
    { pattern: /wget\s+/, description: 'Download utility' },
    { pattern: /git\s+clone/, description: 'Git clone' },
    { pattern: /apt(-get)?\s+install/, description: 'Package installation' },
    { pattern: /npm\s+install/, description: 'NPM package installation' },
    { pattern: /pip\s+install/, description: 'Python package installation' },
    { pattern: /docker\s+run/, description: 'Docker container run' },
    { pattern: /kubectl\s+/, description: 'Kubernetes command' },
    { pattern: /helm\s+/, description: 'Helm chart operation' },
  ];

  /**
   * Check if a tool requires command validation
   */
  isShellTool(toolName: string): boolean {
    return SHELL_TOOLS.includes(toolName.toLowerCase());
  }

  /**
   * Validate a shell command against patterns
   */
  validate(command: string): ICommandValidationResult {
    if (!command || typeof command !== 'string') {
      return {
        allowed: false,
        reason: 'Invalid command: empty or non-string',
        blockedPattern: 'empty_input',
      };
    }

    const trimmedCommand = command.trim();

    if (trimmedCommand.length === 0) {
      return {
        allowed: false,
        reason: 'Invalid command: empty after trim',
        blockedPattern: 'empty_input',
      };
    }

    // Check length limit (prevent buffer overflow attempts)
    if (trimmedCommand.length > 10000) {
      return {
        allowed: false,
        reason: 'Command exceeds maximum length (10000 characters)',
        blockedPattern: 'excessive_length',
      };
    }

    // Check for dangerous patterns first (immediate block)
    for (const { pattern, description } of this.DANGEROUS_PATTERNS) {
      if (pattern.test(trimmedCommand)) {
        this.logger.warn(
          `Dangerous command pattern blocked: ${description} - ${pattern.source}`,
        );
        return {
          allowed: false,
          reason: `Command blocked: ${description}`,
          blockedPattern: description,
        };
      }
    }

    // Log suspicious patterns for monitoring (but allow)
    for (const { pattern, description } of this.SUSPICIOUS_PATTERNS) {
      if (pattern.test(trimmedCommand)) {
        this.logger.debug(
          `Suspicious command pattern detected: ${description}`,
        );
        // Could return with warning, but currently allowing
        // Future: return { allowed: true, reason: `Warning: ${description}` }
      }
    }

    // Check for command chaining that might be dangerous
    if (this.containsDangerousChaining(trimmedCommand)) {
      return {
        allowed: false,
        reason: 'Command chaining pattern not allowed',
        blockedPattern: 'dangerous_chaining',
      };
    }

    return {
      allowed: true,
      reason: 'Command passed validation',
    };
  }

  /**
   * Check for dangerous command chaining patterns
   */
  private containsDangerousChaining(command: string): boolean {
    // Multiple commands chained with semicolon when they could be destructive
    const parts = command.split(/[;&|`$]/);

    for (const part of parts) {
      const trimmed = part.trim();
      // If any part is just a dangerous-looking single command
      if (
        trimmed.match(/^rm\s+/) ||
        trimmed.match(/^dd\s+/) ||
        trimmed.match(/^kill\s+/) ||
        trimmed.match(/^>\s*\//)
      ) {
        return true;
      }
    }

    return false;
  }
}
