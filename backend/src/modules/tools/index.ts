/**
 * Tools Module - Public API
 *
 * Re-exports all public interfaces, classes, and types for the tools module.
 */

// Interfaces - use export type for type-only exports
export type { ITool, ToolInput, ToolOutput } from './interfaces/tool.interface';
export type {
  IStructuredTool,
  ToolDefinition,
  ToolCategory,
  ToolExecutionContext,
  StructuredToolResult,
} from './interfaces/structured-tool.interface';

// Base classes
export { BaseStructuredTool } from './structured-tool.base';

// Services
export { StructuredToolRegistry } from './structured-tool.registry';
export { ToolsService } from './tools.service';

// Built-in tools
export { CalculatorTool } from './built-in/calculator.tool';
export type {
  CalculatorInput,
  CalculatorOutput,
} from './built-in/calculator-enhanced.tool';
export { CalculatorEnhancedTool } from './built-in/calculator-enhanced.tool';
export { HttpRequestTool } from './built-in/http-request.tool';
export type {
  HttpRequestInput,
  HttpRequestOutput,
} from './built-in/http-request-enhanced.tool';
export { HttpRequestEnhancedTool } from './built-in/http-request-enhanced.tool';
