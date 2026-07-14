import { Module } from '@nestjs/common';
import { CLOUD_PLATFORM } from './contracts/cloud-platform.interface';
import { CloudPlatform } from './engines/cloud-control-plane.service';
import { CloudPlatformController } from './cloud-platform.controller';

@Module({
  controllers: [CloudPlatformController],
  providers: [CloudPlatform, { provide: CLOUD_PLATFORM, useExisting: CloudPlatform }],
})
export class CloudPlatformModule {}
