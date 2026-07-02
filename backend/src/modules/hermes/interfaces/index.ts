export * from './hermes-session.interface';
export * from './hermes-context.interface';
export * from './hermes-runtime.interface';
export * from './hermes-memory.interface';
export * from './hermes-event-bus.interface';
export * from './tool-gateway.interface';
export * from './permission-matrix.interface';
export * from './approval-workflow.interface';

// Re-export from hermes-agent.interface
export type {
  HermesAgentDescriptor,
  HermesCapabilityDescriptor,
  HermesToolPermissionDescriptor,
  CreateHermesAgentInput,
  UpdateHermesAgentInput,
} from './hermes-agent.interface';

// Re-export from hermes-registry.interface
export type {
  IHermesRegistry,
  HermesAgentHealth,
  PaginatedResult,
  FindAllOpts,
  CreateCapabilityInput,
  ToolPermissionInput,
} from './hermes-registry.interface';
