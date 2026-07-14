import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectAutomationService } from './project-automation.service';
import { TriggerAutomationDto, ReplanAutomationDto } from './dto/trigger-automation.dto';

@Controller({ path: 'projects/:projectId/automation', version: '1' })
@UseGuards(JwtAuthGuard)
export class ProjectAutomationController {
  constructor(private readonly automationService: ProjectAutomationService) {}

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

  @Post('trigger')
  async triggerAutomation(
    @Param('projectId') projectId: string,
    _dto: TriggerAutomationDto,
  ) {
    return { message: 'Manual trigger not yet implemented', projectId };
  }

  @Post('replan')
  async replan(@Param('projectId') projectId: string, _dto: ReplanAutomationDto) {
    return { message: 'Replan not yet implemented', projectId };
  }
}
