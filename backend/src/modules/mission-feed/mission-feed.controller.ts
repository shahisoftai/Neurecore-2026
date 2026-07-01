import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { PaginatedResponse } from '../../common/responses/paginated.response';
import { MissionFeedService } from './services/mission-feed.service';
import { CreateMissionFeedItemDto } from './dto/mission-feed.dto';

@Controller({ path: 'mission-feed', version: '1' })
@ApiCommon('mission-feed')
export class MissionFeedController {
  constructor(private readonly missionFeed: MissionFeedService) {}

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
    UserRole.AUDITOR,
  )
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({
    summary: 'List Mission Feed items for the current user/tenant',
  })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('priority') priority?: string,
  ): Promise<PaginatedResponse<unknown>> {
    const result = await this.missionFeed.list({
      userId: user.sub,
      tenantId: user.tenantId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      priority,
    });
    return result;
  }

  @Post(':itemId/dismiss')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
    UserRole.AUDITOR,
  )
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dismiss a Mission Feed item' })
  async dismiss(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.missionFeed.dismiss(itemId, user.sub, user.tenantId);
  }

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.OWNER,
    UserRole.ADMIN,
  )
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a Mission Feed item (admin/seed)' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateMissionFeedItemDto) {
    return this.missionFeed.create(dto, user.tenantId);
  }
}
