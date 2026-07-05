import { Injectable, Logger } from '@nestjs/common';
import type { HermesAgentType } from '@prisma/client';
import type { IToolGateway } from '../interfaces/tool-gateway.interface';
import type { ToolValidationResult } from '../common/hermes.types';
import { getHermesToolSet } from '../../tools/built-in/hermes-tools';
import { StructuredToolRegistry } from '../../tools/structured-tool.registry';

@Injectable()
export class ToolGatewayService implements IToolGateway {
  private readonly logger = new Logger(ToolGatewayService.name);

  constructor(private readonly toolRegistry: StructuredToolRegistry) {}

  validate(
    toolName: string,
    hermesType: HermesAgentType,
    _context: { tenantId: string; userId?: string },
  ): ToolValidationResult {
    const toolSet = getHermesToolSet(hermesType);
    const descriptor = toolSet.find((t) => t.name === toolName);

    if (!descriptor) {
      const toolExists = !!this.toolRegistry.get(toolName);
      if (!toolExists) {
        return {
          allowed: false,
          requiresApproval: false,
          reason: `Tool "${toolName}" not found in registry`,
        };
      }
      return { allowed: true, requiresApproval: false };
    }

    if (descriptor.permission === 'DENY') {
      return {
        allowed: false,
        requiresApproval: false,
        reason: `Tool "${toolName}" is DENIED for Hermes type ${hermesType}`,
      };
    }

    if (descriptor.permission === 'APPROVAL_REQUIRED') {
      return {
        allowed: true,
        requiresApproval: true,
        reason: `Tool "${toolName}" requires approval for Hermes type ${hermesType}`,
      };
    }

    return { allowed: true, requiresApproval: false };
  }

  getAllowedTools(hermesType: HermesAgentType): string[] {
    return getHermesToolSet(hermesType)
      .filter((t) => t.permission !== 'DENY')
      .map((t) => t.name);
  }

  isAllowed(toolName: string, hermesType: HermesAgentType): boolean {
    const result = this.validate(toolName, hermesType, { tenantId: '' });
    return result.allowed;
  }
}
