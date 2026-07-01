/**
 * Costs Controller
 *
 * REST API endpoints for cost tracking and budget management
 * Following SOLID: Single Responsibility - only handles HTTP
 *
 * Phase 1 Gap 6 — added URI versioning (`/api/v1/costs`).
 * tenantId is sourced from @CurrentUser() JWT.
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CostsService } from './services/costs.service';
import { CreateBudgetPolicyDto, UpdateBudgetPolicyDto } from './dto/cost.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';

@Controller({ path: 'costs', version: '1' })
@ApiCommon('costs')
@UseGuards(JwtAuthGuard)
export class CostsController {
  constructor(private readonly costsService: CostsService) {}

  private parseDateRange(
    startDate?: string,
    endDate?: string,
  ): { start: Date; end: Date } {
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    return { start, end };
  }

  /**
   * Get cost summary for tenant
   * GET /api/v1/costs/summary
   */
  @Get('summary')
  async getCostSummary(
    @CurrentUser() user: JwtPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    const { start, end } = this.parseDateRange(startDate, endDate);
    return this.costsService.getTenantCostSummary(user.tenantId, start, end);
  }

  /**
   * Get cost breakdown by agent
   * GET /api/v1/costs/by-agent
   */
  @Get('by-agent')
  async getCostByAgent(
    @CurrentUser() user: JwtPayload,
    @Query('agentId') agentId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    const { start, end } = this.parseDateRange(startDate, endDate);
    return this.costsService.getCostByAgent(user.tenantId, agentId, start, end);
  }

  /**
   * Get cost breakdown by model
   * GET /api/v1/costs/by-model
   */
  @Get('by-model')
  async getCostByModel(
    @CurrentUser() user: JwtPayload,
    @Query('model') model: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    const { start, end } = this.parseDateRange(startDate, endDate);
    return this.costsService.getCostByModel(user.tenantId, model, start, end);
  }

  /**
   * Get cost breakdown by provider
   * GET /api/v1/costs/by-provider
   */
  @Get('by-provider')
  async getCostByProvider(
    @CurrentUser() user: JwtPayload,
    @Query('provider') provider: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    const { start, end } = this.parseDateRange(startDate, endDate);
    return this.costsService.getCostByProvider(user.tenantId, provider, start, end);
  }

  /**
   * Get cost records list
   * GET /api/v1/costs/records
   */
  @Get('records')
  async getCostRecords(
    @CurrentUser() user: JwtPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('agentId') agentId?: string,
    @Query('provider') provider?: string,
    @Query('model') model?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    const { start, end } = this.parseDateRange(startDate, endDate);

    return this.costsService.getCostRecords(user.tenantId, start, end, {
      agentId,
      provider,
      model,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  // ─── Budget Policy Endpoints ───────────────────────────────────────────────

  /**
   * Get all budget policies
   * GET /api/v1/costs/budgets
   */
  @Get('budgets')
  async getBudgetPolicies(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.costsService.getBudgetPolicies(user.tenantId);
  }

  /**
   * Create a new budget policy
   * POST /api/v1/costs/budgets
   */
  @Post('budgets')
  async createBudgetPolicy(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateBudgetPolicyDto,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.costsService.createBudgetPolicy(user.tenantId, dto);
  }

  /**
   * Update a budget policy
   * PATCH /api/v1/costs/budgets/:id
   */
  @Patch('budgets/:id')
  async updateBudgetPolicy(
    @Param('id') id: string,
    @Body() dto: UpdateBudgetPolicyDto,
  ) {
    return this.costsService.updateBudgetPolicy(id, dto);
  }

  /**
   * Delete a budget policy
   * DELETE /api/v1/costs/budgets/:id
   */
  @Delete('budgets/:id')
  async deleteBudgetPolicy(@Param('id') id: string) {
    await this.costsService.deleteBudgetPolicy(id);
    return { success: true };
  }

  /**
   * Get active budget incidents
   * GET /api/v1/costs/incidents
   */
  @Get('incidents')
  async getActiveIncidents(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.costsService.getActiveIncidents(user.tenantId);
  }

  /**
   * Acknowledge a budget incident
   * POST /api/v1/costs/incidents/:id/acknowledge
   */
  @Post('incidents/:id/acknowledge')
  async acknowledgeIncident(@Param('id') id: string) {
    await this.costsService.acknowledgeIncident(id);
    return { success: true };
  }

  /**
   * Resolve a budget incident
   * POST /api/v1/costs/incidents/:id/resolve
   */
  @Post('incidents/:id/resolve')
  async resolveIncident(@Param('id') id: string) {
    await this.costsService.resolveIncident(id);
    return { success: true };
  }

  /**
   * Get cost breakdown by agent with names
   * Phase 2 — optional `?departmentId=` filter
   * GET /api/v1/costs/breakdown/by-agent
   */
  @Get('breakdown/by-agent')
  async getCostByAgentBreakdown(
    @CurrentUser() user: JwtPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    const { start, end } = this.parseDateRange(startDate, endDate);
    return this.costsService.getCostByAgentBreakdown(
      user.tenantId,
      start,
      end,
      departmentId,
    );
  }

  /**
   * Get cost breakdown by model
   * GET /api/v1/costs/breakdown/by-model
   */
  @Get('breakdown/by-model')
  async getCostByModelBreakdown(
    @CurrentUser() user: JwtPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    const { start, end } = this.parseDateRange(startDate, endDate);
    return this.costsService.getCostByModelBreakdown(user.tenantId, start, end);
  }

  /**
   * Phase 2 — get cost summary scoped to a single department.
   * GET /api/v1/costs/department/:departmentId
   */
  @Get('department/:departmentId')
  async getDepartmentCostSummary(
    @CurrentUser() user: JwtPayload,
    @Param('departmentId') departmentId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    const { start, end } = this.parseDateRange(startDate, endDate);
    return this.costsService.getDepartmentCostSummary(
      user.tenantId,
      departmentId,
      start,
      end,
    );
  }
}
