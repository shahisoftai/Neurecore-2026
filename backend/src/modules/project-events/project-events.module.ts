import { Module, Global } from '@nestjs/common';
import { ProjectEventBus } from './project-event-bus.service';
import { HermesProjectChannel } from './hermes-project-channel.service';
import { OnTaskCompletedHandler } from './handlers/on-task-completed.handler';
import { OnGoalAchievedHandler } from './handlers/on-goal-achieved.handler';
import { OnStageCompletedHandler } from './handlers/on-stage-completed.handler';
import { OnHealthDroppedHandler } from './handlers/on-health-dropped.handler';
import { OnInformationGapsFoundHandler } from './handlers/on-information-gaps-found.handler';
import { InformationEngineModule } from '../information-engine/information-engine.module';
import { GoalsModule } from '../goals/goals.module';
import { ProjectMemoryModule } from '../project-memory/project-memory.module';

@Global()
@Module({
  imports: [InformationEngineModule, GoalsModule, ProjectMemoryModule],
  providers: [
    ProjectEventBus,
    HermesProjectChannel,
    OnTaskCompletedHandler,
    OnGoalAchievedHandler,
    OnStageCompletedHandler,
    OnHealthDroppedHandler,
    OnInformationGapsFoundHandler,
  ],
  exports: [
    ProjectEventBus,
    HermesProjectChannel,
  ],
})
export class ProjectEventsModule {}
