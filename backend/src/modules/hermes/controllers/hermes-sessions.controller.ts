import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ApiCommon } from '../../../common/decorators/api-common.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { HermesRuntimeService } from '../services/hermes-runtime.service';
import { HermesSessionService } from '../services/hermes-session.service';
import { HermesTenantGuard } from '../guards/hermes-tenant.guard';
import {
  CreateSessionDto,
  AddMessageDto,
  ExecuteTaskDto,
} from '../dto/create-session.dto';
import type { JwtPayload } from '../../auth/interfaces/token.interface';

@Controller({ path: 'hermes/sessions', version: '1' })
@ApiCommon('Hermes Sessions')
@UseGuards(HermesTenantGuard)
export class HermesSessionsController {
  constructor(
    private readonly runtimeService: HermesRuntimeService,
    private readonly sessionService: HermesSessionService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a Hermes session' })
  async createSession(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSessionDto,
  ) {
    return this.runtimeService.createSession(
      dto.hermesAgentId,
      user.sub,
      user.tenantId!,
      dto.workspaceId,
    );
  }

  @Post(':sessionId/execute')
  @ApiOperation({ summary: 'Execute a task in a Hermes session' })
  async executeTask(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId') sessionId: string,
    @Body() dto: ExecuteTaskDto,
  ) {
    const session = await this.sessionService.findById(
      sessionId,
      user.tenantId!,
    );

    if (!session) {
      return {
        success: false,
        error: 'Session not found',
        errorCode: 'HERMES_SESSION_NOT_FOUND',
      };
    }

    return this.runtimeService.execute({
      sessionId,
      hermesAgentId: session.hermesAgentId,
      task: dto.task,
      context: {
        tenantId: user.tenantId!,
        userId: user.sub,
        threadId: session.threadId,
      },
      tools: dto.tools,
      maxIterations: dto.maxIterations,
      temperature: dto.temperature,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List sessions for current user' })
  async listSessions(@CurrentUser() user: JwtPayload) {
    return this.sessionService.findByUser(
      user.sub,
      user.tenantId!,
    );
  }

  @Get('agent/:agentId')
  @ApiOperation({ summary: 'List sessions for an agent' })
  async listAgentSessions(
    @CurrentUser() user: JwtPayload,
    @Param('agentId') agentId: string,
  ) {
    return this.sessionService.findByAgent(
      agentId,
      user.tenantId!,
    );
  }

  @Get(':sessionId')
  @ApiOperation({ summary: 'Get session with messages' })
  async getSession(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId') sessionId: string,
  ) {
    return this.sessionService.findById(
      sessionId,
      user.tenantId!,
    );
  }

  @Get(':sessionId/messages')
  @ApiOperation({ summary: 'Get session messages' })
  async getMessages(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId') sessionId: string,
  ) {
    return this.sessionService.getMessages(
      sessionId,
      user.tenantId!,
    );
  }

  @Post(':sessionId/messages')
  @ApiOperation({ summary: 'Add a message to a session' })
  async addMessage(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId') sessionId: string,
    @Body() dto: AddMessageDto,
  ) {
    return this.sessionService.addMessage({
      sessionId,
      role: dto.role as any,
      content: dto.content,
      toolCalls: dto.toolCalls,
      toolResults: dto.toolResults,
      error: dto.error,
      metadata: dto.metadata,
    });
  }

  @Patch(':sessionId/close')
  @ApiOperation({ summary: 'Close a session' })
  async closeSession(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId') sessionId: string,
  ) {
    await this.sessionService.closeSession(
      sessionId,
      user.tenantId!,
    );
    return { success: true };
  }

  @Delete(':sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a session' })
  async deleteSession(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId') sessionId: string,
  ) {
    const session = await this.sessionService.findById(
      sessionId,
      user.tenantId!,
    );

    if (session) {
      await this.sessionService.closeSession(
        sessionId,
        user.tenantId!,
      );
    }
  }
}
