import { Module, Global } from '@nestjs/common';
import { SimulationVisibilityService } from './simulation-visibility.service';

@Global()
@Module({
  providers: [SimulationVisibilityService],
  exports: [SimulationVisibilityService],
})
export class SimulationVisibilityModule {}