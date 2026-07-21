import { Controller, Get, Post, Param, Body, UseGuards, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectAutomationService } from './project-automation.service';
import { TriggerAutomationDto, ReplanAutomationDto } from './dto/trigger-automation.dto';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Controller({ path: 'projects/:projectId/automation', version: '1' })
@UseGuards(JwtAuthGuard)
export class ProjectAutomationController {
  constructor(
    private readonly automationService: ProjectAutomationService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getAutomationHistory(@Param('projectId') projectId: string) {
    return this.automationService.getAutomationHistory(projectId);
  }

  @Get('latest')
  async getLatestAutomation(@Param('projectId') projectId: string) {
    const latest = await this.automationService.getLatestAutomation(projectId);
    if (!latest) return { message: 'No automation runs yet' };
    return latest;
  }

  /**
   * Manually re-trigger the full project-creation automation pipeline.
   * Idempotent: re-running on an already-spawned project is safe (goals
   * dedup, members check for existing actor+role). Useful when:
   *   - the initial fire-and-forget automation failed
   *   - project type was added/changed after creation
   *   - operator wants to re-seed AI workforce
   */
  @Post('trigger')
  async triggerAutomation(
    @Param('projectId') projectId: string,
    @Body() dto: TriggerAutomationDto,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, projectTypeId: true, tenantId: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    if (!project.projectTypeId) {
      throw new BadRequestException(
        `Project ${projectId} has no projectTypeId — automation requires a project type to seed goals and agents`,
      );
    }
    return this.automationService.onProjectCreated(
      project.id,
      project.projectTypeId,
      project.name,
      project.tenantId,
    );
  }

  /**
   * Re-plan a project: tear down existing goals/tasks and re-derive from the
   * current goalTemplate + roleTemplate. Use when the project type's templates
   * have been updated and the existing project is out of sync.
   */
  @Post('replan')
  async replan(
    @Param('projectId') projectId: string,
    @Body() _dto: ReplanAutomationDto,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, projectTypeId: true, tenantId: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    if (!project.projectTypeId) {
      throw new BadRequestException(
        `Project ${projectId} has no projectTypeId — cannot replan without a project type`,
      );
    }
    return this.automationService.replan(project.id, project.tenantId);
  }
}
