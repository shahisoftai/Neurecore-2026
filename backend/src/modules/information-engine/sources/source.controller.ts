/**
 * Sources — Controller (Phase 2B)
 *
 * Thin HTTP surface per SOLID; delegates to SourceService.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCommon } from '../../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/token.interface';
import { SourceService } from './source.service';
import { CreateSourceDto } from './dto/source.dto';

@Controller({ path: 'sources', version: '1' })
@ApiCommon('information-engine-sources')
@UseGuards(JwtAuthGuard)
export class SourceController {
  constructor(private readonly sourceService: SourceService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateSourceDto) {
    return this.sourceService.create(
      {
        type: dto.type,
        label: dto.label,
        refType: dto.refType ?? null,
        refId: dto.refId ?? null,
        confidence: dto.confidence,
      },
      user.sub,
    );
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.sourceService.findById(id);
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  async verify(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.sourceService.verify(id, user.sub);
  }
}
