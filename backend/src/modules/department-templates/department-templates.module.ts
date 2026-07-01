import { Module } from '@nestjs/common';
import { DepartmentTemplatesController } from './department-templates.controller';
import { DepartmentTemplatesService } from './department-templates.service';

/**
 * DepartmentTemplatesModule
 *
 * Encapsulates everything related to platform-level department templates.
 * Exports the service so DeploymentService (in AgentsModule) can inject it.
 */
@Module({
  controllers: [DepartmentTemplatesController],
  providers: [DepartmentTemplatesService],
  exports: [DepartmentTemplatesService],
})
export class DepartmentTemplatesModule {}
