/**
 * hermes-registry.controller.ts — REST endpoints for Hermes agent registry.
 *
 * SOLID — SRP: Only exposes agent registry CRUD operations.
 */

import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
    Query,
    HttpCode,
    HttpStatus,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HermesRegistryService } from '../services/hermes-registry.service';
import { HermesTenantGuard } from '../guards/hermes-tenant.guard';
import { RegisterAgentDto } from '../dto/register-agent.dto';
import { ToolPermissionDto } from '../dto/tool-permission.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/token.interface';
import type { HermesAgentType } from '@prisma/client';

@ApiTags('Hermes Registry')
@ApiBearerAuth()
@Controller({ path: 'hermes/registry', version: '1' })
@UseGuards(HermesTenantGuard)
export class HermesRegistryController {
    constructor(private readonly registry: HermesRegistryService) { }

    @Post()
    @ApiOperation({ summary: 'Register a new Hermes agent' })
    async register(
        @Body() dto: RegisterAgentDto,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.registry.register(dto, user.tenantId!);
    }

    @Get()
    @ApiOperation({ summary: 'List all Hermes agents for the tenant' })
    async findAll(
        @CurrentUser() user: JwtPayload,
        @Query('type') type?: HermesAgentType,
        @Query('capability') capability?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        if (capability) {
            return this.registry.findByCapability(capability, user.tenantId!);
        }
        if (type) {
            return this.registry.findByType(type, user.tenantId!);
        }
        return this.registry.findAll(user.tenantId!, {
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 20,
        });
    }

    @Get(':agentId')
    @ApiOperation({ summary: 'Get a Hermes agent by ID' })
    async findById(
        @Param('agentId') agentId: string,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.registry.findById(agentId, user.tenantId!);
    }

    @Patch(':agentId')
    @ApiOperation({ summary: 'Update a Hermes agent' })
    async update(
        @Param('agentId') agentId: string,
        @Body() dto: Partial<RegisterAgentDto>,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.registry.update(agentId, dto, user.tenantId!);
    }

    @Delete(':agentId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Unregister a Hermes agent' })
    async unregister(
        @Param('agentId') agentId: string,
        @CurrentUser() user: JwtPayload,
    ) {
        await this.registry.unregister(agentId, user.tenantId!);
    }

    @Post(':agentId/capabilities')
    @ApiOperation({ summary: 'Add a capability to a Hermes agent' })
    async addCapability(
        @Param('agentId') agentId: string,
        @Body() body: { name: string; description?: string; inputSchema?: Record<string, unknown>; outputSchema?: Record<string, unknown>; costEstimate?: number; avgDuration?: number },
        @CurrentUser() user: JwtPayload,
    ) {
        return this.registry.addCapability(agentId, body, user.tenantId!);
    }

    @Post(':agentId/tools')
    @ApiOperation({ summary: 'Set tool permission for a Hermes agent' })
    async setToolPermission(
        @Param('agentId') agentId: string,
        @Body() dto: ToolPermissionDto,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.registry.setToolPermissions(agentId, [dto], user.tenantId!);
    }

    @Get(':agentId/health')
    @ApiOperation({ summary: 'Get health/status of a Hermes agent' })
    async getHealth(
        @Param('agentId') agentId: string,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.registry.getHealth(agentId, user.tenantId!);
    }
}
