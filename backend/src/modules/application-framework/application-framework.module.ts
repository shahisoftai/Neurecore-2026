import { Module } from '@nestjs/common';
import { APP_FRAMEWORK, ApplicationFramework } from './application-framework.service';
import { ApplicationFrameworkController } from './application-framework.controller';

@Module({
  controllers: [ApplicationFrameworkController],
  providers: [ApplicationFramework, { provide: APP_FRAMEWORK, useExisting: ApplicationFramework }],
})
export class ApplicationFrameworkModule {}
