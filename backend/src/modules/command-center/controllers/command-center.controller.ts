/**
 * command-center.controller.ts - REST endpoints for command center dashboard
 *
 * SOLID - SRP: Exposes only command center aggregation endpoints
 * - GET /command-center/summary - Aggregated dashboard summary
 * - GET /command-center/timeline - Impact-sorted event timeline
 */

import {
    Controller,
    Get,
    Query,
    HttpStatus,
    HttpCode,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CommandCenterService } from '../services/command-center.service';
import { HermesTenantGuard } from '../../hermes/guards/hermes-tenant.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/token.interface';

@ApiTags('Command Center')
@ApiBearerAuth()
@Controller({ path: 'command-center', version: '1' })
@UseGuards(HermesTenantGuard)
export class CommandCenterController {
    constructor(private readonly commandCenterService: CommandCenterService) { }

    /**
     * GET /command-center/summary
     *
     * Returns aggregated dashboard data:
     * - Active agents count
     * - Pending tasks/workflows
     * - Approvals pending
     * - Monthly costs
     * - Recent activity
     */
    @Get('summary')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get command center dashboard summary' })
    async getSummary(@CurrentUser() user: JwtPayload) {
        return this.commandCenterService.getCommandCenterSummary(user.tenantId!);
    }

    /**
     * GET /command-center/timeline
     *
     * Returns impact-sorted timeline of events:
     * - Approval requests needing action
     * - Task completions/failures
     * - Agent status changes
     * - Critical alerts
     *
     * Query Parameters:
     * - sort: 'impact' | 'recent' | 'priority' (default: 'impact')
     * - filter: 'all' | 'urgent' | 'my-action' | 'opportunities' | 'blockers'
     * - search: search term for event title/description
     * - limit: max results (default: 20)
     * - page: pagination (default: 1)
     */
    @Get('timeline')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get impact timeline for command center' })
    async getTimeline(
        @CurrentUser() user: JwtPayload,
        @Query('sort') sort: 'impact' | 'recent' | 'priority' = 'impact',
        @Query('filter') filter: 'all' | 'urgent' | 'my-action' | 'opportunities' | 'blockers' = 'urgent',
        @Query('search') search?: string,
        @Query('limit') limit = '20',
        @Query('page') page = '1',
    ) {
        return this.commandCenterService.getTimelineEvents(user.tenantId!, {
            sort,
            filter,
            search,
            limit: Math.max(1, Math.min(100, parseInt(limit, 10))),
            page: Math.max(1, parseInt(page, 10)),
        });
    }
}
