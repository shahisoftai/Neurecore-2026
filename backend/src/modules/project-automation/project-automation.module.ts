import { Module, Global } from '@nestjs/common';
import { PROJECT_AUTOMATION_REPOSITORY } from './interfaces';
import { PrismaProjectAutomationRepository } from './interfaces/prisma-project-automation.repository';
import { ProjectAutomationService } from './project-automation.service';
import { ProjectAutomationController } from './project-automation.controller';
import { RoleTemplateService } from './services/role-template.service';
import { GoalTemplateService } from './services/goal-template.service';
import { TaskPlannerService } from './services/task-planner.service';
import { ChiefOfStaffService } from './services/chief-of-staff.service';
import { MemorySeederService } from './services/memory-seeder.service';
import { AgentsModule } from '../agents/agents.module';
import { GoalsModule } from '../goals/goals.module';
import { ProjectTypesModule } from '../project-types/project-types.module';
import { OrchestrationModule } from '../orchestration/orchestration.module';
import { ProjectMembersModule } from '../project-members/project-members.module';
import { ProjectMemoryModule } from '../project-memory/project-memory.module';

@Global()
@Module({
  imports: [
    AgentsModule,
    GoalsModule,
    ProjectTypesModule,
    OrchestrationModule,
    ProjectMembersModule,
    ProjectMemoryModule,
  ],
  providers: [
    {
      provide: PROJECT_AUTOMATION_REPOSITORY,
      useClass: PrismaProjectAutomationRepository,
    },
    RoleTemplateService,
    GoalTemplateService,
    TaskPlannerService,
    ChiefOfStaffService,
    MemorySeederService,
    ProjectAutomationService,
  ],
  controllers: [ProjectAutomationController],
  exports: [
    PROJECT_AUTOMATION_REPOSITORY,
    ProjectAutomationService,
    RoleTemplateService,
    GoalTemplateService,
    TaskPlannerService,
    ChiefOfStaffService,
    MemorySeederService,
  ],
})
export class ProjectAutomationModule {}
