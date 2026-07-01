/**
 * KnowledgeController — REST surface for the Knowledge Hub.
 *
 * Phase 6, Tasks 6.1, 6.3, 6.7 (per EAOS-api-contract.md §8.17).
 *
 * Endpoints (all under `/api/v1/knowledge`):
 *
 *   GET    /                      → list paginated
 *   POST   /                      → create entry
 *   GET    /:id                   → read entry
 *   PATCH  /:id                   → update
 *   DELETE /:id                   → soft delete
 *   GET    /search                → hybrid vector + keyword search
 *   POST   /rag-ask               → RAG Q&A (citation chips)
 *   GET    /rag-ask/stream        → SSE streaming RAG
 *   GET    /:id/citations         → where this entry has been cited
 *
 * RBAC (per EAOS-rbac-model.md §4.9):
 *   - Reads: any auth in same tenant.
 *   - Writes: OWNER / ADMIN; USER may create.
 *   - Delete: OWNER / ADMIN / creator.
 *
 * Per-tenant isolation: every route resolves `tenantId` from
 * TenantContextService (never from the request body).
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { IdParamDto } from '../../common/dto/id-param.dto';
import { ActionResult } from '../../common/responses/action-result.response';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { KnowledgeService } from './services/knowledge.service';
import { RAGPipeline } from './services/rag-pipeline.service';
import { RagAskSseService } from './services/rag-ask-sse.service';
import {
  CreateKnowledgeDto,
  KnowledgeCitationDto,
  KnowledgeCitationUsageDto,
  KnowledgeEntryResponseDto,
  KnowledgePaginatedResponseDto,
  KnowledgeSearchResponseDto,
  ListKnowledgeDto,
  RagAnswerResponseDto,
  RagAskDto,
  SearchKnowledgeDto,
  UpdateKnowledgeDto,
} from './dto/knowledge.dto';
import type { KnowledgeEntry } from '@prisma/client';
import { KnowledgeRagAskGuard } from './guards/knowledge-rag-ask.guard';

@Controller({ path: 'knowledge', version: '1' })
@ApiCommon('knowledge')
@ApiTags('knowledge')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KnowledgeController {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly ragPipeline: RAGPipeline,
    private readonly ragAskSse: RagAskSseService,
  ) {}

  // ─── List ────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List knowledge entries (paginated).' })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query() dto: ListKnowledgeDto,
  ): Promise<KnowledgePaginatedResponseDto> {
    const { items, pagination } = await this.knowledgeService.list(user.tenantId!, dto);
    return {
      items: items.map((e: KnowledgeEntry) =>
        KnowledgeEntryResponseDto.fromEntity(e),
      ),
      pagination,
    };
  }

  // ─── Search (must come BEFORE /:id routes) ───────────────────────────

  @Get('search')
  @ApiOperation({ summary: 'Hybrid vector + BM25 keyword search.' })
  async search(
    @CurrentUser() user: JwtPayload,
    @Query() dto: SearchKnowledgeDto,
  ): Promise<KnowledgeSearchResponseDto> {
    return this.knowledgeService.search(user.tenantId!, dto);
  }

  // ─── RAG ask (block + stream) ───────────────────────────────────────

  @Post('rag-ask')
  @HttpCode(HttpStatus.OK)
  @UseGuards(KnowledgeRagAskGuard)
  @ApiOperation({
    summary: 'RAG Q&A — returns answer + structured citations for chips.',
  })
  async ragAsk(
    @Body() dto: RagAskDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<RagAnswerResponseDto> {
    const start = Date.now();
    const answer = await this.ragPipeline.ask(user.tenantId!, dto.question, {
      types: dto.types,
      tags: dto.tags,
      departmentId: dto.departmentId,
      topK: dto.topK,
      maxContextTokens: dto.maxContextTokens,
      vectorWeight: 0.7,
    });

    return {
      answer: answer.answer,
      citations: answer.citations.map<KnowledgeCitationDto>((c) => ({
        knowledgeEntryId: c.knowledgeEntryId,
        label: c.label,
        span: c.span,
        confidence: c.confidence,
        chunkIndex: c.chunkIndex,
      })),
      model: answer.model,
      tokensUsed: answer.tokensUsed,
      confidence: answer.confidence,
      durationMs: Date.now() - start,
    };
  }

  @Post('rag-ask/stream')
  @HttpCode(HttpStatus.OK)
  @UseGuards(KnowledgeRagAskGuard)
  @ApiOperation({
    summary: 'Streaming RAG via SSE — emits answer deltas + final citations.',
  })
  async ragAskStream(
    @Body() dto: RagAskDto,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    await this.ragAskSse.stream(
      user.tenantId!,
      dto.question,
      {
        types: dto.types,
        tags: dto.tags,
        departmentId: dto.departmentId,
        topK: dto.topK,
        maxContextTokens: dto.maxContextTokens,
        vectorWeight: 0.7,
      },
      res,
    );
  }

  // ─── Citations for an entry ─────────────────────────────────────────

  @Get(':id/citations')
  @ApiOperation({ summary: 'Where this entry has been cited (last 50).' })
  async listCitations(
    @CurrentUser() user: JwtPayload,
    @Param() params: IdParamDto,
  ): Promise<{ items: KnowledgeCitationUsageDto[] }> {
    const items = await this.knowledgeService.listCitationsFor(params.id, user.tenantId!);
    return { items };
  }

  // ─── CRUD ───────────────────────────────────────────────────────────

  @Post()
  @Roles('OWNER', 'ADMIN', 'USER')
  @ApiOperation({ summary: 'Create a knowledge entry.' })
  async create(
    @Body() dto: CreateKnowledgeDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActionResult<KnowledgeEntryResponseDto>> {
    const entry = await this.knowledgeService.create(user.tenantId!, user.sub, dto);
    return {
      success: true,
      message: 'Knowledge entry created',
      data: KnowledgeEntryResponseDto.fromEntity(entry),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read a single knowledge entry.' })
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param() params: IdParamDto,
  ): Promise<KnowledgeEntryResponseDto> {
    const entry = await this.knowledgeService.findOneOrThrow(params.id, user.tenantId!);
    return KnowledgeEntryResponseDto.fromEntity(entry);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN', 'USER')
  @ApiOperation({ summary: 'Update a knowledge entry.' })
  async update(
    @Param() params: IdParamDto,
    @Body() dto: UpdateKnowledgeDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActionResult<KnowledgeEntryResponseDto>> {
    const existing = await this.knowledgeService.findOneOrThrow(params.id, user.tenantId!);
    // Enforce: creator OR OWNER/ADMIN
    if (
      existing.authorId !== user.sub &&
      !['OWNER', 'ADMIN'].includes(user.role)
    ) {
      throw new (await import('@nestjs/common')).ForbiddenException(
        'Only the creator or an OWNER/ADMIN may edit this entry',
      );
    }
    const updated = await this.knowledgeService.update(params.id, user.tenantId!, dto);
    return {
      success: true,
      message: 'Knowledge entry updated',
      data: KnowledgeEntryResponseDto.fromEntity(updated),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('OWNER', 'ADMIN', 'USER')
  @ApiOperation({ summary: 'Delete a knowledge entry.' })
  async remove(
    @Param() params: IdParamDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    const existing = await this.knowledgeService.findOneOrThrow(params.id, user.tenantId!);
    if (
      existing.authorId !== user.sub &&
      !['OWNER', 'ADMIN'].includes(user.role)
    ) {
      throw new (await import('@nestjs/common')).ForbiddenException(
        'Only the creator or an OWNER/ADMIN may delete this entry',
      );
    }
    await this.knowledgeService.remove(params.id, user.tenantId!);
  }
}