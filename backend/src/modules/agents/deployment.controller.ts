import { Controller, Post, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { DeploymentService } from './services/deployment.service';
import {
  SpawnAgentFromTemplateDto,
  BulkDeployAgentsDto,
  DeployDeptTemplateDto,
} from './dto/deployment.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { UserRole } from '@prisma/client';

/**
 * DeploymentController — /api/v1/deploy
 *
 * SRP : Handles only deployment (spawning instances from templates).
 *       No CRUD here — see AgentsController / AgentTemplatesController.
 *
 * Route-level guards:
 *   - spawnFromTemplate: SUPER_ADMIN, OWNER, ADMIN (tenants scope enforced in service)
 *   - bulkDeployAgents: SUPER_ADMIN only (cross-tenant)
 *   - deployDeptTemplate: SUPER_ADMIN only (cross-tenant org restructure)
 */
@Controller({ path: 'deploy', version: '1' })
@ApiCommon('agents')
export class DeploymentController {
  constructor(private readonly deploymentService: DeploymentService) {}

  /**
   * POST /api/v1/deploy/agents/from-template/:templateId
   * Spawn a single agent from a platform template and assign to a tenant.
   * Tenants (OWNER/ADMIN) may spawn into their own tenant only.
   */
  @Post('agents/from-template/:templateId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN)
  spawnFromTemplate(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() dto: SpawnAgentFromTemplateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.deploymentService.spawnFromTemplate(
      templateId,
      dto,
      user.sub,
      user.tenantId ?? null,
      user.role,
    );
  }

  /**
   * POST /api/v1/deploy/tenants/:tenantId/agents
   * Bulk-deploy multiple agents (from templates) to a tenant.
   * All-or-nothing transaction. SUPER_ADMIN only.
   */
  @Post('tenants/:tenantId/agents')
  @Roles(UserRole.SUPER_ADMIN)
  bulkDeployAgents(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: BulkDeployAgentsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.deploymentService.bulkDeployAgents(tenantId, dto, user.sub);
  }

  /**
   * POST /api/v1/deploy/tenants/:tenantId/dept-template
   * Deploy a full department template structure to a tenant.
   * Optionally bootstraps head agents for each department. SUPER_ADMIN only.
   */
  @Post('tenants/:tenantId/dept-template')
  @Roles(UserRole.SUPER_ADMIN)
  deployDeptTemplate(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: DeployDeptTemplateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.deploymentService.deployDeptTemplate(tenantId, dto, user.sub);
  }
}
