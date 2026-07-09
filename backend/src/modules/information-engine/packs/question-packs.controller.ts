/**
 * QuestionPack — Controller (Phase 2B)
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
  UseGuards,
} from '@nestjs/common';
import { ApiCommon } from '../../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { QuestionPackService } from './question-packs.service';
import {
  CreateQuestionPackDto,
  UpdateQuestionPackDto,
  ListQuestionPacksDto,
} from './dto/question-pack.dto';
import type { QuestionItem } from './interfaces/question-pack.interface';

@Controller({ path: 'question-packs', version: '1' })
@ApiCommon('information-engine-question-packs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
export class QuestionPackController {
  constructor(private readonly service: QuestionPackService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateQuestionPackDto) {
    return this.service.createPack({
      key: dto.key,
      name: dto.name,
      description: dto.description ?? null,
      isSystem: dto.isSystem ?? false,
      questions: dto.questions as unknown as QuestionItem[],
    });
  }

  @Get()
  async list(@Query() query: ListQuestionPacksDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { data, total } = await this.service.listPacks({
      search: query.search,
      isSystem: query.isSystem,
      page,
      limit,
    });
    return {
      items: data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.service.findPack(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateQuestionPackDto) {
    return this.service.updatePack(id, {
      name: dto.name,
      description: dto.description,
      questions: dto.questions as unknown as QuestionItem[] | undefined,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.service.deletePack(id);
  }
}
