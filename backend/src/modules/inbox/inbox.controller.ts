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
import { InboxService } from './inbox.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { IsIn, IsOptional, IsString } from 'class-validator';

class SendNotificationDto {
  @IsString()
  userId!: string;

  @IsString()
  kind!: 'APPROVAL' | 'FAILED_TASK' | 'AGENT_ALERT' | 'BUDGET_ALERT' | 'MENTION' | 'SYSTEM';

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  @IsString()
  entityType!: string;

  @IsString()
  entityId!: string;

  @IsOptional()
  @IsString()
  actionUrl?: string;
}

@ApiCommon('inbox')
@Controller({ path: 'inbox', version: '1' })
@UseGuards(JwtAuthGuard)
export class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  @Get()
  async getInbox(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: 'UNREAD' | 'READ' | 'ARCHIVED',
    @Query('kind') kind?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.inboxService.getInbox(user.sub, user.tenantId, {
      status,
      kind,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('summary')
  async getInboxSummary(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.inboxService.getInboxSummary(user.sub, user.tenantId);
  }

  @Get(':id')
  async getInboxItem(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.inboxService.getInboxItem(id);
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.inboxService.markRead(id, user.sub, user.tenantId);
  }

  @Patch(':id/archive')
  async markArchived(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.inboxService.markArchived(id, user.sub, user.tenantId);
  }

  @Post('mark-all-read')
  async markAllRead(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.inboxService.markAllRead(user.sub, user.tenantId);
  }

  @Post('send')
  async sendNotification(
    @Body() dto: SendNotificationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.inboxService.sendNotification(dto.userId, user.tenantId, {
      kind: dto.kind,
      title: dto.title,
      body: dto.body,
      priority: dto.priority,
      entityType: dto.entityType,
      entityId: dto.entityId,
      actionUrl: dto.actionUrl,
    });
  }

  @Post('broadcast')
  async broadcastNotification(
    @Body() body: { userIds: string[]; notification: SendNotificationDto },
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.inboxService.broadcastNotification(body.userIds, user.tenantId, {
      kind: body.notification.kind,
      title: body.notification.title,
      body: body.notification.body,
      priority: body.notification.priority,
      entityType: body.notification.entityType,
      entityId: body.notification.entityId,
      actionUrl: body.notification.actionUrl,
    });
  }

  @Delete('cleanup')
  async cleanupOldItems(@Query('days') days?: string) {
    return this.inboxService.cleanupOldItems(days ? parseInt(days, 10) : 30);
  }
}
