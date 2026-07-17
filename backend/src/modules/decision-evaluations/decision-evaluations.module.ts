import { Module } from '@nestjs/common';
import { DecisionEvaluationsService } from './decision-evaluations.service';

@Module({
  providers: [DecisionEvaluationsService],
  exports: [DecisionEvaluationsService],
})
export class DecisionEvaluationsModule {}