import { Module, Global } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service';
import { FeatureFlagController } from './feature-flag.controller';
import { DatabaseModule } from '../../infrastructure/database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [FeatureFlagController],
  providers: [FeatureFlagService],
  exports: [FeatureFlagService],
})
export class FeatureFlagModule {}
