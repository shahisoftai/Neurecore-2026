import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ApiCommon } from '../../../common/decorators/api-common.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { HermesRegistryService } from '../services/hermes-registry.service';
import { HermesTenantGuard } from '../guards/hermes-tenant.guard';
import {
  RegisterAgentDto,
  UpdateAgentDto,
  AddCapabilityDto,
  UpdateToolPermissionDto,
} from '../dto/register-agent.dto';
import type { HermesAgentType } from '@prisma/client';
import type { JwtPayload } from '../../auth/interfaces/token.interface';

@Controller({ path: 'hermes/agents', version: '1' })
@ApiCommon('Hermes Registry')
@UseGuards(HermesTenantGuard)
export class HermesRegistryController {
  constructor(
    private readonly registryService: HermesRegistryService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Register a new Hermes agent' })
  async register(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RegisterAgentDto,
  ) {
    return this.registryService.register(dto, user.tenantId!);
  }

  @Get()
  @ApiOperation({ summary: 'List all Hermes agents for tenant' })
  async listAgents(@CurrentUser() user: JwtPayload) {
    return this.registryService.listAgents(user.tenantId!);
  }

  @Get(':agentId')
  @ApiOperation({ summary: 'Get Hermes agent by ID' })
  async getAgent(
    @CurrentUser() user: JwtPayload,
    @Param('agentId') agentId: string,
  ) {
    return this.registryService.findById(agentId, user.tenantId!);
  }

  @Get('type/:type')
  @ApiOperation({ summary: 'Find Hermes agents by type' })
  async findByType(
    @CurrentUser() user: JwtPayload,
    @Param('type') type: HermesAgentType,
  ) {
    return this.registryService.findByType(type, user.tenantId!);
  }

  @Get('capability/:capability')
  @ApiOperation({ summary: 'Find Hermes agents by capability' })
  async findByCapability(
    @CurrentUser() user: JwtPayload,
    @Param('capability') capability: string,
  ) {
    return this.registryService.findByCapability(
      capability,
      user.tenantId!,
    );
  }

  @Patch(':agentId')
  @ApiOperation({ summary: 'Update Hermes agent' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('agentId') agentId: string,
    @Body() dto: UpdateAgentDto,
  ) {
    return this.registryService.update(
      agentId,
      user.tenantId!,
      dto,
    );
  }

  @Delete(':agentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unregister Hermes agent' })
  async unregister(
    @CurrentUser() user: JwtPayload,
    @Param('agentId') agentId: string,
  ) {
    await this.registryService.unregister(
      agentId,
      user.tenantId!,
    );
  }

  @Post(':agentId/capabilities')
  @ApiOperation({ summary: 'Add or update a capability' })
  async addCapability(
    @CurrentUser() user: JwtPayload,
    @Param('agentId') agentId: string,
    @Body() dto: AddCapabilityDto,
  ) {
    await this.registryService.updateCapability(
      agentId,
      user.tenantId!,
      dto,
    );
    return { success: true };
  }

  @Delete(':agentId/capabilities/:name')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a capability' })
  async removeCapability(
    @CurrentUser() user: JwtPayload,
    @Param('agentId') agentId: string,
    @Param('name') name: string,
  ) {
    await this.registryService.removeCapability(
      agentId,
      user.tenantId!,
      name,
    );
  }

  @Patch(':agentId/tools')
  @ApiOperation({ summary: 'Update tool permission' })
  async updateToolPermission(
    @CurrentUser() user: JwtPayload,
    @Param('agentId') agentId: string,
    @Body() dto: UpdateToolPermissionDto,
  ) {
    await this.registryService.updateToolPermission(
      agentId,
      user.tenantId!,
      dto.toolName,
      dto.permission,
      dto.conditions,
    );
    return { success: true };
  }
}
