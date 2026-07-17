import { Module } from '@nestjs/common';
import { ServiceIdentitiesController } from './service-identities.controller';
import { ServiceIdentitiesService } from './service-identities.service';

@Module({
  controllers: [ServiceIdentitiesController],
  providers: [ServiceIdentitiesService],
  exports: [ServiceIdentitiesService],
})
export class ServiceIdentitiesModule {}