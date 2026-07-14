import { Module } from '@nestjs/common';
import { PLATFORM_EVOLUTION, PlatformEvolution } from './platform-evolution.service';
import { PlatformEvolutionController } from './platform-evolution.controller';

@Module({
  controllers: [PlatformEvolutionController],
  providers: [PlatformEvolution, { provide: PLATFORM_EVOLUTION, useExisting: PlatformEvolution }],
})
export class PlatformEvolutionModule {}
