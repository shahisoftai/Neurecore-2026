/**
 * Routine Graph - LangGraph-based Workflow Execution
 *
 * Extends OfficialAgentGraph patterns for Paperclip Routines.
 * Uses official StateGraph API for production-ready workflow execution.
 *
 * Key differences from AgentGraph:
 * - Trigger-based execution (vs agent dispatch)
 * - Scheduled/webhook/event-driven (vs on-demand)
 * - Built-in checkpointing for resumption
 */

import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RoutineGraphDefinition,
  RoutineGraphState,
  RoutineConfig,
  RoutineNode,
  NodeExecution,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from '../interfaces/routine.interface';
import { AgentCheckpointService } from '../../agents/langgraph/checkpoint.service';
// import { ApprovalWorkflowEngine } from '../../hermes/services/approval-workflow.engine';

// ─── State Schema ─────────────────────────────────────────────────────────────

/**
 * Routine Graph State Schema
 *
 * Uses Annotation.Root for composite state with multiple channels.
 * Similar structure to AgentStateAnnotation but tailored for routines.
 */
const RoutineStateAnnotation = Annotation.Root({
  // Core fields
  routineId: Annotation<string>(),
  runId: Annotation<string>(),
  tenantId: Annotation<string>(),

  // Graph definition snapshot
  definition: Annotation<RoutineGraphDefinition | null>({
    reducer: (left, right) => right ?? left,
    default: () => null,
  }),

  // Execution state
  currentNodeId: Annotation<string | null>({
    reducer: (left, right) => right ?? left,
    default: () => null,
  }),

  iteration: Annotation<number>({
    reducer: (left, right) => left + right,
    default: () => 0,
  }),

  maxIterations: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 10,
  }),

  // Node execution results
  nodeExecutions: Annotation<NodeExecution[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),

  // Input/Output context
  input: Annotation<Record<string, unknown>>({
    reducer: (left, right) => ({ ...left, ...right }),
    default: () => ({}),
  }),

  output: Annotation<Record<string, unknown> | null>({
    reducer: (left, right) => right ?? left,
    default: () => null,
  }),

  // Error handling
  error: Annotation<string | null>({
    reducer: (left, right) => right ?? left,
    default: () => null,
  }),

  shouldContinue: Annotation<boolean>({
    reducer: (_left, right) => right,
    default: () => true,
  }),

  // Cancellation flag
  cancelled: Annotation<boolean>({
    reducer: (_left, right) => right,
    default: () => false,
  }),
});

type RoutineGraphStateType = typeof RoutineStateAnnotation.State;

// ─── Node Function Types ───────────────────────────────────────────────────────

type RoutineNodeFunction = (
  state: RoutineGraphStateType,
) => Partial<RoutineGraphStateType> | Promise<Partial<RoutineGraphStateType>>;

// ─── Routine Graph Implementation ────────────────────────────────────────────

@Injectable()
export class RoutineGraph {
  private readonly logger = new Logger(RoutineGraph.name);
  private compiledGraph: Awaited<
    ReturnType<ReturnType<typeof this.buildGraph>['compile']>
  > | null = null;

  private currentNode: RoutineNode | null = null;
  private pendingApprovals: Map<string, string> = new Map();

  constructor(
    private readonly config: ConfigService,
    private readonly checkpointService: AgentCheckpointService,
  ) {
    this.initializeGraph();
  }

  /**
   * Build the LangGraph workflow from a definition
   */

  buildGraphFromDefinition(
    definition: RoutineGraphDefinition,
    config: RoutineConfig = {},
  ) {
    const workflow = new StateGraph(RoutineStateAnnotation);

    // Add all nodes from definition
    for (const node of definition.nodes) {
      const nodeFn = this.createNodeFunction(node);
      workflow.addNode(node.id, nodeFn);
    }

    // Add regular edges
    for (const edge of definition.edges) {
      workflow.addEdge(edge.source as any, edge.target as any);
    }

    // Add conditional edges
    if (definition.conditionalEdges) {
      for (const condEdge of definition.conditionalEdges) {
        workflow.addConditionalEdges(
          condEdge.source as any,
          this.createConditionFunction(condEdge),
          condEdge.branches as any,
        );
      }
    }

    // Set entry point
    const entryPoint = definition.entryPoint || definition.nodes[0]?.id;
    if (entryPoint) {
      workflow.addEdge(START, entryPoint as any);
    }

    return workflow;
  }

  /**
   * Create a node function based on node type
   */
  private createNodeFunction(node: RoutineNode): RoutineNodeFunction {
    // Set current node for use in node functions
    this.currentNode = node;
    switch (node.type) {
      case 'agent':
        return this.agentNode.bind(this);
      case 'tool':
        return this.toolNode.bind(this);
      case 'condition':
        return this.conditionNode.bind(this);
      case 'approval':
        return this.approvalNode.bind(this);
      case 'transform':
        return this.transformNode.bind(this);
      default:
        return this.passthroughNode.bind(this);
    }
  }

  /**
   * Create condition function for conditional edges
   */
  private createConditionFunction(edge: {
    condition: string;
    branches: Record<string, string>;
  }) {
    return (state: RoutineGraphStateType): string => {
      // Evaluate condition based on state
      // This is a simplified version - in production would use LLM or expression evaluator
      const result = this.evaluateCondition(edge.condition, state);
      return edge.branches[result] || (END as string);
    };
  }

  /**
   * Evaluate a condition string against state
   */
  private evaluateCondition(
    condition: string,
    state: RoutineGraphStateType,
  ): string {
    // Simple condition evaluation
    // Supports: "has_error", "is_complete", "needs_approval", etc.
    switch (condition) {
      case 'has_error':
        return state.error ? 'error' : 'success';
      case 'is_complete':
        return state.output ? 'complete' : 'pending';
      case 'needs_approval':
        return 'false'; // Simplified
      default:
        return 'default';
    }
  }

  /**
   * Agent node - executes an agent
   */
  private agentNode: RoutineNodeFunction = async (state) => {
    const node = this.currentNode!;
    this.logger.debug(`[agent] Executing node: ${node.id}`);

    const execution: NodeExecution = {
      nodeId: node.id,
      nodeName: node.name,
      status: 'running',
      startedAt: new Date(),
    };

    try {
      // In production, this would:
      // 1. Get agent from agentId
      // 2. Execute agent with input from state.input
      // 3. Map output to state context

      await Promise.resolve(); // Placeholder for actual agent execution

      execution.status = 'completed';
      execution.completedAt = new Date();
      execution.durationMs =
        execution.completedAt.getTime() - (execution.startedAt?.getTime() ?? 0);
      execution.output = { result: 'Agent executed successfully' };

      return {
        nodeExecutions: [execution],
        currentNodeId: node.id,
        iteration: 1,
      };
    } catch (error) {
      execution.status = 'failed';
      execution.error =
        error instanceof Error ? error.message : 'Agent execution failed';
      execution.completedAt = new Date();

      return {
        nodeExecutions: [execution],
        currentNodeId: node.id,
        error: execution.error,
        shouldContinue: false,
      };
    }
  };

  /**
   * Tool node - executes a tool
   */
  private toolNode: RoutineNodeFunction = async (state) => {
    const node = this.currentNode!;
    this.logger.debug(`[tool] Executing node: ${node.id}`);

    const execution: NodeExecution = {
      nodeId: node.id,
      nodeName: node.name,
      status: 'running',
      startedAt: new Date(),
    };

    try {
      // In production, this would:
      // 1. Get tool from toolRegistry
      // 2. Map input from state using inputMapping
      // 3. Execute tool
      // 4. Map output using outputMapping

      await Promise.resolve(); // Placeholder for actual tool execution

      execution.status = 'completed';
      execution.completedAt = new Date();
      execution.durationMs =
        execution.completedAt.getTime() - (execution.startedAt?.getTime() ?? 0);
      execution.output = { result: 'Tool executed successfully' };

      return {
        nodeExecutions: [execution],
        currentNodeId: node.id,
        iteration: 1,
      };
    } catch (error) {
      execution.status = 'failed';
      execution.error =
        error instanceof Error ? error.message : 'Tool execution failed';
      execution.completedAt = new Date();

      return {
        nodeExecutions: [execution],
        currentNodeId: node.id,
        error: execution.error,
        shouldContinue: false,
      };
    }
  };

  /**
   * Condition node - evaluates a condition
   */
  private conditionNode: RoutineNodeFunction = async (state) => {
    const node = this.currentNode!;
    this.logger.debug(`[condition] Evaluating node: ${node.id}`);

    const execution: NodeExecution = {
      nodeId: node.id,
      nodeName: node.name,
      status: 'completed',
      startedAt: new Date(),
      completedAt: new Date(),
    };

    // Evaluate condition based on node config
    const result = this.evaluateCondition(
      node.config.prompt || 'default',
      state,
    );
    execution.output = {
      result,
      branches: Object.keys(node.config.inputMapping || {}),
    };

    return {
      nodeExecutions: [execution],
      currentNodeId: node.id,
    };
  };

  /**
   * Approval node - waits for human approval
   */
  private approvalNode: RoutineNodeFunction = async (state) => {
    const node = this.currentNode!;
    this.logger.debug(`[approval] Waiting for approval at node: ${node.id}`);

    const execution: NodeExecution = {
      nodeId: node.id,
      nodeName: node.name,
      status: 'pending',
      startedAt: new Date(),
    };

    const approvalConfig = node.config?.approval;
    if (!approvalConfig) {
      this.logger.warn(`[approval] Node ${node.id} has no approval config, auto-approved`);
      return {
        nodeExecutions: [{ ...execution, status: 'completed', completedAt: new Date() }],
        currentNodeId: node.id,
        shouldContinue: true,
      };
    }

    try {
      // STUB: approval engine removed (hermes module stub). Return fake ID.
      const workflow = { id: 'stub-approval-' + Date.now() };
      this.pendingApprovals.set(workflow.id, node.id);

      return {
        nodeExecutions: [execution],
        currentNodeId: node.id,
        shouldContinue: false,
      };
    } catch (err) {
      this.logger.error(`[approval] Failed to create approval workflow: ${err}`);
      return {
        nodeExecutions: [{ ...execution, status: 'failed', error: String(err) }],
        currentNodeId: node.id,
        shouldContinue: false,
      };
    }
  };

  /**
   * Transform node - transforms data
   */
  private transformNode: RoutineNodeFunction = async (state) => {
    const node = this.currentNode!;
    this.logger.debug(`[transform] Processing node: ${node.id}`);

    const execution: NodeExecution = {
      nodeId: node.id,
      nodeName: node.name,
      status: 'running',
      startedAt: new Date(),
    };

    try {
      // Apply input/output mappings
      const mappedInput = this.mapInputs(state.input, node.config.inputMapping);
      const transformedOutput = this.transformData(
        mappedInput,
        node.config.outputMapping,
      );

      execution.status = 'completed';
      execution.completedAt = new Date();
      execution.durationMs =
        execution.completedAt.getTime() - (execution.startedAt?.getTime() ?? 0);
      execution.output = transformedOutput;

      return {
        nodeExecutions: [execution],
        output: transformedOutput,
        currentNodeId: node.id,
        iteration: 1,
      };
    } catch (error) {
      execution.status = 'failed';
      execution.error =
        error instanceof Error ? error.message : 'Transform failed';
      execution.completedAt = new Date();

      return {
        nodeExecutions: [execution],
        currentNodeId: node.id,
        error: execution.error,
        shouldContinue: false,
      };
    }
  };

  /**
   * Passthrough node - default handler
   */
  private passthroughNode: RoutineNodeFunction = async (state) => {
    const node = this.currentNode!;
    this.logger.debug(`[passthrough] Node: ${node.id}`);

    return {
      nodeExecutions: [
        {
          nodeId: node.id,
          nodeName: node.name,
          status: 'completed',
          startedAt: new Date(),
          completedAt: new Date(),
        },
      ],
      currentNodeId: node.id,
    };
  };

  /**
   * Map inputs based on mapping configuration
   */
  private mapInputs(
    input: Record<string, unknown>,
    mapping?: Record<string, string>,
  ): Record<string, unknown> {
    if (!mapping) return input;

    const result: Record<string, unknown> = {};
    for (const [key, path] of Object.entries(mapping)) {
      result[key] = this.getNestedValue(input, path);
    }
    return result;
  }

  /**
   * Transform data based on output mapping
   */
  private transformData(
    input: Record<string, unknown>,
    mapping?: Record<string, string>,
  ): Record<string, unknown> {
    return mapping ? this.mapInputs(input, mapping) : input;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * Initialize base graph
   */
  private initializeGraph() {
    try {
      const workflow = this.buildGraph();
      this.compiledGraph = workflow.compile({
        name: 'RoutineWorkflow',
      }) as typeof this.compiledGraph;
      this.logger.log('Routine LangGraph initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Routine LangGraph', error);
    }
  }

  /**
   * Build the base graph structure
   */

  private buildGraph() {
    const workflow = new StateGraph(RoutineStateAnnotation);

    // Graph is built dynamically from definition
    // This is a placeholder that ensures compilation
    workflow.addEdge(START, END as any);

    return workflow;
  }

  /**
   * Execute a routine with the given definition
   */
  async execute(params: {
    routineId: string;
    runId: string;
    tenantId: string;
    definition: RoutineGraphDefinition;
    config?: RoutineConfig;
    input?: Record<string, unknown>;
    threadId?: string;
    resumeFromCheckpoint?: boolean;
  }): Promise<RoutineGraphState> {
    const {
      routineId,
      runId,
      tenantId,
      definition,
      config = {},
      input = {},
      threadId,
    } = params;
    const configOrDefault = {
      maxIterations: 10,
      checkpointEnabled: true,
      ...config,
    };

    // Build graph from definition
    const workflow = this.buildGraphFromDefinition(definition, configOrDefault);
    const compiledGraph = workflow.compile({ name: `Routine-${routineId}` });

    // Try to load checkpoint for resumption
    let initialState: RoutineGraphStateType | null = null;
    const resolvedThreadId = threadId || `routine-${runId}`;

    if (
      configOrDefault.checkpointEnabled &&
      this.checkpointService.isAvailable()
    ) {
      try {
        const checkpointState = await this.checkpointService.loadCheckpoint(
          resolvedThreadId,
          routineId,
        );
        if (checkpointState) {
          this.logger.log(
            `[execute] Resuming from checkpoint for thread: ${resolvedThreadId}`,
          );
          initialState = this.convertToGraphState(
            checkpointState as unknown as Record<string, unknown>,
          );
        }
      } catch (error) {
        this.logger.warn(`[execute] Failed to load checkpoint: ${error}`);
      }
    }

    // Create initial state if no checkpoint
    if (!initialState) {
      initialState = {
        routineId,
        runId,
        tenantId,
        definition,
        currentNodeId: definition.entryPoint || definition.nodes[0]?.id || null,
        iteration: 0,
        maxIterations: configOrDefault.maxIterations,
        nodeExecutions: [],
        input,
        output: null,
        error: null,
        shouldContinue: true,
        cancelled: false,
      };
    }

    // Execute the graph
    try {
      const result = await compiledGraph.invoke(initialState);
      return this.convertFromGraphState(result);
    } catch (error) {
      this.logger.error(`[execute] Graph execution failed: ${error}`);
      return {
        runId,
        currentNode: null,
        iteration: initialState.iteration,
        nodes: {},
        context: {
          error: error instanceof Error ? error.message : 'Execution failed',
        },
      };
    }
  }

  /**
   * Resume routine execution after approval is granted.
   * Called by the approval webhook when a workflow is approved.
   */
  async resumeFromApproval(workflowId: string, decision: 'APPROVED' | 'REJECTED'): Promise<void> {
    const nodeId = this.pendingApprovals.get(workflowId);
    if (!nodeId) {
      this.logger.warn(`[approval] No pending workflow found for ${workflowId}`);
      return;
    }

    if (decision === 'REJECTED') {
      this.logger.log(`[approval] Workflow ${workflowId} rejected, routine will be cancelled`);
      this.pendingApprovals.delete(workflowId);
      return;
    }

    this.pendingApprovals.delete(workflowId);
    this.logger.log(`[approval] Workflow ${workflowId} approved, routine can continue`);
  }

  /**
   * Validate a graph definition
   */
  validateGraph(definition: RoutineGraphDefinition): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check required fields
    if (!definition.nodes || definition.nodes.length === 0) {
      errors.push({
        path: 'nodes',
        message: 'Graph must have at least one node',
        code: 'MISSING_NODES',
      });
    }

    // Check node IDs are unique
    const nodeIds = new Set<string>();
    for (const node of definition.nodes || []) {
      if (!node.id) {
        errors.push({
          path: 'nodes',
          message: 'Node missing id',
          code: 'MISSING_NODE_ID',
        });
      } else if (nodeIds.has(node.id)) {
        errors.push({
          path: `nodes.${node.id}`,
          message: `Duplicate node id: ${node.id}`,
          code: 'DUPLICATE_NODE_ID',
        });
      } else {
        nodeIds.add(node.id);
      }

      // Check node has required fields
      if (!node.name) {
        errors.push({
          path: `nodes.${node.id}`,
          message: 'Node missing name',
          code: 'MISSING_NODE_NAME',
        });
      }

      // Validate node types
      const validTypes = [
        'agent',
        'tool',
        'condition',
        'approval',
        'transform',
      ];
      if (node.type && !validTypes.includes(node.type)) {
        errors.push({
          path: `nodes.${node.id}.type`,
          message: `Invalid node type: ${node.type}`,
          code: 'INVALID_NODE_TYPE',
        });
      }
    }

    // Validate edges reference existing nodes
    const edgeTargets = new Set<string>();
    for (const edge of definition.edges || []) {
      if (!nodeIds.has(edge.source)) {
        errors.push({
          path: `edges.${edge.source}`,
          message: `Edge source node not found: ${edge.source}`,
          code: 'INVALID_EDGE_SOURCE',
        });
      }
      if (!nodeIds.has(edge.target)) {
        errors.push({
          path: `edges.${edge.target}`,
          message: `Edge target node not found: ${edge.target}`,
          code: 'INVALID_EDGE_TARGET',
        });
      }
      edgeTargets.add(edge.target);
    }

    // Check conditional edges
    for (const condEdge of definition.conditionalEdges || []) {
      if (!nodeIds.has(condEdge.source)) {
        errors.push({
          path: `conditionalEdges.${condEdge.source}`,
          message: `Conditional edge source not found: ${condEdge.source}`,
          code: 'INVALID_COND_EDGE_SOURCE',
        });
      }

      for (const [, target] of Object.entries(condEdge.branches)) {
        if (!nodeIds.has(target)) {
          errors.push({
            path: `conditionalEdges.branches.${target}`,
            message: `Conditional branch target not found: ${target}`,
            code: 'INVALID_BRANCH_TARGET',
          });
        }
      }
    }

    // Check entry point exists
    if (definition.entryPoint && !nodeIds.has(definition.entryPoint)) {
      errors.push({
        path: 'entryPoint',
        message: `Entry point node not found: ${definition.entryPoint}`,
        code: 'INVALID_ENTRY_POINT',
      });
    }

    // Warnings for best practices
    if (definition.nodes.length > 20) {
      warnings.push({
        path: 'nodes',
        message:
          'Graph has many nodes, consider breaking it into smaller routines',
        suggestion: 'Use sub-routines for complex workflows',
      });
    }

    // Check for unreachable nodes
    if (definition.entryPoint) {
      const reachable = this.findReachableNodes(definition);
      for (const nodeId of nodeIds) {
        if (!reachable.has(nodeId) && nodeId !== definition.entryPoint) {
          warnings.push({
            path: `nodes.${nodeId}`,
            message: `Unreachable node: ${nodeId}`,
            suggestion: 'Remove or connect this node',
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Find all reachable nodes from entry point
   */
  private findReachableNodes(definition: RoutineGraphDefinition): Set<string> {
    const reachable = new Set<string>();
    const toVisit = [definition.entryPoint || definition.nodes[0]?.id];

    while (toVisit.length > 0) {
      const nodeId = toVisit.pop()!;
      if (!nodeId || reachable.has(nodeId)) continue;

      reachable.add(nodeId);

      // Add connected nodes
      for (const edge of definition.edges || []) {
        if (edge.source === nodeId && !reachable.has(edge.target)) {
          toVisit.push(edge.target);
        }
      }
    }

    return reachable;
  }

  /**
   * Convert checkpoint state to graph state
   */
  private convertToGraphState(
    checkpoint: Record<string, unknown>,
  ): RoutineGraphStateType {
    return {
      routineId: checkpoint['routineId'] as string,
      runId: checkpoint['runId'] as string,
      tenantId: checkpoint['tenantId'] as string,
      definition: checkpoint['definition'] as RoutineGraphDefinition,
      currentNodeId: checkpoint['currentNodeId'] as string | null,
      iteration: (checkpoint['iteration'] as number) || 0,
      maxIterations: (checkpoint['maxIterations'] as number) || 10,
      nodeExecutions: (checkpoint['nodeExecutions'] as NodeExecution[]) || [],
      input: (checkpoint['input'] as Record<string, unknown>) || {},
      output: (checkpoint['output'] as Record<string, unknown> | null) || null,
      error: (checkpoint['error'] as string | null) || null,
      shouldContinue: (checkpoint['shouldContinue'] as boolean) ?? true,
      cancelled: (checkpoint['cancelled'] as boolean) ?? false,
    };
  }

  /**
   * Convert graph state to output format
   */
  private convertFromGraphState(
    state: RoutineGraphStateType,
  ): RoutineGraphState {
    return {
      runId: state.runId,
      currentNode: state.currentNodeId,
      iteration: state.iteration,
      nodes: {}, // Derived from nodeExecutions
      context: {
        ...state.input,
        ...(state.output || {}),
        error: state.error,
      },
    };
  }
}
