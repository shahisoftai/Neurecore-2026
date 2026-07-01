/**
 * WidgetsController — Phase 4 / EAOS-2 wire endpoints.
 *
 * Routes:
 *   GET    /api/v1/widgets                                list all built-in widgets
 *   GET    /api/v1/widgets/:id                           get a single widget definition
 *   POST   /api/v1/widgets/:id/compute                   compute a widget value for an entity
 *   GET    /api/v1/widgets/layout/:entityType            load current user's saved layout
 *   POST   /api/v1/widgets/layout/:entityType            save current user's layout
 *
 * All endpoints are tenant-scoped via TenantContextService. RBAC: any
 * authenticated user can list/read widgets; layout is per-user.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WidgetsService } from './widgets.service';
import {
  ComputeWidgetResponseDto,
  ListWidgetsQueryDto,
  SaveLayoutDto,
  SaveLayoutResponseDto,
} from './dto/widget.dto';
import type { EaosEntityTypeForWidget } from './widget-definition';
import { assertValidEntityType } from './dto/entity-type.validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';

interface AuthedRequest extends Request {
  user?: { id?: string; userId?: string; tenantId?: string };
}

function resolveUserId(req: AuthedRequest): string {
  const id = req.user?.id ?? req.user?.userId;
  if (!id) throw new Error('WidgetsController: user id missing from request');
  return id;
}

@ApiTags('widgets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'widgets', version: '1' })
export class WidgetsController {
  constructor(
    private readonly widgets: WidgetsService,
  ) { }

  @Get()
  @ApiOperation({ summary: 'List all available widget definitions' })
  @ApiResponse({ status: 200, description: 'Widget definitions' })
  list(@Query() query: ListWidgetsQueryDto) {
    if (query.entityType) {
      const t = assertValidEntityType(query.entityType);
      return this.widgets.listForEntityType(t);
    }
    return this.widgets.listAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single widget definition by id' })
  @ApiResponse({ status: 200, description: 'Widget definition' })
  @ApiResponse({ status: 404, description: 'Widget not found' })
  getOne(@Param('id') id: string) {
    const w = this.widgets.getDefinition(id);
    if (!w) {
      return { statusCode: 404, message: `Widget ${id} not found` };
    }
    return w;
  }

  @Post(':id/compute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Compute a widget value for a given entity (type + id)',
  })
  @ApiResponse({ status: 200, type: ComputeWidgetResponseDto })
  async compute(
    @Param('id') id: string,
    @Body() body: { type: string; entityId: string; params?: Record<string, unknown> },
    @CurrentUser() user: JwtPayload,
  ): Promise<ComputeWidgetResponseDto> {
    if (!user.tenantId) throw new Error('Tenant ID required');
    const type = assertValidEntityType(body.type);
    const result = await this.widgets.computeForEntity(
      id,
      type,
      body.entityId,
      user.tenantId,
      body.params,
    );
    return result as unknown as ComputeWidgetResponseDto;
  }

  @Get('layout/:entityType')
  @ApiOperation({ summary: 'Load the current user saved layout for an entity type' })
  @ApiResponse({ status: 200, description: 'Saved grid items (empty array if none)' })
  async getLayout(
    @Param('entityType') entityType: string,
    @Req() req: AuthedRequest,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    const userId = resolveUserId(req);
    const t = assertValidEntityType(entityType);
    return this.widgets.getLayout(userId, user.tenantId, t);
  }

  @Post('layout/:entityType')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save the current user layout for an entity type' })
  @ApiResponse({ status: 200, type: SaveLayoutResponseDto })
  async saveLayout(
    @Param('entityType') entityType: string,
    @Body() body: SaveLayoutDto,
    @Req() req: AuthedRequest,
    @CurrentUser() user: JwtPayload,
  ): Promise<SaveLayoutResponseDto> {
    if (!user.tenantId) throw new Error('Tenant ID required');
    const userId = resolveUserId(req);
    const t = assertValidEntityType(entityType);
    const result = await this.widgets.saveLayout(
      userId,
      user.tenantId,
      t,
      body.items,
      body.density,
    );
    return result as SaveLayoutResponseDto;
  }
}