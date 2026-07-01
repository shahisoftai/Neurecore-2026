import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  Redirect,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { IntegrationsService } from './integrations.service';
import { ConnectGoogleDto, ConnectBrevoDto } from './dto/integration.dto';
import { GoogleGmailService } from './google/google-gmail.service';
import type { SendEmailInput } from './google/google-gmail.service';
import { GoogleCalendarService } from './google/google-calendar.service';
import type { CreateEventInput } from './google/google-calendar.service';
import { GoogleDriveService } from './google/google-drive.service';
import { BrevoUsageService } from './brevo/brevo-usage.service';
import { Public } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';

type CreateEventBody = CreateEventInput;

@ApiCommon('integrations')
@Controller({ path: 'integrations', version: '1' })
export class IntegrationsController {
  private readonly logger = new Logger(IntegrationsController.name);

  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly gmailService: GoogleGmailService,
    private readonly calendarService: GoogleCalendarService,
    private readonly driveService: GoogleDriveService,
    private readonly brevoUsage: BrevoUsageService,
  ) {}

  @Get()
  async listIntegrations(@CurrentUser() user: JwtPayload) {
    return this.integrationsService.listIntegrations(user.tenantId!);
  }

  @Get('google/status')
  async getGoogleStatus(@CurrentUser() user: JwtPayload) {
    return this.integrationsService.getGoogleConnectionStatus(user.tenantId!);
  }

  @Get('brevo/status')
  async getBrevoStatus(@CurrentUser() user: JwtPayload) {
    return this.integrationsService.getBrevoConnectionStatus(user.tenantId!);
  }

  @Get('usage/brevo')
  async getBrevoUsage(@CurrentUser() user: JwtPayload) {
    return this.brevoUsage.getStatus(user.tenantId!);
  }

  @Post('google/authorize')
  @HttpCode(HttpStatus.OK)
  async authorizeGoogle(@Body() dto: ConnectGoogleDto, @CurrentUser() user: JwtPayload) {
    return this.integrationsService.initiateGoogleOAuth(user.tenantId!, dto.redirectUri);
  }

  @Public()
  @Get('google/callback')
  @Redirect(undefined, 302)
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
  ) {
    if (error) {
      const encoded = Buffer.from(`Google OAuth error: ${error}`).toString('base64');
      return { url: `/settings/integrations?error=${encoded}` };
    }
    if (!code || !state) {
      const encoded = Buffer.from('Missing code or state parameter').toString('base64');
      return { url: `/settings/integrations?error=${encoded}` };
    }
    try {
      const result = await this.integrationsService.handleGoogleCallback(code, state);
      const params = new URLSearchParams({
        connected: String(result.connected),
        ...(result.email ? { email: result.email } : {}),
      });
      return { url: `/settings/integrations?${params.toString()}` };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OAuth failed';
      const encoded = Buffer.from(message).toString('base64');
      return { url: `/settings/integrations?error=${encoded}` };
    }
  }

  @Post('google/disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnectGoogle(@CurrentUser() user: JwtPayload) {
    await this.integrationsService.disconnectGoogle(user.tenantId!);
    return { success: true };
  }

  @Post('brevo/connect')
  @HttpCode(HttpStatus.OK)
  async connectBrevo(@Body() dto: ConnectBrevoDto, @CurrentUser() user: JwtPayload) {
    return this.integrationsService.connectBrevo(user.tenantId!, dto.apiKey);
  }

  @Post('brevo/disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnectBrevo(@CurrentUser() user: JwtPayload) {
    await this.integrationsService.disconnectBrevo(user.tenantId!);
    return { success: true };
  }

  // ─── Gmail endpoints ────────────────────────────────────────

  @Get('gmail/inbox')
  async getInbox(
    @CurrentUser() user: JwtPayload,
    @Query('maxResults') maxResults?: string,
    @Query('pageToken') pageToken?: string,
    @Query('q') q?: string,
  ) {
    return this.gmailService.listInbox(user.tenantId!, {
      maxResults: maxResults ? Number(maxResults) : undefined,
      pageToken,
      q,
    });
  }

  @Get('gmail/messages/:id')
  async getMessage(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.gmailService.getMessage(id, user.tenantId!);
  }

  @Get('gmail/messages/:id/body')
  async getMessageBody(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.gmailService.getMessageBody(id, user.tenantId!);
  }

  @Post('gmail/send')
  @HttpCode(HttpStatus.OK)
  async sendEmail(@CurrentUser() user: JwtPayload, @Body() body: SendEmailInput & { tenantId?: string }) {
    return this.gmailService.sendEmail(user.tenantId!, body);
  }

  @Get('gmail/labels')
  async getLabels(@CurrentUser() user: JwtPayload) {
    return this.gmailService.listLabels(user.tenantId!);
  }

  // ─── Calendar endpoints ─────────────────────────────────────

  @Get('calendar/events')
  async getEvents(
    @CurrentUser() user: JwtPayload,
    @Query('calendarId') calendarId?: string,
    @Query('maxResults') maxResults?: string,
    @Query('timeMin') timeMin?: string,
    @Query('timeMax') timeMax?: string,
    @Query('q') q?: string,
  ) {
    return this.calendarService.listEvents(user.tenantId!, {
      calendarId,
      maxResults: maxResults ? Number(maxResults) : undefined,
      timeMin,
      timeMax,
      q,
    });
  }

  @Post('calendar/events')
  @HttpCode(HttpStatus.OK)
  async createEvent(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateEventBody,
    @Query('calendarId') calendarId?: string,
  ) {
    return this.calendarService.createEvent(user.tenantId!, body, calendarId);
  }

  @Delete('calendar/events/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEvent(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Query('calendarId') calendarId?: string,
  ) {
    await this.calendarService.deleteEvent(id, user.tenantId!, calendarId);
  }

  @Get('calendar/list')
  async getCalendarList(@CurrentUser() user: JwtPayload) {
    return this.calendarService.listCalendars(user.tenantId!);
  }

  // ─── Drive endpoints ────────────────────────────────────────

  @Get('drive/folders/agents')
  async listAgentFolders(@CurrentUser() user: JwtPayload) {
    return this.driveService.listAgentFolders(user.tenantId!);
  }

  @Get('google/drive-folders')
  async getGoogleDriveFolders(@CurrentUser() user: JwtPayload) {
    return this.driveService.listRootTree(user.tenantId!);
  }

  @Post('drive/folders/agents/:agentId/setup')
  @HttpCode(HttpStatus.OK)
  async setupAgentFolders(
    @Param('agentId') agentId: string,
    @CurrentUser() user: JwtPayload,
    @Body('agentName') agentName: string,
  ) {
    return this.driveService.setupAgentFolders(user.tenantId!, agentId, agentName);
  }

  @Get('drive/folders/:folderId/files')
  async listDriveFiles(@Param('folderId') folderId: string, @CurrentUser() user: JwtPayload) {
    return this.driveService.listFiles(user.tenantId!, folderId);
  }

  @Post('drive/folders')
  @HttpCode(HttpStatus.OK)
  async createDriveFolder(@CurrentUser() user: JwtPayload, @Body() body: { name: string; parentId?: string }) {
    return this.driveService.createFolder(user.tenantId!, body);
  }

  @Post('drive/files')
  @HttpCode(HttpStatus.OK)
  async createDriveFile(
    @CurrentUser() user: JwtPayload,
    @Body() body: { name: string; content: string; mimeType?: string; parentId?: string },
  ) {
    return this.driveService.createFile(user.tenantId!, body);
  }
}
