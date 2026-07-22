/**
 * Approval Addon Interface
 *
 * Stage 2 Phase 2A: Industry-specific approval routing.
 *
 * Each addon implements this interface to provide industry-specific
 * approval escalation chains. The base ApprovalChainsService delegates
 * to these addons when an industry-specific chain is needed.
 *
 * SOLID:
 * - ISP: Exposes only the methods an industry needs to override.
 * - LSP: All addons implement this interface — interchangeable.
 * - DIP: ApprovalChainsService depends on ApprovalAddon[] (abstract).
 */

export interface ApprovalRouteTriggerCondition {
  amount?: { gt?: number; lt?: number };
  industryGroup?: string;
  riskTier?: string;
  projectType?: string;
}

export interface ApprovalRouteTrigger {
  event: string;
  conditions?: ApprovalRouteTriggerCondition;
}

export interface ApprovalStage {
  role: string;
  order: number;
  action:
    | 'verify'
    | 'assess'
    | 'approve'
    | 'review'
    | 'sign-off'
    | 'endorse'
    | 'authorize';
}

export interface ApprovalRoute {
  slug: string;
  label: string;
  description?: string;
  stages: ApprovalStage[];
  triggers: ApprovalRouteTrigger[];
}

export interface ApprovalAddon {
  /** Which industry group slugs this addon applies to. */
  readonly industrySlugs: string[];

  /** Returns the industry-specific approval routes for a tenant. */
  getRoutes(tenantId: string): Promise<ApprovalRoute[]>;

  /** Returns routes matching a specific event trigger. */
  getRoutesForEvent(tenantId: string, event: string): Promise<ApprovalRoute[]>;
}

export const APPROVAL_ADDON = 'APPROVAL_ADDON';
