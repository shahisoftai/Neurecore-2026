import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { ActivityService } from '../hermes/services/activity.service';

@Controller({ path: 'activity', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('since') since?: string,
    @Query('severity') severity?: string,
    @Query('agentId') agentId?: string,
  ) {
    return {
      status: 'success',
      data: {
        events: await this.activityService.list(user.tenantId ?? '', {
          userId: user.sub,
          agentId,
          limit: limit ? parseInt(limit, 10) : 50,
          before,
          since,
          severity,
        }),
      },
    };
  }
}
