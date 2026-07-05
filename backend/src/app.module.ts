import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { ConfigurationModule } from './config';
import { DatabaseModule } from './infrastructure/database/database.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { EventsModule } from './modules/events/events.module';
import { AgentsModule } from './modules/agents/agents.module';
import { MemoryModule } from './modules/memory/memory.module';
import { ToolsModule } from './modules/tools/tools.module';
import { OrchestrationModule } from './modules/orchestration/orchestration.module';
// Phase 3
import { GovernanceModule } from './modules/governance/governance.module';
import { HermesModule } from './modules/hermes/hermes.module';
import { ObservabilityModule } from './modules/observability/observability.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { DepartmentTemplatesModule } from './modules/department-templates/department-templates.module';
import { ModelsModule } from './modules/models/models.module';
import { AIGatewayModule } from './modules/ai-gateway/ai-gateway.module';
import { ChatModule } from './modules/chat/chat.module';
import { AuditModule } from './modules/audit/audit.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ConnectorsModule } from './modules/connectors/connectors.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { FinanceModule } from './modules/finance/finance.module';
import { ReliabilityModule } from './modules/reliability/reliability.module';
import { AgentTemplatesModule } from './modules/agent-templates/agent-templates.module';
import { RoutinesModule } from './modules/routines/routines.module';
import { CostsModule } from './modules/costs/costs.module';
import { InboxModule } from './modules/inbox/inbox.module';
import { GoalsModule } from './modules/goals/goals.module';
import { SecurityModule } from './modules/security/security.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
// Phase 3 — EAOS-1 entity workspace
import { EntitiesModule } from './modules/entities/entities.module';
import { MissionFeedModule } from './modules/mission-feed/mission-feed.module';
import { AIActionsModule } from './modules/ai-actions/ai-actions.module';
// Phase 5 pre-req — Observability (Prometheus metrics)
import { MetricsModule } from './modules/metrics/metrics.module';
// Phase 5 pre-req — Feature flag system (kill-switch)
import { FeatureFlagModule } from './common/feature-flag/feature-flag.module';
// Phase 4 — EAOS-2 widgets
import { WidgetsModule } from './modules/widgets/widgets.module';
import { SettingsModule } from './modules/settings/settings.module';
import { TiersModule } from './modules/tiers/tiers.module';
import { IndustriesModule } from './modules/industry/industries.module';
import { TierTemplatesModule } from './modules/tier-templates/tier-templates.module';
import { FeaturesModule } from './modules/features/features.module';
import { DepartmentsPoolModule } from './modules/departments-pool/departments-pool.module';
import { AgentsPoolModule } from './modules/agents-pool/agents-pool.module';
import { PackagesModule } from './modules/packages/packages.module';
import { HealthModule } from './modules/health/health.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
// Phase 7 — EAOS-5 Solution Packs (Marketplace + install lifecycle)
import { SolutionPacksModule } from './modules/solution-packs/solution-packs.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
// Phase 8 — EAOS-6 First Vertical Pack (Retail)
import { RetailModule } from './modules/retail/retail.module';
// Phase 2 — Dashboard aggregation (Command Center)
import { CommandCenterModule } from './modules/command-center/command-center.module';
// Phase 3 — Cross-Department Context
import { ContextModule } from './modules/context/context.module';
// Phase 5 — Batch Approvals & Learning Loop
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { TenantContextMiddleware } from './common/context/tenant-context.middleware';
// TenantContextMiddleware is deprecated — TenantContextGuard (APP_GUARD) replaces it
import { TenantContextModule } from './common/context/tenant-context.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { TenantContextGuard } from './common/guards/tenant-context.guard';
import { CookieAuthModule } from './common/auth/cookie-auth.module';
import { CsrfProtectionMiddleware } from './common/auth/csrf.middleware';

@Module({
  imports: [
    // Config — global, validates env vars at boot
    ConfigurationModule,

    // Phase 9 — Cookie auth (httpOnly + Secure + SameSite=Strict, sole auth path)
    CookieAuthModule,

    // Tenant context — @Global so every module can inject TenantContextService
    // (Phase 1, Task 1.4 + Phase 1E migration)
    TenantContextModule,

    // Rate limiting: 100 req / 60 s per IP
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    // Infrastructure (global — no need to import elsewhere)
    DatabaseModule,
    CacheModule,
    SecurityModule, // Centralized secret management

    // Feature modules
    AuthModule,
    TenantsModule,
    UsersModule,
    EventsModule,

    // Phase 2 — Agent Runtime
    AgentsModule,
    MemoryModule,
    ToolsModule,
    OrchestrationModule,

    // Phase 3 — Governance, Observability, Notifications, Departments, Models
    GovernanceModule,
    HermesModule,
    ObservabilityModule,
    NotificationsModule,
    DepartmentsModule,
    DepartmentTemplatesModule,
    ModelsModule,
    AIGatewayModule,
    ChatModule,

    // Phase 4 — Analytics Engine, CRM Connectors, Financial Module & Reliability
    AnalyticsModule,
    ConnectorsModule,
    IntegrationsModule, // Phase A: Google Workspace + Brevo OAuth
    FinanceModule,
    ReliabilityModule,

    // Cross-cutting
    AuditModule, // @Global — AuditService available everywhere
    AgentTemplatesModule, // Phase 2 — template library

    // Settings — Admin configuration
    SettingsModule,

    // Tier-based Agent Pool — Platform tiers & automatic provisioning
    TiersModule,

    // Onboarding wizard (WS-2)
    OnboardingModule,

    // WS-2.1 — Uploads (tenant logos, future avatars/documents)
    UploadsModule,

    // Health monitoring
    HealthModule,

    // Phase 5 — Paperclip Routines/Workflows
    RoutinesModule,

    // Phase 5 — Paperclip Cost Tracking
    CostsModule,

    // Phase 5 — Paperclip Unified Inbox
    InboxModule,

    // Phase 5 — Paperclip Goals
    GoalsModule,

    // Phase 5 — Paperclip Projects
    ProjectsModule,

    // Phase 5 — Workflows (EAOS-2 / Paperclip)
    WorkflowsModule,

    // Phase 3 — EAOS-1 entity workspace
    EntitiesModule,
    MissionFeedModule,
    AIActionsModule,

    // Phase 5 pre-req — Observability (Prometheus + Grafana)
    MetricsModule,
    FeatureFlagModule,

    // Phase 4 — EAOS-2 widgets
    WidgetsModule,

    // Phase 6 — EAOS-4 Knowledge Hub (RAG pipeline)
    KnowledgeModule,

    // Phase 7 — EAOS-5 Solution Packs
    SolutionPacksModule,
    MarketplaceModule,

    // Phase 8 — EAOS-6 First Vertical Pack (Retail)
    RetailModule,

    // Phase 2 — Dashboard Command Center aggregation
    CommandCenterModule,
    // Phase 3 — Cross-Department Context
    ContextModule,
    // Phase 5 — Batch Approvals & Learning Loop
    ApprovalsModule,

    // Phase 10 — Admin Business Composition (six pools)
    AgentsPoolModule,       // Pool #1 — AI Employees
    DepartmentsPoolModule,  // Pool #2 — Departments
    IndustriesModule,       // Pool #3 — Industries
    TierTemplatesModule,    // Pool #4 — Tier Templates (commercial offering)
    FeaturesModule,         // Pool #5 — Features
    PackagesModule,         // Pool #6 — Packages (composite root)
  ],
  providers: [
    // Global rate-limit guard
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    // Global JWT guard (routes opt-out with @Public())
    { provide: APP_GUARD, useClass: JwtAuthGuard },

    // Global role guard
    { provide: APP_GUARD, useClass: RolesGuard },

    // Global tenant context guard — runs AFTER JwtAuthGuard to ensure req.user is set.
    // Sets up AsyncLocalStorage context for TenantContextService.tenantId.
    { provide: APP_GUARD, useClass: TenantContextGuard },

    // Global exception → ApiResponse envelope
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },

    // Global success → ApiResponse envelope
    { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },

    // Global audit interceptor — writes audit logs for every mutating request
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Nest v11+ uses a newer path-to-regexp which requires named wildcards.
    // Using *path avoids noisy startup warnings like "Unsupported route path: /api/*".
    consumer
      .apply(RequestLoggerMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });

    // Phase 9, Task 9.3: CSRF double-submit cookie validation.
    // Runs BEFORE the JWT guard so unauthenticated mutating requests
    // without a CSRF token are rejected (defense-in-depth).
    consumer
      .apply(CsrfProtectionMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });

    // Phase 1, Task 1.4: bind the AsyncLocalStorage tenant context for
    // every request after the JWT guard has populated req.user. Services
    // read `tenantContext.tenantId` instead of receiving tenantId as a
    // parameter on every method (EAOS-rbac-model.md §10).
    //
    // NOTE: TenantContextMiddleware is REMOVED because middleware runs BEFORE
    // guards in NestJS, so req.user wasn't set when it tried to resolve context.
    // TenantContextGuard (registered via APP_GUARD above) replaces this and runs
    // after JwtAuthGuard, properly setting up the AsyncLocalStorage context.
    // consumer
    //   .apply(TenantContextMiddleware)
    //   .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
