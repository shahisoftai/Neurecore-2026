/**
 * BaseStructuredTool — Abstract base class for structured tools
 *
 * SRP: Provides common functionality for all tools
 * OCP: Extend to create new tools without modifying existing code
 */

import { Logger } from '@nestjs/common';
import { z } from 'zod';
import type {
  IStructuredTool,
  StructuredToolResult,
  ToolExecutionContext,
} from './interfaces/structured-tool.interface';
import { ToolCategory as TC } from './interfaces/structured-tool.interface';

/**
 * Base class for structured tools with Zod validation
 */
export abstract class BaseStructuredTool implements IStructuredTool {
  protected readonly logger = new Logger(this.constructor.name);

  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly category: TC;
  abstract readonly inputSchema: z.ZodSchema;
  readonly outputSchema?: z.ZodSchema;
  readonly requiredPermissions?: string[];
  readonly version?: string;

  /**
   * Core execution logic - override in subclasses
   */
  protected abstract executeImpl(
    input: z.infer<this['inputSchema']>,
    context: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<unknown>>;

  /**
   * Validate input and execute with error handling
   */
  async execute(
    input: unknown,
    context: Partial<ToolExecutionContext> = {},
  ): Promise<StructuredToolResult<unknown>> {
    const startTime = Date.now();

    // Validate input
    const validation = this.validate(input);
    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid input: ${validation.errors?.join(', ')}`,
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    try {
      const result = await this.executeImpl(
        input as z.infer<this['inputSchema']>,
        context,
      );
      return {
        ...result,
        metadata: {
          ...result.metadata,
          durationMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      this.logger.error(`Tool ${this.name} execution failed`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: { durationMs: Date.now() - startTime },
      };
    }
  }

  /**
   * Validate input against schema
   */
  validate(input: unknown): { valid: boolean; errors?: string[] } {
    try {
      this.inputSchema.parse(input);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        };
      }
      return { valid: false, errors: [String(error)] };
    }
  }

  /**
   * Generate OpenAI function calling format
   */
  toFunctionCall(): {
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: {
        type: 'object';
        properties: Record<string, unknown>;
        required: string[];
      };
    };
  } {
    // Extract properties from the input schema for OpenAI function calling
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    // For ZodObject schemas, we can extract shape
    if (this.inputSchema instanceof z.ZodObject) {
      const shape: Record<string, z.ZodTypeAny> = (
        this.inputSchema as z.ZodObject<any>
      ).shape;
      for (const [key, value] of Object.entries(shape)) {
        const fieldType = this.getFieldType(value);
        properties[key] = fieldType;
        if (!this.isOptional(value)) {
          required.push(key);
        }
      }
    } else {
      // Fallback: treat as having unknown properties
      // In practice, tools should use ZodObject for their input schema
      properties['input'] = { type: 'string', description: 'Tool input' };
    }

    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: {
          type: 'object',
          properties,
          required,
        },
      },
    };
  }

  /**
   * Helper to determine field type for OpenAI function calling
   */
  private getFieldType(value: z.ZodTypeAny): Record<string, unknown> {
    if (value instanceof z.ZodString) {
      return {
        type: 'string',
        description: value.description || '',
      };
    }
    if (value instanceof z.ZodNumber) {
      return {
        type: 'number',
        description: value.description || '',
      };
    }
    if (value instanceof z.ZodBoolean) {
      return {
        type: 'boolean',
        description: value.description || '',
      };
    }
    if (value instanceof z.ZodArray) {
      return {
        type: 'array',
        items: { type: 'string' },
        description: value.description || '',
      };
    }
    if (value instanceof z.ZodObject) {
      return {
        type: 'object',
        properties: {},
        description: value.description || '',
      };
    }
    return { type: 'string' };
  }

  /**
   * Check if a Zod field is optional
   */
  private isOptional(value: z.ZodTypeAny): boolean {
    if (value instanceof z.ZodOptional) return true;
    if (value instanceof z.ZodDefault) return true;
    return false;
  }

  /**
   * Get tool definition for registration
   */
  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      category: this.category,
      parameters: this.inputSchema,
      requiredPermissions: this.requiredPermissions,
      version: this.version,
    };
  }
}
