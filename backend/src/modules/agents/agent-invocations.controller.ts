import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { ServiceIdentityScope, ServiceIdentityGuard } from '../../common/auth/service-identity/service-identity.guard';
import { AgentInvocationsService } from './services/agent-invocations.service';
import { AgentInvocationDto } from './dto/agent-invocation.dto';

/**
 * Phase 2 — Agent invocation endpoint.
 *
 * POST /api/v1/agents/:id/invocations
 *
 * This endpoint is the single entry point for calling the configured
 * LLM with structured output and a bounded repair pass. The simulation
 * framework calls this; human users could also call it directly.
 *
 * Auth: BOTH JwtAuthGuard AND ServiceIdentityGuard, so it can be invoked
 * by either a logged-in user or a service identity token.
 *
 * The `metadata.simulationId` field is the simulation tag used to scope
 * the persisted HermesMessage for the simulation overview.
 */
@Controller('v1/agents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentInvocationsController {
  constructor(private readonly service: AgentInvocationsService) {}

  @Post(':id/invocations')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.USER)
  @ServiceIdentityScope('simulation-engine')
  @HttpCode(HttpStatus.OK)
  async invoke(
    @CurrentUser() user: { id: string; tenantId: string; serviceIdentityId?: string },
    @Param('id', ParseUUIDPipe) agentId: string,
    @Body() dto: AgentInvocationDto,
  ) {
    return this.service.invoke(user.tenantId, agentId, dto, {
      simulationId: dto.metadata?.simulationId,
      threadId: dto.metadata?.threadId,
      userId: user.id,
    });
  }
}