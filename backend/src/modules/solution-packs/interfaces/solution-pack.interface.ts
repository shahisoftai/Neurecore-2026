/**
 * Solution Pack type definitions (per `EAOS-implementation-plan.md` §5 + §9.8).
 *
 * Solution Packs extend NeureCore from a generic platform into an
 * industry-specific AI OS. Each pack contains a typed set of extensions:
 * entity subtypes, capability overrides, widgets, AI actions, knowledge,
 * workflow templates, integration definitions, and KPI templates.
 *
 * SOLID:
 *  - SRP — this file owns only the *shape* of a pack and its extensions.
 *    Runtime install/uninstall lives in `services/`.
 *  - OCP — new extension kinds can be added by extending `SolutionExtensions`
 *    without breaking existing callers.
 *  - ISP — `PackPreview` is a thin projection of `SolutionPack` + its
 *    *impact* on this tenant (what changes after install). Consumers that
 *    only need the preview don't get the full `extensions` payload.
 */

import type {
  EaosEntityTypeForWidget,
  WidgetCapability,
  AggregationType,
  Visualization,
} from '../../widgets/widget-definition';
import type {
  AIActionCategory,
  AIActionTierRequired,
} from '../../ai-actions/action-definition';

/** Pack lifecycle (mirrors `SolutionPackStatus` enum in Prisma). */
export type SolutionPackStatus = 'draft' | 'beta' | 'stable' | 'deprecated';

/** Tier the pack requires (mirrors `PackTierRequired` enum in Prisma). */
export type PackTierRequired = 'COMMUNITY' | 'STARTER' | 'PRO' | 'ENTERPRISE';

/** Pack category. */
export type SolutionPackCategory = 'VERTICAL' | 'HORIZONTAL';

/** Owner of the pack catalog row (future-proof for third-party publishers). */
export type SolutionPackOwnerKind = 'SEED' | 'PLATFORM' | 'TENANT';

/**
 * Entity subtype definition contributed by a pack. Adding a subtype
 * allows the tenant to create entities of that refined shape
 * (e.g. `FACILITY:retail-store`).
 */
export interface EntitySubtypeDefinition {
  /** Base entity type this subtype specializes (FACILITY | ASSET | CUSTOMER | …). */
  baseType: string;
  /** Subtype slug (e.g. "retail-store"). Must be unique within a baseType. */
  subtype: string;
  /** Display label (e.g. "Retail Store"). */
  label: string;
  /** Lucide icon name. */
  icon: string;
  /** Hex color used in the workspace sidebar. */
  color?: string;
  /** Capabilities the subtype enables (overrides the base type defaults). */
  enabledCapabilities?: string[];
  /** Default widget placement (widget id → grid placement). */
  defaultWidgets?: Array<{
    widgetId: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }>;
  /** Suggested integrations (connector ids). */
  suggestedIntegrations?: string[];
  /** Short blurb shown in the Workspace "Create entity" wizard. */
  description?: string;
}

/**
 * Widget contributed by a pack. Mirrors `WidgetDefinition` (Phase 4) but
 * without the runtime visualization (frontend maps via the WidgetRegistry).
 */
export interface PackWidgetDefinition {
  id: string;
  capability: WidgetCapability;
  capabilityDomain: string;
  title: string;
  subtitle?: string;
  icon?: string;
  aggregationType: AggregationType;
  defaultVisualization: Visualization;
  visualizations: Visualization[];
  entityTypes: EaosEntityTypeForWidget[];
  refreshInterval: number;
  category: 'CORE' | 'CONTEXTUAL' | 'INDUSTRY_SPECIFIC';
  /** Pack-localized description for the marketplace detail page. */
  description?: string;
}

/**
 * AI Action contributed by a pack. Mirrors `AIActionDefinition` (Phase 5)
 * minus the `handler` runtime (handlers are added by the applier against
 * the `AIActionRegistry`).
 */
export interface PackAIActionDefinition {
  id: string;
  name: string;
  description: string;
  category: AIActionCategory;
  capability:
    'intelligence' | 'operations' | 'insights' | 'automation' | 'collaboration';
  tags: string[];
  supportedEntities: string[];
  requiresStreaming: boolean;
  timeoutMs: number;
  tierRequired: AIActionTierRequired;
  /** Tokens estimate — used for cost preview. */
  tokensEstimate: number;
  /** Free-form: which UI surfaces should surface this action. */
  surfaces?: Array<
    'command_palette' | 'intelligence_panel' | 'automation_panel' | 'quick_fire'
  >;
  /** Pack-localized description for the marketplace detail page. */
  examples?: Array<{ title: string; outputPreview: string }>;
}

/**
 * Knowledge seed contributed by a pack. When the pack is installed we
 * upsert a `KnowledgeEntry` for each item so the RAG pipeline has content
 * to retrieve from on day one.
 */
export interface PackKnowledgeSeed {
  title: string;
  type:
    | 'POLICY'
    | 'SOP'
    | 'PLAYBOOK'
    | 'TEMPLATE'
    | 'PROMPT'
    | 'REGULATION'
    | 'CONTRACT'
    | 'REPORT'
    | 'DOCUMENTATION'
    | 'FAQ'
    | 'GUIDE'
    | 'BRIEFING';
  content: string;
  tags?: string[];
  language?: string;
  departmentId?: string;
  /** Optional source citation (e.g. "OSHA Standard 1910.132"). */
  source?: string;
  sourceUrl?: string;
}

/**
 * Integration definition contributed by a pack. Adds a typed entry to the
 * marketplace's connectors tab; connecting still requires the tenant's
 * OAuth credentials.
 */
export interface PackIntegrationDefinition {
  providerId: string;
  name: string;
  category: string;
  description: string;
  icon?: string;
  /** OAuth scopes that will be requested at connect time. */
  scopes?: string[];
}

/**
 * KPI template contributed by a pack. Surfaces in the Insights panel
 * Wizard so a tenant can one-click add a vertical-specific KPI.
 */
export interface PackKPITemplate {
  id: string;
  label: string;
  unit: string;
  aggregation: AggregationType;
  dataSourceEntityType: EaosEntityTypeForWidget;
  description?: string;
}

/**
 * Mission Feed preview item that is emitted when the pack is installed.
 * Per `EAOS-NUWS-principles.md` §5.4 — "after install, you'll see…".
 */
export interface PackPreviewMissionFeedItem {
  category: 'AI_INSIGHT' | 'SYSTEM' | 'PACK_INSTALLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  title: string;
  description: string;
  actionPayload?: Record<string, unknown>;
}

/**
 * Theming impact — surfaces which UI tokens change after the pack is
 * installed. Per `EAOS-NUWS-principles.md` §7.5.2 (per-tenant theming).
 */
export interface PackThemingImpact {
  /** CSS variables to override on the workspace root. */
  cssVariables?: Record<string, string>;
  /** Primary accent hex color (drives button + link colors). */
  accentColor?: string;
  /** Optional logo URL shown in the workspace sidebar. */
  logoUrl?: string;
  /** Pack-localized short rationale ("Why this color?"). */
  rationale?: string;
}

/**
 * Full extensions object stored in `SolutionPack.extensions`.
 */
export interface SolutionExtensions {
  entitySubtypes?: EntitySubtypeDefinition[];
  widgetExtensions?: PackWidgetDefinition[];
  aiActionExtensions?: PackAIActionDefinition[];
  knowledgePacks?: PackKnowledgeSeed[];
  integrationDefinitions?: PackIntegrationDefinition[];
  kpiTemplates?: PackKPITemplate[];
  workflowTemplates?: Array<{
    slug: string;
    name: string;
    description: string;
    trigger: string;
  }>;
  /** Mission Feed items auto-created on install. */
  previewMissionFeed?: PackPreviewMissionFeedItem[];
  /** Theming impact (per-task 7.10). */
  themingImpact?: PackThemingImpact;
}

/**
 * Public pack shape exposed via the API. The `extensions` payload is
 * always returned; it is metadata (declarative) and never carries secrets.
 */
export interface SolutionPack {
  id: string;
  slug: string;
  name: string;
  version: string;
  category: SolutionPackCategory;
  description: string;
  shortDescription: string;
  icon: string;
  color: string;
  tierRequired: PackTierRequired;
  status: SolutionPackStatus;
  ownerKind: SolutionPackOwnerKind;
  ownerId: string | null;
  extensions: SolutionExtensions;
  requiresPacks: string[];
  conflictsWith: string[];
  tags: string[];
  monthlyPriceUsd: number;
  estimatedAiCredits: number;
  sortOrder: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Per-tenant install record. Mirrors `TenantInstalledPack` Prisma model.
 */
export interface TenantInstalledPack {
  id: string;
  tenantId: string;
  solutionPackId: string;
  packSlug: string;
  packVersion: string;
  extensionsSnapshot: SolutionExtensions;
  installedById: string | null;
  installedAt: string;
  uninstalledAt: string | null;
  uninstalledById: string | null;
  themingImpact: PackThemingImpact;
}

/**
 * Install preview — what changes if this tenant installs `pack` today.
 * Used by `GET /solution-packs/:slug/preview` (task 7.9).
 */
export interface PackInstallPreview {
  pack: SolutionPack;
  /** True if the pack is already installed by this tenant. */
  alreadyInstalled: boolean;
  /** True if every check passed (tier + deps + conflicts). */
  canInstall: boolean;
  /** Failure reasons when `canInstall` is false. */
  blockers: PackValidationFailure[];
  /** Effects that would apply after install (entities, widgets, …). */
  impact: PackInstallImpact;
}

/**
 * Single validation failure. The validator collects one of these per
 * failed check and the preview endpoint returns them all so the UI can
 * surface them in a single dialog.
 */
export interface PackValidationFailure {
  /** Stable code for i18n in the UI. */
  code:
    | 'PACK_NOT_FOUND'
    | 'PACK_NOT_PUBLISHED'
    | 'TIER_INSUFFICIENT'
    | 'TIER_REQUIRED'
    | 'DEPENDENCY_MISSING'
    | 'CONFLICT'
    | 'ALREADY_INSTALLED'
    | 'OWNER_REQUIRED'
    | 'INTEGRATIONS_MISSING';
  message: string;
  /** Pack slug involved in the failure (for dependency/conflict refs). */
  relatedPackSlug?: string;
  /** Tier the tenant is on vs tier the pack requires. */
  tenantTier?: PackTierRequired;
  requiredTier?: PackTierRequired;
}

export interface PackInstallImpact {
  /** Count of new entity subtypes the tenant will gain. */
  newEntitySubtypes: number;
  /** Count of new widgets added to the registry for this tenant. */
  newWidgets: number;
  /** Count of new AI actions added to the registry for this tenant. */
  newAiActions: number;
  /** Count of knowledge entries seeded. */
  newKnowledgeEntries: number;
  /** Count of integration definitions added to the marketplace. */
  newIntegrations: number;
  /** Count of KPI templates added. */
  newKpiTemplates: number;
  /** Count of workflow templates added. */
  newWorkflowTemplates: number;
  /** Mission Feed preview items the install will emit. */
  missionFeedPreview: PackPreviewMissionFeedItem[];
  /** Theming impact that will be applied. */
  themingImpact: PackThemingImpact;
}

/**
 * Pack audit log entry (mirrors `PackInstallation` Prisma model).
 */
export interface PackInstallationLogEntry {
  id: string;
  tenantId: string;
  solutionPackId: string;
  action:
    'install' | 'uninstall' | 'preview' | 'install_failed' | 'uninstall_failed';
  success: boolean;
  errorMessage: string | null;
  performedById: string | null;
  performedAt: string;
}

/**
 * Token-bucket semantic: this is the *contract* of a tier ordering.
 * Mirrors `tierMeetsRequirement` from `ai-actions`.
 */
const TIER_ORDER: PackTierRequired[] = [
  'COMMUNITY',
  'STARTER',
  'PRO',
  'ENTERPRISE',
];

/**
 * Returns true if `tenantTier` is at or above `requiredTier`.
 * Used by the pack validator and `TierService.canInstallPack()`.
 */
export function tierMeetsPackRequirement(
  tenantTier: PackTierRequired,
  requiredTier: PackTierRequired,
): boolean {
  const tIdx = TIER_ORDER.indexOf(tenantTier);
  const rIdx = TIER_ORDER.indexOf(requiredTier);
  return tIdx >= 0 && rIdx >= 0 && tIdx >= rIdx;
}

export const PACK_TIER_ORDER = TIER_ORDER;
