import type { HermesAgentType } from '@prisma/client';
import type { ToolValidationResult } from '../common/hermes.types';

export interface IToolGateway {
  validate(
    toolName: string,
    hermesType: HermesAgentType,
    context: { tenantId: string; userId?: string },
  ): ToolValidationResult;
  getAllowedTools(hermesType: HermesAgentType): string[];
  isAllowed(toolName: string, hermesType: HermesAgentType): boolean;
}

export const TOOL_GATEWAY = Symbol('TOOL_GATEWAY');
