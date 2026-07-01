import { Module } from '@nestjs/common';
import { AgentTemplatesService } from './agent-templates.service';
import { AgentTemplatesController } from './agent-templates.controller';

@Module({
  controllers: [AgentTemplatesController],
  providers: [AgentTemplatesService],
  exports: [AgentTemplatesService],
})
export class AgentTemplatesModule {}
