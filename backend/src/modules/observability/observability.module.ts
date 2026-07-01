import { Module } from '@nestjs/common';
import { ObservabilityController } from './observability.controller';
import { ObservabilityService } from './services/observability.service';
import { TelemetryService } from './services/telemetry.service';

@Module({
  controllers: [ObservabilityController],
  providers: [ObservabilityService, TelemetryService],
  exports: [ObservabilityService, TelemetryService],
})
export class ObservabilityModule {}
