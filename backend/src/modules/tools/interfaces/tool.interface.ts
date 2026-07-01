export interface ToolInput {
  [key: string]: unknown;
}

export interface ToolOutput {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * ITool — base interface for every tool implementation (OCP / DIP).
 * Adding new tools never requires modifying ToolsService.
 */
export interface ITool {
  readonly name: string;
  readonly description: string;
  readonly category: string;
  execute(input: ToolInput): Promise<ToolOutput>;
  validate(input: ToolInput): boolean;
}

export const TOOL_TOKEN = 'REGISTERED_TOOLS'; // injection token for array
