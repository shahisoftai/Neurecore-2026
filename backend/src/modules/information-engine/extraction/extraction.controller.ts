/**
 * Extraction — Controller (Phase 2E)
 *
 * Three endpoints under /v1/projects/:projectId/documents/*:
 *   POST /:documentId/extract     — upload + extract (multipart)
 *   POST /:documentId/accept      — accept a subset of candidates
 *   GET  /:documentId             — read the job (candidates + text)
 *
 * The upload endpoint accepts a `file` multipart part and returns an
 * ExtractionJob. The client shows the candidates in the DocumentSkin and
 * posts the accepted list back to /accept.
 */

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { ApiCommon } from '../../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { DocumentExtractionService } from './document-extraction.service';
import type { ExtractionJob } from './interfaces/extraction.interface';

// In-memory store keyed by documentId. 2E ships this — 2F replaces with
// the Hermes-attached DocumentStorageService (S3-compatible).
const JOB_STORE: Map<string, ExtractionJob> = new Map();

@Controller({ path: 'projects/:projectId/documents', version: '1' })
@ApiCommon('information-engine-extraction')
@UseGuards(JwtAuthGuard)
export class ExtractionController {
  constructor(private readonly service: DocumentExtractionService) {}

  @Post('extract')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async extract(
    @Req() req: Request,
    @Param('projectId') projectId: string,
    @UploadedFile()
    file?: {
      buffer: Buffer;
      mimetype: string;
      size: number;
      originalname: string;
    },
  ): Promise<ExtractionJob> {
    if (!file) {
      throw new BadRequestException('file multipart part is required');
    }
    void req;
    // For 2E we resolve questions inside the service via projectId.
    // (Pass an empty ResolvedQuestion[] — acceptCandidates calls back into
    // the service to re-resolve; the job carries the matched candidates
    // keyed by questionId. The client matches by questionId, not by
    // resolved question object.)
    const job = await this.service.extract(
      projectId,
      {
        buffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
      },
      [],
    );
    JOB_STORE.set(job.documentId, job);
    return job;
  }

  @Post(':documentId/accept')
  @HttpCode(HttpStatus.OK)
  async accept(
    @Req() req: Request,
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Body() body: { acceptedQuestionIds: string[] },
  ): Promise<{ recorded: number; completeness: unknown }> {
    const tenantId =
      (req as Request & { user?: { tenantId?: string | null } }).user
        ?.tenantId ?? null;
    const job = JOB_STORE.get(documentId);
    if (!job) throw new NotFoundException('documentId not found');
    if (!Array.isArray(body?.acceptedQuestionIds)) {
      throw new BadRequestException('acceptedQuestionIds must be an array');
    }
    return this.service.acceptCandidates(
      projectId,
      tenantId ?? 'system',
      job,
      body.acceptedQuestionIds,
    );
  }

  @Get(':documentId')
  async get(@Param('documentId') documentId: string): Promise<ExtractionJob> {
    const job = JOB_STORE.get(documentId);
    if (!job) throw new NotFoundException('documentId not found');
    return job;
  }
}
