import { Module, Global } from '@nestjs/common';
import { ChiefOfStaffController } from './chief-of-staff.controller';
import { ChiefOfStaffService } from './chief-of-staff.service';
import { AgentsModule } from '../agents/agents.module';
import { ModelsModule } from '../models/models.module';
import { ProjectEventsModule } from '../project-events/project-events.module';

@Global()
@Module({
  imports: [AgentsModule, ModelsModule, ProjectEventsModule],
  controllers: [ChiefOfStaffController],
  providers: [ChiefOfStaffService],
  exports: [ChiefOfStaffService],
})
export class ChiefOfStaffModule {}
