import { Module } from '@nestjs/common';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './services/departments.service';
import { ContextModule } from '../context/context.module';
import { TenantTemplatesModule } from '../tenant-templates/tenant-templates.module';

@Module({
  imports: [ContextModule, TenantTemplatesModule],
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
