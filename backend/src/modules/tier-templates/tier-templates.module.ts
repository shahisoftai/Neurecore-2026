/**
 * TierTemplatesModule — wires the Tier pool (commercial offering).
 */

import { Module } from '@nestjs/common';
import { TierTemplatesController } from './tier-templates.controller';
import { TierTemplatesService } from './tier-templates.service';

@Module({
  controllers: [TierTemplatesController],
  providers: [TierTemplatesService],
  exports: [TierTemplatesService],
})
export class TierTemplatesModule {}
