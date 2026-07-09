/**
 * ProjectStages — Controller
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { ProjectStagesService } from './project-stages.service';
import {
  CreateStageDto,
  UpdateStageDto,
  ReorderStagesDto,
} from './dto/project-stage.dto';

@Controller({ path: 'projects/:projectId/stages', version: '1' })
@ApiCommon('project-stages')
@UseGuards(JwtAuthGuard)
export class ProjectStagesController {
  constructor(private readonly stagesService: ProjectStagesService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.stagesService.list(projectId, user.tenantId!);
  }

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: CreateStageDto,
  ) {
    return this.stagesService.create(projectId, user.tenantId!, {
      name: dto.name,
      description: dto.description,
      order: dto.order,
      status: dto.status,
      startDate: dto.startDate,
      endDate: dto.endDate,
    });
  }

  @Patch(':stageId')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('stageId') stageId: string,
    @Body() dto: UpdateStageDto,
  ) {
    return this.stagesService.update(projectId, user.tenantId!, stageId, {
      name: dto.name,
      description: dto.description,
      status: dto.status,
      startDate: dto.startDate,
      endDate: dto.endDate,
    });
  }

  @Delete(':stageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('stageId') stageId: string,
  ) {
    return this.stagesService.delete(projectId, user.tenantId!, stageId);
  }

  @Patch('reorder')
  reorder(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: ReorderStagesDto,
  ) {
    return this.stagesService.reorder(
      projectId,
      user.tenantId!,
      dto.orderedIds,
    );
  }
}
