import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../modules/auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { IdempotencyKey } from '../common/idempotency/idempotency-key.decorator';
import { ServiceIdentityScope, ServiceIdentityGuard } from '../common/auth/service-identity/service-identity.guard';
import { SimulationsService } from './simulations.service';
import { SimulationsDayRunner } from './simulations.day-runner';
import { IdempotencyService } from '../common/idempotency/idempotency.service';

/**
 * SimulationsController — Phase 1 (Simulation-5).
 *
 * Endpoints:
 *   POST /api/v1/simulations                  — create a simulation (human user)
 *   GET  /api/v1/simulations                  — list this tenant's simulations
 *   GET  /api/v1/simulations/:id              — get one simulation
 *   POST /api/v1/simulations/:id/days/:day/run — run one day (service identity)
 */
@Controller('v1/simulations')
export class SimulationsController {
  constructor(
    private readonly sims: SimulationsService,
    private readonly dayRunner: SimulationsDayRunner,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: { id: string; tenantId: string },
    @IdempotencyKey() key: string,
    @Body() body: any,
  ) {
    if (!user?.tenantId || !user?.id) {
      throw new BadRequestException({ code: 'NO_AUTH_CONTEXT' });
    }
    return this.idempotency.run(
      { tenantId: user.tenantId, key, requestPath: '/api/v1/simulations', requestBody: body ?? {} },
      { handler: async () => ({ status: 201, body: await this.sims.create({ ...body, tenantId: user.tenantId }) }) },
    ).then((r) => r.body);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@CurrentUser() user: { tenantId: string }) {
    return this.sims.list(user.tenantId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async get(@CurrentUser() user: { tenantId: string }, @Param('id') id: string) {
    const simId = decodeURIComponent(id);
    return this.sims.get(user.tenantId, simId);
  }

  @Post(':id/days/:day/run')
  @UseGuards(JwtAuthGuard, ServiceIdentityGuard)
  @ServiceIdentityScope('simulation-engine')
  @HttpCode(HttpStatus.OK)
  async runDay(
    @CurrentUser() user: { id?: string; tenantId?: string },
    @Param('id') id: string,
    @Param('day') dayParam: string,
    @IdempotencyKey() key: string,
    @Body() body: any,
  ) {
    const tenantId = user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException({ code: 'NO_AUTH_CONTEXT' });
    }
    const simulationId = decodeURIComponent(id);
    const day = parseInt(dayParam, 10);
    if (Number.isNaN(day) || day < 1 || day > 60) {
      throw new BadRequestException({ code: 'INVALID_DAY' });
    }
    if (!body?.expectedVersions || !body?.actorUserId) {
      throw new BadRequestException({
        code: 'MISSING_FIELDS',
        message: 'expectedVersions and actorUserId are required.',
      });
    }

    return this.idempotency.run(
      { tenantId, key, requestPath: '/api/v1/simulations/' + simulationId + '/days/' + day + '/run', requestBody: body ?? {} },
      { handler: async () => ({
          status: 200,
          body: await this.dayRunner.runDay({
            tenantId,
            simulationId,
            day,
            expectedVersions: body.expectedVersions,
            actorUserId: body.actorUserId,
          }),
        }) },
    ).then((r) => r.body);
  }
}