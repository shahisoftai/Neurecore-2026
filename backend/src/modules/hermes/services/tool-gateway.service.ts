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
      // FAIL-CLOSED: a tool not declared in the Hermes-type descriptor is
      // NOT allowed by default. Adding a new tool to the global registry
      // must not silently grant every Hermes type access. The fix in
      // memory-bank-new/plans/comprehensive-remediation-plan-2026-07-20.md
      // §4.3 (Critical 10).
      this.logger.warn(
        `Tool "${toolName}" is registered globally but has no descriptor for Hermes type ${hermesType}; denying by default`,
      );
      return {
        allowed: false,
        requiresApproval: false,
        reason: `Tool "${toolName}" is not declared for Hermes type ${hermesType}`,
      };
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
