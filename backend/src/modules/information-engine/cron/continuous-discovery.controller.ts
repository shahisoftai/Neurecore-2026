/**
 * Continuous Discovery — Controller (Phase 2F)
 *
 * Two endpoints:
 *   - POST /v1/projects/:id/validate-completeness
 *     Throws BadRequest if score < 100; returns the snapshot on success.
 *   - POST /v1/discovery/weekly-recompute  (admin)
 *     Manually trigger the weekly job. Useful for ops + tests.
 *
 * Note: 2F also wires recompute hooks into ProjectStagesService.update and
 * DeliverablesService.submit — those are injected into the existing services
 * via the ContinuousDiscoveryModule providers (see continuous-discovery.module.ts).
 */

import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCommon } from '../../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ContinuousDiscoveryService } from './continuous-discovery.service';

@Controller({ path: '', version: '1' })
@ApiCommon('information-engine-continuous-discovery')
@UseGuards(JwtAuthGuard)
export class ContinuousDiscoveryController {
  constructor(private readonly service: ContinuousDiscoveryService) {}

  @Post('projects/:projectId/validate-completeness')
  @HttpCode(HttpStatus.OK)
  async validate(@Param('projectId') projectId: string) {
    return this.service.validate(projectId);
  }

  @Post('discovery/weekly-recompute')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  async weeklyRecompute() {
    return this.service.weeklyRecomputeAll();
  }
}