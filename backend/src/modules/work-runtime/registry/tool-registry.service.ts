/**
 * ToolRegistry — the runtime's registered tool catalog (ADR-004).
 * Unknown tools are rejected. The planner may only select tools returned by the
 * actor's authorized view. Final execution permission is decided by the runtime
 * + governance, not by the planner.
 */

import { Injectable, Logger } from '@nestjs/common';
import type {
  IToolRegistry,
  RuntimeTool,
  ToolMetadata,
} from '../contracts/work-runtime.interface';

@Injectable()
export class ToolRegistry implements IToolRegistry {
  private readonly logger = new Logger(ToolRegistry.name);
  private readonly tools = new Map<string, RuntimeTool>();

  register(tool: RuntimeTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Duplicate tool identifier: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
    this.logger.log(
      `Registered tool "${tool.name}" (${tool.capability}, ${tool.effect}, auth>=${tool.requiredAuthority}${tool.approvalSensitive ? ', approval-sensitive' : ''})`,
    );
  }

  get(name: string): RuntimeTool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): ToolMetadata[] {
    return [...this.tools.values()].map((t) => this.meta(t));
  }

  listForAuthority(authority: number): ToolMetadata[] {
    return [...this.tools.values()]
      .filter((t) => authority >= t.requiredAuthority)
      .map((t) => this.meta(t));
  }

  private meta(t: RuntimeTool): ToolMetadata {
    return {
      name: t.name,
      capability: t.capability,
      description: t.description,
      effect: t.effect,
      requiredAuthority: t.requiredAuthority,
      approvalSensitive: t.approvalSensitive,
    };
  }
}
