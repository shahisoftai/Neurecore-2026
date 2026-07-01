// ─── UI Type System (Admin Portal) ───────────────────────────────────────────
// Mirror of tenant ui.types — no shared code between portals (architecture rule)

export type StatusColor = 'profit' | 'risk' | 'ops' | 'strategy' | 'warn' | 'neutral';
export type ChartTimeRange = '1h' | '24h' | '7d' | '30d' | '90d';

export interface KpiTileProps {
  label: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  color: StatusColor;
  icon?: React.ReactNode;
  loading?: boolean;
  className?: string;
}

export type AgentCardVariant = 'compact' | 'full' | 'inspector';
export type AgentCardAction = 'pause' | 'resume' | 'retrain' | 'audit' | 'inspect' | 'delete' | 'drain';

export interface AgentCardData {
  id: string;
  name: string;
  role?: string;
  type: string;
  status: string;
  workloadPct?: number;
  workload?: number;        // alias for workloadPct
  successRate?: number;
  costToday?: number;
  tasksToday?: number;
  taskCount?: number;
  budgetUsed?: number;
  budgetTotal?: number;
  tenantName?: string;
  lastActiveAt?: string;
  department?: string;
  model?: string;
  updatedAt?: string;
}

export interface AgentCardProps {
  agent: AgentCardData;
  variant?: AgentCardVariant;
  onAction?: (action: AgentCardAction, id: string) => void;
  selected?: boolean;
  className?: string;
}

export interface ChartProps<T = Record<string, unknown>> {
  data: T[];
  loading?: boolean;
  height?: number;
  className?: string;
  timeRange?: ChartTimeRange;
}

export interface TimeSeriesPoint {
  ts: string;
  value: number;
  label?: string;
}

export interface MultiSeriesPoint {
  ts: string;
  [key: string]: number | string;
}

export interface BarDataPoint {
  label: string;
  value: number;
  color?: string;
}

export type InspectorType = 'agent' | 'task' | 'workflow' | 'department' | 'tenant';

export interface InspectorState {
  open: boolean;
  type: InspectorType | null;
  id: string | null;
}

export interface Command {
  id: string;
  label: string;
  group: string;
  shortcut?: string;
  icon?: React.ReactNode;
  action: () => void;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  message: string;
  type: 'agent' | 'task' | 'workflow' | 'system' | 'approval' | 'tenant';
  severity: 'info' | 'success' | 'warn' | 'error';
}

// Platform-level KPIs (admin only)
export interface PlatformKpis {
  totalTenants: number;
  activeTenants: number;
  activeAgents: number;
  totalAgents: number;
  runningAgents: number;
  tasksPerHour: number;
  errorRate: number;
  successRate: number;
  avgLatencyMs: number;
  revenueToday: number;
  costToday: number;
  totalCostUsd: number;
  revenueUsd: number;
}

export const STATUS_COLOR_MAP: Record<string, StatusColor> = {
  RUNNING:    'ops',
  ACTIVE:     'profit',
  COMPLETED:  'profit',
  SUCCESS:    'profit',
  IDLE:       'neutral',
  DRAFT:      'neutral',
  PAUSED:     'warn',
  PENDING:    'warn',
  QUEUED:     'warn',
  FAILED:     'risk',
  ERROR:      'risk',
  CANCELLED:  'neutral',
  SUSPENDED:  'risk',
  TRIAL:      'strategy',
};

export const STATUS_BADGE_CLASS: Record<StatusColor, string> = {
  profit:   'bg-status-profit/15 text-status-profit border border-status-profit/30',
  risk:     'bg-status-risk/15 text-status-risk border border-status-risk/30',
  ops:      'bg-status-ops/15 text-status-ops border border-status-ops/30',
  strategy: 'bg-status-strategy/15 text-status-strategy border border-status-strategy/30',
  warn:     'bg-status-warn/15 text-status-warn border border-status-warn/30',
  neutral:  'bg-surface-muted/40 text-zinc-400 border border-surface-border',
};
