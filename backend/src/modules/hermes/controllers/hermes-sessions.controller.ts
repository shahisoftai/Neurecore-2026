/**
 * hermes-sessions.controller.ts — REST endpoints for Hermes session management.
 *
 * SOLID — SRP: Only exposes session lifecycle operations.
 */

import {
    Controller,
    Get,
    Post,
    Delete,
    Param,
    Body,
    Query,
    HttpCode,
    HttpStatus,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HermesSessionService } from '../services/hermes-session.service';
import { HermesRuntimeService } from '../services/hermes-runtime.service';
import { HermesTenantGuard } from '../guards/hermes-tenant.guard';
import { CreateSessionDto } from '../dto/create-session.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/token.interface';

@ApiTags('Hermes Sessions')
@ApiBearerAuth()
@Controller({ path: 'hermes/sessions', version: '1' })
@UseGuards(HermesTenantGuard)
export class HermesSessionsController {
    constructor(
        private readonly sessions: HermesSessionService,
        private readonly runtime: HermesRuntimeService,
    ) { }

    @Post()
    @ApiOperation({ summary: 'Create a new Hermes conversation session' })
    async create(
        @Body() dto: CreateSessionDto,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.runtime.createSession(
            dto.hermesAgentId,
            user.sub,
            user.tenantId!,
            dto.workspaceId,
        );
    }

    @Get()
    @ApiOperation({ summary: 'List sessions for the current user' })
    async findAll(
        @CurrentUser() user: JwtPayload,
        @Query('agentId') agentId?: string,
    ) {
        if (agentId) {
            return this.sessions.findByAgent(agentId, user.tenantId!);
        }
        return [];
    }

    @Get(':sessionId')
    @ApiOperation({ summary: 'Get session by ID' })
    async findById(
        @Param('sessionId') sessionId: string,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.sessions.findById(sessionId, user.tenantId!);
    }

    @Post(':sessionId/messages')
    @ApiOperation({ summary: 'Send a task/message to a Hermes session' })
    async sendMessage(
        @Param('sessionId') sessionId: string,
        @Body() body: { task: string; tools?: string[] },
        @CurrentUser() user: JwtPayload,
    ) {
        const session = await this.sessions.findById(sessionId, user.tenantId!);
        if (!session) {
            return { success: false, error: 'Session not found' };
        }

        return this.runtime.execute({
            sessionId,
            hermesAgentId: session.hermesAgentId,
            task: body.task,
            context: {
                tenantId: user.tenantId!,
                userId: user.sub,
                threadId: session.threadId,
            },
            tools: body.tools,
        });
    }

    @Delete(':sessionId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'End/expire a Hermes session' })
    async expire(
        @Param('sessionId') sessionId: string,
        @CurrentUser() user: JwtPayload,
    ) {
        await this.sessions.archive(sessionId, user.tenantId!);
    }
}
