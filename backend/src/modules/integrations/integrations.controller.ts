import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  Res,
  Headers,
  Req,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { IntegrationsService } from './integrations.service';
import { ConnectGoogleDto, ConnectBrevoDto } from './dto/integration.dto';
import { GoogleGmailService } from './google/google-gmail.service';
import type { SendEmailInput } from './google/google-gmail.service';
import { GoogleCalendarService } from './google/google-calendar.service';
import type { CreateEventInput } from './google/google-calendar.service';
import { GoogleDriveService } from './google/google-drive.service';
import { GoogleSheetsService } from './google/google-sheets.service';
import { GoogleDocsService } from './google/google-docs.service';
import { GoogleSlidesService } from './google/google-slides.service';
import { BrevoUsageService } from './brevo/brevo-usage.service';
import { BrevoEmailService } from './brevo/brevo-email.service';
import { BrevoWebhookService } from './brevo/brevo-webhook.service';
import { BrevoSuppressionService } from './brevo/brevo-suppression.service';
import { AdminBrevoService } from './brevo/admin-brevo.service';
import { Public } from '../../common/decorators/roles.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  readAudienceFromState,
  buildCallbackRedirectUrl,
  readOriginFromState,
} from './google/oauth-callback.util';
import { AuditService } from '../audit/audit.service';

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
    private readonly sheetsService: GoogleSheetsService,
    private readonly docsService: GoogleDocsService,
    private readonly slidesService: GoogleSlidesService,
    private readonly brevoUsage: BrevoUsageService,
    private readonly brevoEmail: BrevoEmailService,
    private readonly brevoWebhook: BrevoWebhookService,
    private readonly adminBrevo: AdminBrevoService,
    private readonly brevoSuppressions: BrevoSuppressionService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
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
  async authorizeGoogle(
    @Body() dto: ConnectGoogleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.integrationsService.initiateGoogleOAuth(
      user.tenantId!,
      dto.redirectUri,
      dto.audience ?? 'tenant',
      dto.origin ?? 'settings',
    );
  }

  @Public()
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
    @Res() res?: Response,
  ): Promise<void> {
    const audience = readAudienceFromState(state);
    const origin = readOriginFromState(state);
    const targetUrl = this.buildCallbackRedirectUrl(audience, origin);

    if (error) {
      const encoded = Buffer.from(`Google OAuth error: ${error}`).toString(
        'base64',
      );
      res!.redirect(302, this.appendQuery(targetUrl, { error: encoded }));
      return;
    }
    if (!code || !state) {
      const encoded = Buffer.from('Missing code or state parameter').toString(
        'base64',
      );
      res!.redirect(302, this.appendQuery(targetUrl, { error: encoded }));
      return;
    }
    try {
      const result = await this.integrationsService.handleGoogleCallback(
        code,
        state,
      );
      const params: Record<string, string> = {
        connected: String(result.connected),
      };
      if (result.email) params.email = result.email;
      res!.redirect(302, this.appendQuery(targetUrl, params));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OAuth failed';
      const encoded = Buffer.from(message).toString('base64');
      res!.redirect(302, this.appendQuery(targetUrl, { error: encoded }));
    }
  }

  private buildCallbackRedirectUrl(
    audience: 'tenant' | 'admin',
    origin: 'settings' | 'onboarding' = 'settings',
  ): string {
    const tenantBase =
      this.config.get<string>('TENANT_FRONTEND_BASE_URL') ??
      this.config.get<string>('FRONTEND_BASE_URL') ??
      process.env.FRONTEND_BASE_URL ??
      'https://hq.neurecore.com';
    const adminBase =
      this.config.get<string>('ADMIN_FRONTEND_BASE_URL') ??
      this.config.get<string>('ADMIN_BASE_URL') ??
      process.env.ADMIN_BASE_URL ??
      'https://cc.neurecore.com';
    return buildCallbackRedirectUrl({
      tenantBase,
      adminBase,
      audience,
      origin,
      query: {},
    });
  }

  private appendQuery(baseUrl: string, params: Record<string, string>): string {
    const entries = Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && v !== '',
    );
    if (entries.length === 0) return baseUrl;
    const search = new URLSearchParams(
      Object.fromEntries(entries.map(([k, v]) => [k, String(v)])),
    ).toString();
    return `${baseUrl}?${search}`;
  }

  @Post('google/disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnectGoogle(@CurrentUser() user: JwtPayload) {
    await this.integrationsService.disconnectGoogle(user.tenantId!);
    return { success: true };
  }

  @Post('brevo/connect')
  @HttpCode(HttpStatus.OK)
  async connectBrevo(
    @Body() dto: ConnectBrevoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.integrationsService.connectBrevo(user.tenantId!, dto.apiKey);
  }

  @Post('brevo/disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnectBrevo(@CurrentUser() user: JwtPayload) {
    await this.integrationsService.disconnectBrevo(user.tenantId!);
    this.brevoEmail.invalidate(user.tenantId!);
    return { success: true };
  }

  @Get('brevo/validate')
  async validateBrevo(@CurrentUser() user: JwtPayload) {
    return this.brevoEmail.validateApiKey(user.tenantId!);
  }

  @Post('brevo/test-send')
  @HttpCode(HttpStatus.OK)
  async testSendBrevo(
    @CurrentUser() user: JwtPayload,
    @Body() body: { to: string; subject?: string; htmlContent?: string },
  ) {
    if (!body?.to) {
      return { success: false, error: 'to is required' };
    }
    try {
      const result = await this.brevoEmail.sendEmail(user.tenantId!, {
        to: body.to,
        subject: body.subject ?? 'Neurecore Brevo test email',
        htmlContent:
          body.htmlContent ??
          '<p>This is a test email from Neurecore. If you received it, Brevo is configured correctly.</p>',
      });
      return { success: true, ...result };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message ?? 'Unknown error',
      };
    }
  }

  // Per-tenant sender identity (overrides EMAIL_FROM_ADDRESS env).

  @Get('brevo/sender')
  async getBrevoSender(@CurrentUser() user: JwtPayload) {
    const identity = await this.brevoEmail.getTenantIdentity(user.tenantId!);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId! },
      select: {
        brevoSenderEmail: true,
        brevoSenderName: true,
        brevoReplyToEmail: true,
      },
    });
    return {
      tenant: {
        brevoSenderEmail: tenant?.brevoSenderEmail ?? null,
        brevoSenderName: tenant?.brevoSenderName ?? null,
        brevoReplyToEmail: tenant?.brevoReplyToEmail ?? null,
      },
      resolved: identity,
    };
  }

  @Put('brevo/sender')
  @HttpCode(HttpStatus.OK)
  async setBrevoSender(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      brevoSenderEmail: string;
      brevoSenderName?: string;
      brevoReplyToEmail?: string;
    },
  ) {
    if (!body?.brevoSenderEmail) {
      return { success: false, error: 'brevoSenderEmail is required' };
    }
    if (!/.+@.+\..+/.test(body.brevoSenderEmail)) {
      return {
        success: false,
        error: 'brevoSenderEmail must be a valid email',
      };
    }
    await this.prisma.tenant.update({
      where: { id: user.tenantId! },
      data: {
        brevoSenderEmail: body.brevoSenderEmail,
        brevoSenderName: body.brevoSenderName ?? null,
        brevoReplyToEmail: body.brevoReplyToEmail ?? null,
      },
    });
    this.brevoEmail.invalidateIdentity(user.tenantId!);
    return { success: true };
  }

  @Delete('brevo/sender')
  @HttpCode(HttpStatus.OK)
  async clearBrevoSender(@CurrentUser() user: JwtPayload) {
    await this.prisma.tenant.update({
      where: { id: user.tenantId! },
      data: {
        brevoSenderEmail: null,
        brevoSenderName: null,
        brevoReplyToEmail: null,
      },
    });
    this.brevoEmail.invalidateIdentity(user.tenantId!);
    return { success: true };
  }

  // Bulk send — up to 50 recipients per call.

  @Post('brevo/send-batch')
  @HttpCode(HttpStatus.OK)
  async sendBrevoBatch(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      recipients: { to: string; variables?: Record<string, string> }[];
      subject: string;
      htmlContent: string;
      textContent?: string;
      signature?: string;
      tags?: string[];
    },
  ) {
    if (!body?.recipients || !Array.isArray(body.recipients)) {
      return { success: false, error: 'recipients (array) is required' };
    }
    try {
      const result = await this.brevoEmail.sendBatch(user.tenantId!, body);
      return { success: true, ...result };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message ?? 'Unknown error',
      };
    }
  }

  // Recent webhook events for the tenant (delivery / bounce / open / click).

  @Get('brevo/events')
  async listBrevoEvents(
    @CurrentUser() user: JwtPayload,
    @Query('messageId') messageId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.brevoWebhook.listRecent(user.tenantId!, {
      messageId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  // ─── Webhook (public; signed via BREVO_WEBHOOK_SECRET). ─────────────

  @Public()
  @Post('brevo/webhook')
  @HttpCode(HttpStatus.OK)
  async receiveBrevoWebhook(
    @Body() _body: unknown,
    @Headers('x-brevo-signature') headerSignature?: string,
    @Query('signature') querySignature?: string,
    @Req() req?: { rawBody?: Buffer },
  ): Promise<{ accepted: boolean; duplicate?: boolean; reason?: string }> {
    const raw = req?.rawBody?.toString('utf8') ?? '';
    const sig = headerSignature ?? querySignature;
    return this.brevoWebhook.handle(raw, sig);
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
    return this.gmailService.getMessage(user.tenantId!, id);
  }

  @Get('gmail/messages/:id/body')
  async getMessageBody(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.gmailService.getMessageBody(id, user.tenantId!);
  }

  @Post('gmail/send')
  @HttpCode(HttpStatus.OK)
  async sendEmail(
    @CurrentUser() user: JwtPayload,
    @Body() body: SendEmailInput & { tenantId?: string },
  ) {
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
    return this.driveService.setupAgentFolders(
      user.tenantId!,
      agentId,
      agentName,
    );
  }

  @Get('drive/folders/:folderId/files')
  async listDriveFiles(
    @Param('folderId') folderId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.driveService.listFiles(user.tenantId!, folderId);
  }

  @Post('drive/folders')
  @HttpCode(HttpStatus.OK)
  async createDriveFolder(
    @CurrentUser() user: JwtPayload,
    @Body() body: { name: string; parentId?: string },
  ) {
    return this.driveService.createFolder(user.tenantId!, body);
  }

  @Post('drive/files')
  @HttpCode(HttpStatus.OK)
  async createDriveFile(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      name: string;
      content: string;
      mimeType?: string;
      parentId?: string;
    },
  ) {
    return this.driveService.createFile(user.tenantId!, body);
  }

  // ─── Sheets endpoints ───────────────────────────────────────

  @Post('sheets')
  @HttpCode(HttpStatus.OK)
  async createSpreadsheet(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      title: string;
      sheets?: { title: string; rowCount?: number; columnCount?: number }[];
    },
  ) {
    return this.sheetsService.createSpreadsheet(user.tenantId!, body);
  }

  @Get('sheets/:spreadsheetId/metadata')
  async getSheetMetadata(
    @Param('spreadsheetId') spreadsheetId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sheetsService.getMetadata(user.tenantId!, spreadsheetId);
  }

  @Get('sheets/:spreadsheetId/values/:range')
  async readSheetRange(
    @Param('spreadsheetId') spreadsheetId: string,
    @Param('range') range: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sheetsService.readRange(user.tenantId!, spreadsheetId, range);
  }

  @Post('sheets/:spreadsheetId/values/:range')
  @HttpCode(HttpStatus.OK)
  async writeSheetRange(
    @Param('spreadsheetId') spreadsheetId: string,
    @Param('range') range: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { values: string[][]; majorDimension?: 'ROWS' | 'COLUMNS' },
  ) {
    return this.sheetsService.writeRange(user.tenantId!, {
      spreadsheetId,
      range,
      values: body.values,
      majorDimension: body.majorDimension,
    });
  }

  @Post('sheets/:spreadsheetId/values/:range/append')
  @HttpCode(HttpStatus.OK)
  async appendSheetRows(
    @Param('spreadsheetId') spreadsheetId: string,
    @Param('range') range: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { values: string[][] },
  ) {
    return this.sheetsService.appendRows(user.tenantId!, {
      spreadsheetId,
      range,
      values: body.values,
    });
  }

  @Post('sheets/:spreadsheetId/values/:range/clear')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearSheetRange(
    @Param('spreadsheetId') spreadsheetId: string,
    @Param('range') range: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.sheetsService.clearRange(user.tenantId!, spreadsheetId, range);
  }

  // ─── Google Docs endpoints ───────────────────────────────────────

  @Post('docs')
  @HttpCode(HttpStatus.OK)
  async createGoogleDoc(
    @CurrentUser() user: JwtPayload,
    @Body() body: { title: string; content?: string; parentId?: string },
  ) {
    return this.docsService.createDocument(user.tenantId!, body);
  }

  @Get('docs/:documentId')
  async getGoogleDoc(
    @Param('documentId') documentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.docsService.getDocument(user.tenantId!, documentId);
  }

  // ─── Google Slides endpoints ─────────────────────────────────────

  @Post('slides')
  @HttpCode(HttpStatus.OK)
  async createGoogleSlides(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      title: string;
      slides?: { title: string; body?: string }[];
      parentId?: string;
    },
  ) {
    return this.slidesService.createPresentation(user.tenantId!, body);
  }

  @Get('slides/:presentationId')
  async getGoogleSlides(
    @Param('presentationId') presentationId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.slidesService.getPresentation(user.tenantId!, presentationId);
  }

  @Get('drive/search')
  async searchDriveFiles(
    @CurrentUser() user: JwtPayload,
    @Query('q') q: string,
    @Query('pageSize') pageSize?: string,
    @Query('mimeType') mimeType?: string,
    @Query('mode') mode?: 'name' | 'fulltext',
  ) {
    return this.driveService.searchFiles(user.tenantId!, q, {
      pageSize: pageSize ? Number(pageSize) : undefined,
      mimeType,
      mode: mode ?? 'name',
    });
  }

  // ─── Drive permissions (G8) ──────────────────────────────────────

  @Post('drive/files/:fileId/permissions')
  @HttpCode(HttpStatus.OK)
  async shareDriveFile(
    @CurrentUser() user: JwtPayload,
    @Param('fileId') fileId: string,
    @Body()
    body: {
      role: 'reader' | 'writer' | 'commenter';
      type: 'user' | 'group' | 'domain' | 'anyone';
      emailAddress?: string;
      domain?: string;
      sendNotification?: boolean;
      emailMessage?: string;
    },
  ) {
    return this.driveService.shareFile(user.tenantId!, fileId, body);
  }

  @Get('drive/files/:fileId/permissions')
  async listDriveFilePermissions(
    @CurrentUser() user: JwtPayload,
    @Param('fileId') fileId: string,
  ) {
    return this.driveService.listFilePermissions(user.tenantId!, fileId);
  }

  @Delete('drive/files/:fileId/permissions/:permissionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeDriveFilePermission(
    @CurrentUser() user: JwtPayload,
    @Param('fileId') fileId: string,
    @Param('permissionId') permissionId: string,
  ) {
    await this.driveService.revokeFilePermission(
      user.tenantId!,
      fileId,
      permissionId,
    );
  }

  // ─── Platform-level Google status (admin dashboard) ──────────

  @Get('google/platform-status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  async getPlatformGoogleStatus(): Promise<{
    tenants: Array<{
      tenantId: string;
      tenantName: string;
      connected: boolean;
      email?: string;
      scopes?: string[];
      agentCount: number;
      driveFolderCount: number;
    }>;
    stats: {
      totalTenants: number;
      connectedTenants: number;
      totalAgentsWithDrive: number;
      scopeCoverage: Record<string, number>;
    };
  }> {
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const credentials = await this.prisma.integrationCredential.findMany({
      where: { provider: 'GOOGLE' },
    });

    const agentsWithDrive = await this.prisma.agent.groupBy({
      by: ['tenantId'],
      where: { googleDriveFolderId: { not: null } },
      _count: true,
    });

    const totalFolderCount = await this.prisma.agent.count({
      where: { googleDriveFolderId: { not: null } },
    });

    const scopeCoverage: Record<string, number> = {
      gmail: 0,
      drive: 0,
      calendar: 0,
      spreadsheets: 0,
    };
    let connectedCount = 0;

    const tenantStatus = tenants.map((t) => {
      const cred = credentials.find((c) => c.tenantId === t.id);
      const agentCount =
        agentsWithDrive.find((a) => a.tenantId === t.id)?._count ?? 0;
      const connected = !!cred;

      if (connected) {
        connectedCount++;
        if (cred.scopes) {
          for (const scope of cred.scopes) {
            if (scope.includes('gmail')) scopeCoverage.gmail++;
            if (scope.includes('drive')) scopeCoverage.drive++;
            if (scope.includes('calendar')) scopeCoverage.calendar++;
            if (scope.includes('spreadsheets')) scopeCoverage.spreadsheets++;
          }
        }
      }

      return {
        tenantId: t.id,
        tenantName: t.name,
        connected,
        scopes: cred?.scopes ?? [],
        agentCount,
        driveFolderCount: agentCount,
      };
    });

    return {
      tenants: tenantStatus,
      stats: {
        totalTenants: tenants.length,
        connectedTenants: connectedCount,
        totalAgentsWithDrive: totalFolderCount,
        scopeCoverage,
      },
    };
  }

  // ─── Admin overrides (G7) ──────────────────────────────────────────

  /**
   * G7: Platform-admin override that revokes a tenant's Google connection.
   * Use when the tenant is locked out (e.g. former employee). Writes an
   * audit log row at action='google.admin_revoke' so the platform audit
   * trail captures who revoked whose access at what time.
   */
  @Post('admin/google/:tenantId/disconnect')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.OK)
  async adminDisconnectGoogle(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ tenantId: string; revoked: true; hadCalendar: boolean }> {
    const result =
      await this.integrationsService.adminDisconnectGoogle(tenantId);

    if (this.audit) {
      await this.audit.log({
        actor: user.sub,
        action: 'google.admin_revoke',
        resource: 'integration_credential',
        resourceId: tenantId,
        tenantId,
        result: 'success',
        details: { hadCalendar: result.hadCalendar },
      });
    }

    this.logger.log(`Admin ${user.sub} revoked Google for tenant ${tenantId}`);
    return result;
  }

  // ─── Platform-level Brevo admin (BREVO-ADMIN) ─────────────────────────

  @Get('admin/brevo/platform-status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  async getBrevoPlatformStats() {
    return this.adminBrevo.platformStats();
  }

  @Get('admin/brevo/tenants')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  async listBrevoTenants() {
    return this.adminBrevo.listTenantRows();
  }

  @Get('admin/brevo/usage-series')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  async getBrevoUsageSeries() {
    return this.adminBrevo.usageSeries();
  }

  @Get('admin/brevo/health')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  async getBrevoHealth() {
    return this.adminBrevo.healthCheck();
  }

  @Get('admin/brevo/events')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  async listAdminBrevoEvents(
    @Query('tenantId') tenantId?: string,
    @Query('eventType') eventType?: string,
    @Query('messageId') messageId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.adminBrevo.listEvents({
      tenantId,
      eventType,
      messageId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('admin/brevo/tenants/:tenantId/disconnect')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.OK)
  async adminDisconnectBrevo(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.adminBrevo.disconnectTenant(tenantId);
    if (this.audit) {
      await this.audit.log({
        actor: user.sub,
        action: 'brevo.admin_revoke',
        resource: 'integration_credential',
        resourceId: tenantId,
        tenantId,
        result: 'success',
        details: {
          hadCredential: result.hadCredential,
          hadSenderIdentity: result.hadSenderIdentity,
        },
      });
    }
    this.logger.log(
      `Admin ${user.sub} revoked Brevo for tenant ${tenantId} (hadCredential=${result.hadCredential})`,
    );
    return result;
  }

  @Post('admin/brevo/tenants/:tenantId/reset-quota')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.OK)
  async adminResetBrevoQuota(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.adminBrevo.resetTodayQuota(tenantId);
    if (this.audit) {
      await this.audit.log({
        actor: user.sub,
        action: 'brevo.admin_reset_quota',
        resource: 'brevo_usage_counter',
        resourceId: tenantId,
        tenantId,
        result: 'success',
        details: { previousCount: result.previousCount },
      });
    }
    return result;
  }

  // ─── Suppression list (admin) ────────────────────────────────────

  @Get('admin/brevo/suppressions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  async listBrevoSuppressions(
    @Query('email') email?: string,
    @Query('reason') reason?: string,
    @Query('tenantId') tenantId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const tt: string | null | undefined = tenantId;
    return this.brevoSuppressions.list({
      email,
      reason: (reason ?? undefined) as never,
      tenantId: tt === 'null' ? null : tt === undefined ? undefined : tt,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('admin/brevo/suppressions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.OK)
  async addBrevoSuppression(
    @Body()
    body: {
      email: string;
      reason:
        | 'BOUNCE_HARD'
        | 'UNSUBSCRIBE'
        | 'ADMIN_BLOCK'
        | 'SPAM_COMPLAINT'
        | 'MANUAL';
      tenantId?: string | null;
      details?: Record<string, unknown>;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    if (!body?.email || !body?.reason) {
      return { success: false, error: 'email and reason are required' };
    }
    const r = await this.brevoSuppressions.upsert({
      email: body.email,
      reason: body.reason,
      tenantId: body.tenantId ?? null,
      addedBy: user.sub,
      details: body.details ?? {},
    });
    if (this.audit) {
      await this.audit.log({
        actor: user.sub,
        action: 'brevo.admin_suppression_add',
        resource: 'brevo_suppression',
        resourceId: body.email,
        result: 'success',
        details: { reason: body.reason, tenantId: body.tenantId ?? null },
      });
    }
    return { success: true, ...r };
  }

  @Delete('admin/brevo/suppressions/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.OK)
  async removeBrevoSuppression(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const r = await this.brevoSuppressions.remove(id);
    if (r.deleted && this.audit) {
      await this.audit.log({
        actor: user.sub,
        action: 'brevo.admin_suppression_remove',
        resource: 'brevo_suppression',
        resourceId: id,
        result: 'success',
      });
    }
    return r;
  }
}
