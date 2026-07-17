import { Module } from '@nestjs/common';
import { SimulationsController } from './simulations.controller';
import { SimulationsService } from './simulations.service';
import { SimulationsDayRunner } from './simulations.day-runner';
import { TimelineEventsModule } from '../modules/timeline-events/timeline-events.module';
import { DecisionEvaluationsModule } from '../modules/decision-evaluations/decision-evaluations.module';
import { ServiceIdentitiesModule } from '../modules/service-identities/service-identities.module';

@Module({
  imports: [
    TimelineEventsModule,
    DecisionEvaluationsModule,
    ServiceIdentitiesModule,
  ],
  controllers: [SimulationsController],
  providers: [SimulationsService, SimulationsDayRunner],
  exports: [SimulationsService],
})
export class SimulationsModule {}