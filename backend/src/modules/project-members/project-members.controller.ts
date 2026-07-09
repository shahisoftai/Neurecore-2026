/**
 * ProjectMembers — Controller
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
import { ProjectMembersService } from './project-members.service';
import {
  AssignMemberDto,
  ReassignMemberDto,
  AutoAssignChiefOfStaffDto,
} from './dto/project-member.dto';

@Controller({ path: 'projects/:projectId/members', version: '1' })
@ApiCommon('project-members')
@UseGuards(JwtAuthGuard)
export class ProjectMembersController {
  constructor(private readonly membersService: ProjectMembersService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.membersService.list(projectId, user.tenantId!);
  }

  @Post()
  assign(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: AssignMemberDto,
  ) {
    return this.membersService.assign(projectId, user.tenantId!, {
      actorId: dto.actorId,
      actorType: dto.actorType,
      role: dto.role,
    });
  }

  @Patch(':memberId/role')
  reassignRole(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
    @Body() dto: ReassignMemberDto,
  ) {
    return this.membersService.reassignRole(
      projectId,
      user.tenantId!,
      memberId,
      dto.role,
    );
  }

  @Delete(':memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.membersService.remove(projectId, user.tenantId!, memberId);
  }

  @Post('chief-of-staff')
  autoAssignCos(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: AutoAssignChiefOfStaffDto,
  ) {
    return this.membersService.autoAssignChiefOfStaff(
      projectId,
      user.tenantId!,
      dto.actorId,
    );
  }
}
