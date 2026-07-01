import { Module } from '@nestjs/common';
import { OrchestrationController } from './orchestration.controller';
import { TasksService } from './services/tasks.service';
import { WorkflowsService } from './services/workflows.service';

@Module({
  controllers: [OrchestrationController],
  providers: [TasksService, WorkflowsService],
  exports: [TasksService, WorkflowsService],
})
export class OrchestrationModule {}
