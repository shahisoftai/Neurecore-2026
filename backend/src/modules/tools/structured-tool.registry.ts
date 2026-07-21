/**
 * Structured Tool Registry
 *
 * Registry for managing and discovering structured tools.
 * Provides dependency injection support via NestJS.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  IStructuredTool,
  ToolDefinition,
  ToolCategory,
} from './interfaces/structured-tool.interface';

/**
 * Registry for managing IStructuredTool instances
 */
@Injectable()
export class StructuredToolRegistry {
  private readonly logger = new Logger(StructuredToolRegistry.name);
  private readonly tools: Map<string, IStructuredTool> = new Map();
  private readonly categoryIndex: Map<ToolCategory, Set<string>> = new Map();
  private injectedTools: IStructuredTool[] = [];

  constructor() {}

  setTools(tools: IStructuredTool[]): void {
    this.injectedTools = tools;
    for (const tool of this.injectedTools) {
      if (tool && tool.name) {
        this.register(tool);
      }
    }
    this.logger.log(`Registered ${this.tools.size} tools via setTools()`);
  }

  register(tool: IStructuredTool): void {
    if (this.tools.has(tool.name)) {
      this.logger.warn(`Tool '${tool.name}' is already registered. Overwriting.`);
    }
    this.tools.set(tool.name, tool);
    if (!this.categoryIndex.has(tool.category)) {
      this.categoryIndex.set(tool.category, new Set());
    }
    this.categoryIndex.get(tool.category)!.add(tool.name);
    this.logger.log(`Registered tool: ${tool.name} (${tool.category})`);
  }

  unregister(name: string): boolean {
    const tool = this.tools.get(name);
    if (!tool) return false;
    this.tools.delete(name);
    const categoryTools = this.categoryIndex.get(tool.category);
    if (categoryTools) categoryTools.delete(name);
    this.logger.log(`Unregistered tool: ${name}`);
    return true;
  }

  get(name: string): IStructuredTool | undefined {
    return this.tools.get(name);
  }

  getAll(): IStructuredTool[] {
    return Array.from(this.tools.values());
  }

  getByCategory(category: ToolCategory): IStructuredTool[] {
    const names = this.categoryIndex.get(category);
    if (!names) return [];
    return Array.from(names).map(n => this.tools.get(n)).filter((t): t is IStructuredTool => t !== undefined);
  }

  /**
   * Get function definitions for LLM tool calling.
   *
   * @param allowedNames Optional whitelist. When provided, only tools whose
   *   name is in the set are returned. Used by Hermes runtime to honour
   *   per-type tool policy, and by the graph to enforce the allowedTools
   *   list passed in via state.
   */
  getFunctionDefinitions(allowedNames?: string[] | null): Array<{ type: 'function'; function: { name: string; description: string; parameters: { type: 'object'; properties: Record<string, unknown>; required: string[] } } }> {
    const all = this.getAll();
    if (!allowedNames || allowedNames.length === 0) {
      return all.map(tool => tool.toFunctionCall());
    }
    const allowSet = new Set(allowedNames);
    return all.filter(t => allowSet.has(t.name)).map(tool => tool.toFunctionCall());
  }

  /**
   * Return the names of tools that should be exposed given an allowlist.
   * Empty allowlist means "all registered tools".
   */
  resolveAllowedToolNames(allowedNames?: string[] | null): string[] {
    if (!allowedNames || allowedNames.length === 0) {
      return this.listToolNames();
    }
    const allowSet = new Set(allowedNames);
    return this.listToolNames().filter(n => allowSet.has(n));
  }

  getToolDefinitions(): ToolDefinition[] {
    return this.getAll().map(tool => tool.getDefinition());
  }

  listToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  getCount(): number {
    return this.tools.size;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  async execute<T = unknown>(toolName: string, input: unknown, context?: Partial<{ tenantId: string; userId: string; sessionId: string }>): Promise<T> {
    const tool = this.get(toolName);
    if (!tool) throw new Error(`Tool '${toolName}' not found`);
    const validation = tool.validate(input);
    if (!validation.valid) throw new Error(`Invalid input for tool '${toolName}': ${validation.errors?.join(', ')}`);
    const result = await tool.execute(input as never, context as Parameters<typeof tool.execute>[1]);
    if (!result.success) throw new Error(`Tool '${toolName}' execution failed: ${result.error}`);
    return result.data as T;
  }

  clear(): void {
    this.tools.clear();
    this.categoryIndex.clear();
    this.logger.log('Cleared all registered tools');
  }
}
