import { Module, Global } from '@nestjs/common';
import { DigitalTwinController } from './digital-twin.controller';
import { DigitalTwinService } from './digital-twin.service';
import { ActivityTimelineService } from './activity-timeline.service';
import { ProjectHealthModule } from '../project-health/project-health.module';

@Global()
@Module({
  imports: [ProjectHealthModule],
  controllers: [DigitalTwinController],
  providers: [
    DigitalTwinService,
    ActivityTimelineService,
  ],
  exports: [DigitalTwinService, ActivityTimelineService],
})
export class DigitalTwinModule {}
