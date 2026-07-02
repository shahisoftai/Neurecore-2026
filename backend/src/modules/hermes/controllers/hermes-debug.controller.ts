/**
 * hermes-debug.controller.ts — Dev/debug endpoints for the Hermes layer.
 *
 * SOLID — SRP: Only exposes debug/introspection operations.
 *
 * WARNING: These endpoints are intended for development and should be
 * restricted in production via environment-based guards.
 */

import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HermesRegistryService } from '../services/hermes-registry.service';
import { HermesRuntimeService } from '../services/hermes-runtime.service';
import { PermissionMatrixService } from '../services/permission-matrix.service';
import { ToolGatewayService } from '../services/tool-gateway.service';
import { HermesTenantGuard } from '../guards/hermes-tenant.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/token.interface';

@ApiTags('Hermes Debug')
@ApiBearerAuth()
@Controller({ path: 'hermes/debug', version: '1' })
@UseGuards(HermesTenantGuard)
export class HermesDebugController {
    constructor(
        private readonly registry: HermesRegistryService,
        private readonly runtime: HermesRuntimeService,
        private readonly permMatrix: PermissionMatrixService,
        private readonly toolGateway: ToolGatewayService,
    ) { }

    @Get('agents/:agentId/tools')
    @ApiOperation({ summary: 'List all tools allowed for a Hermes agent' })
    async getAllowedTools(
        @Param('agentId') agentId: string,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.toolGateway.getAllowedTools(agentId, user.tenantId!);
    }

    @Get('agents/:agentId/status')
    @ApiOperation({ summary: 'Get runtime status of a Hermes agent' })
    async getStatus(
        @Param('agentId') agentId: string,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.runtime.getStatus(agentId, user.tenantId!);
    }

    @Post('agents/:agentId/suspend')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Suspend a running Hermes agent' })
    async suspend(
        @Param('agentId') agentId: string,
        @CurrentUser() user: JwtPayload,
    ) {
        await this.runtime.suspend(agentId, user.tenantId!);
        return { success: true };
    }

    @Post('agents/:agentId/resume')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Resume a suspended Hermes agent' })
    async resume(
        @Param('agentId') agentId: string,
        @CurrentUser() user: JwtPayload,
    ) {
        await this.runtime.resume(agentId, user.tenantId!);
        return { success: true };
    }

    @Get('permission-matrix')
    @ApiOperation({ summary: 'Get the full permission matrix for the tenant' })
    async getMatrix(@CurrentUser() user: JwtPayload) {
        return this.permMatrix.getMatrix(user.tenantId!);
    }

    @Post('tool-check')
    @ApiOperation({ summary: 'Validate if a tool call would be allowed' })
    async checkTool(
        @Body()
        body: {
            hermesAgentId: string;
            toolName: string;
            toolInput?: Record<string, unknown>;
            sessionId?: string;
        },
        @CurrentUser() user: JwtPayload,
    ) {
        return this.toolGateway.validate({
            hermesAgentId: body.hermesAgentId,
            toolName: body.toolName,
            toolInput: body.toolInput ?? {},
            sessionId: body.sessionId ?? 'debug',
            tenantId: user.tenantId!,
        });
    }
}
