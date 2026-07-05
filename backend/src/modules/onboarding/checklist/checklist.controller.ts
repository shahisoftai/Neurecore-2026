import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ApiCommon } from '../../../common/decorators/api-common.decorator';
import type { JwtPayload } from '../../auth/interfaces/token.interface';
import { ChecklistService } from './checklist.service';
import {
  DismissAllChecklistDto,
  DismissChecklistEntryDto,
  SaveChecklistEntryDto,
  SkipChecklistEntryDto,
} from './dto/checklist.dto';

@Controller({ path: 'onboarding/checklist', version: '1' })
@ApiCommon('onboarding-checklist')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.OWNER,
  UserRole.ADMIN,
)
export class ChecklistController {
  constructor(private readonly checklist: ChecklistService) {}

  private requireTenant(user: JwtPayload): string {
    if (!user.tenantId) {
      throw new Error('User has no tenant context');
    }
    return user.tenantId;
  }

  @Get()
  @ApiOperation({
    summary: 'List onboarding checklist entries + mission feed items',
  })
  async list(@CurrentUser() user: JwtPayload) {
    return this.checklist.list(this.requireTenant(user));
  }

  @Post(':slug/save')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Autosave partial wizard payload (no state change)',
  })
  async save(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Body() dto: SaveChecklistEntryDto,
  ) {
    return this.checklist.save(this.requireTenant(user), slug, dto.payload);
  }

  @Post(':slug/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark wizard complete (DONE state)' })
  async complete(@CurrentUser() user: JwtPayload, @Param('slug') slug: string) {
    return this.checklist.complete(this.requireTenant(user), slug, user.sub);
  }

  @Post(':slug/skip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark wizard skipped (SKIPPED state)' })
  async skip(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Body() dto: SkipChecklistEntryDto,
  ) {
    return this.checklist.skip(
      this.requireTenant(user),
      slug,
      user.sub,
      dto.reason,
    );
  }

  @Post(':slug/dismiss')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hide wizard from panel (dismiss mission feed item)',
  })
  async dismiss(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Body() dto: DismissChecklistEntryDto,
  ) {
    return this.checklist.dismiss(
      this.requireTenant(user),
      slug,
      user.sub,
      dto.reason,
    );
  }

  @Post('dismiss-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Globally hide the Things-to-do panel' })
  async dismissAll(
    @CurrentUser() user: JwtPayload,
    @Body() dto: DismissAllChecklistDto,
  ) {
    return this.checklist.dismissAll(this.requireTenant(user), dto.dismissed);
  }
}
