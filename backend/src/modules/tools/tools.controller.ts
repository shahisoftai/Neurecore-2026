import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { ToolsService } from './tools.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles, Public } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/token.interface';

/**
 * ToolsController
 *
 * Phase 0 (D-015, FIX-001): All endpoints are now auth-gated. The
 * `tools.controller.ts` previously had no `@UseGuards` and no `@Roles` on
 * `execute`, `executeById`, and `getStatus` — anyone with a valid JWT could
 * invoke any tool by name or id, and `executeById` did not verify the
 * toolIntegration belonged to the caller's tenant. Now:
 *
 * - `listBuiltIn` is `@Public()` so onboarding can render tool options pre-auth.
 * - `listIntegrations` requires auth (any tenant user).
 * - `registerIntegration` requires OWNER or ADMIN.
 * - `execute` (built-in tool) requires any tenant user; built-in tools are
 *   platform-level so no tenant ownership check.
 * - `executeById` requires any tenant user; the service enforces that the
 *   toolIntegration.tenantId === user.tenantId OR isBuiltIn.
 * - `getStatus` requires any tenant user; the service enforces ownership.
 */
@Controller({ path: 'tools', version: '1' })
@ApiCommon('tools')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  // ─── List built-in tools (public — used by onboarding wizard) ─

  @Public()
  @Get()
  listBuiltIn() {
    return this.toolsService.list();
  }

  // ─── List integrations for tenant ───────────────────────

  @Get('integrations')
  listIntegrations(@CurrentUser() user: JwtPayload) {
    return this.toolsService.findIntegrations(user.tenantId!);
  }

  // ─── Register a new tool integration ────────────────────

  @Post('register')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  registerIntegration(
    @Body()
    body: {
      name: string;
      description?: string;
      type?: string;
      config?: Record<string, unknown>;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.toolsService.registerIntegration(user.tenantId!, body);
  }

  // ─── Execute by tool name (built-in) ─────────────────────

  @Post('execute')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.USER)
  execute(
    @Body('tool') tool: string,
    @Body('input') input: Record<string, unknown>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.toolsService.execute(tool, input, { tenantId: user.tenantId! });
  }

  // ─── Get execution status / stats for integration ───────────

  @Get(':id/status')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.USER)
  async getStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // Enforce tenant ownership before returning stats.
    await this.toolsService.assertIntegrationAccess(id, user.tenantId!);
    return this.toolsService.getToolStatus(id);
  }

  // ─── Execute a specific integration by id ─────────────────

  @Post(':id/execute')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.USER)
  async executeById(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('input') input: Record<string, unknown>,
    @Body('agentId') agentId?: string,
    @Body('taskId') taskId?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    const tenantId = user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    // Enforce tenant ownership OR built-in flag before executing.
    await this.toolsService.assertIntegrationAccess(id, tenantId);
    return this.toolsService.executeById(id, input ?? {}, {
      agentId,
      taskId,
      tenantId,
    });
  }
}
