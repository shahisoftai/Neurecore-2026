import { Module } from '@nestjs/common';
import { TimelineEventsService } from './timeline-events.service';

@Module({
  providers: [TimelineEventsService],
  exports: [TimelineEventsService],
})
export class TimelineEventsModule {}