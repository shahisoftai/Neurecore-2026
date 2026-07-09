import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { PortalAuthGuard } from '../guards/portal-auth.guard';
import { PortalService } from '../services/portal.service';
import type {
  RequestPortalAccessDto,
  ValidatePortalTokenDto,
  RefreshPortalTokenDto,
  UploadProjectDocumentDto,
  ListProjectDocumentsDto,
  ApproveDeliverableDto,
} from '../dto/portal.dto';
import type { PortalTokenPayload } from '../interfaces/portal.interface';
import { DOCUMENT_UPLOAD } from '../../uploads/storage/storage.interface';

interface PortalRequest extends Request {
  portal?: PortalTokenPayload;
}

@ApiTags('portal')
@Controller('portal')
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  private getPortalContext(request: PortalRequest): PortalTokenPayload & { contactId: string; projectId: string } {
    const portal = request.portal;
    if (!portal) {
      throw new BadRequestException('Portal context not found');
    }
    return portal as PortalTokenPayload & { contactId: string; projectId: string };
  }

  @Post('request-access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request portal access — returns a magic token for API clients',
    description:
      'Clients request access with their project ID and contact email. ' +
      'In production this would send an email; for API clients the token is returned directly.',
  })
  async requestAccess(@Body() dto: RequestPortalAccessDto) {
    const result = await this.portal.requestAccess(dto);
    return {
      message:
        'Access granted. Use the returned token in the Authorization header as "Portal <token>".',
      expiresIn: result.expiresIn,
      token: result.token,
    };
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a portal token and return the session payload' })
  async validateToken(@Body() dto: ValidatePortalTokenDto) {
    const payload = await this.portal.validateToken(dto);
    return payload;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh a portal token — issues a fresh token with a new 7-day TTL',
    description:
      'The current token must still be valid; the new token is returned. The old token is invalidated.',
  })
  async refreshToken(@Body() dto: RefreshPortalTokenDto) {
    return this.portal.refreshToken(dto);
  }

  @Get('projects/:projectId')
  @UseGuards(PortalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get read-only project details for the client portal' })
  async getProject(@Param('projectId') projectId: string, @Req() request: PortalRequest) {
    const ctx = this.getPortalContext(request);
    if (ctx.projectId !== projectId) {
      throw new BadRequestException('Token project mismatch');
    }
    const project = await this.portal.getProject(projectId, ctx.contactId);
    return project;
  }

  @Get('projects/:projectId/documents')
  @UseGuards(PortalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List documents uploaded to a project (CLIENT visibility)' })
  async listDocuments(
    @Param('projectId') projectId: string,
    @Query() query: ListProjectDocumentsDto,
    @Req() request: PortalRequest,
  ) {
    const ctx = this.getPortalContext(request);
    if (ctx.projectId !== projectId) {
      throw new BadRequestException('Token project mismatch');
    }
    return this.portal.listDocuments(projectId, ctx.contactId, {
      skip: query.skip,
      take: query.take,
      visibility: query.visibility,
    });
  }

  @Post('projects/:projectId/documents')
  @UseGuards(PortalAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: DOCUMENT_UPLOAD.maxBytes },
    }),
  )
  @ApiOperation({ summary: 'Upload a document to a project (client → project)' })
  async uploadDocument(
    @Param('projectId') projectId: string,
    @Body() dto: UploadProjectDocumentDto,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    @Req() request: PortalRequest,
  ) {
    if (!file) throw new BadRequestException('Missing file field "file"');
    const ctx = this.getPortalContext(request);
    if (ctx.projectId !== projectId) {
      throw new BadRequestException('Token project mismatch');
    }
    return this.portal.uploadDocument(projectId, ctx.contactId, dto, {
      buffer: file.buffer,
      originalname: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    });
  }

  @Delete('projects/:projectId/documents/:documentId')
  @UseGuards(PortalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unlink (delete) a document the caller previously uploaded',
    description: 'Only documents uploaded by the current contact can be unlinked.',
  })
  async unlinkDocument(
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Req() request: PortalRequest,
  ) {
    const ctx = this.getPortalContext(request);
    if (ctx.projectId !== projectId) {
      throw new BadRequestException('Token project mismatch');
    }
    await this.portal.unlinkDocument(projectId, ctx.contactId, documentId);
    return { ok: true, documentId };
  }

  @Post('projects/:projectId/deliverables/:deliverableId/approve')
  @UseGuards(PortalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Client-facing approval — marks a deliverable as APPROVED',
    description: 'Only deliverables with clientFacing=true and status=IN_REVIEW can be approved.',
  })
  async approveDeliverable(
    @Param('projectId') projectId: string,
    @Param('deliverableId') deliverableId: string,
    @Body() dto: ApproveDeliverableDto,
    @Req() request: PortalRequest,
  ) {
    const ctx = this.getPortalContext(request);
    if (ctx.projectId !== projectId) {
      throw new BadRequestException('Token project mismatch');
    }
    return this.portal.approveDeliverable(projectId, deliverableId, ctx.contactId, dto);
  }
}
