import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { DigitalTwinService } from './digital-twin.service';
import { ActivityTimelineService } from './activity-timeline.service';

@Controller({ path: 'projects/:projectId', version: '1' })
@UseGuards(JwtAuthGuard)
export class DigitalTwinController {
  constructor(
    private readonly digitalTwinService: DigitalTwinService,
    private readonly activityTimelineService: ActivityTimelineService,
  ) {}

  @Get('digital-twin')
  async getDigitalTwin(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.digitalTwinService.synthesize(projectId, user.tenantId ?? '');
  }

  @Get('timeline')
  async getTimeline(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('types') types?: string,
  ) {
    return this.activityTimelineService.getTimeline(projectId, user.tenantId ?? '', {
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
      types: types ? types.split(',') : undefined,
    });
  }
}