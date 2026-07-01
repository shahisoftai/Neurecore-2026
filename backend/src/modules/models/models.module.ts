import { Module } from '@nestjs/common';
import { ModelsController } from './models.controller';
import { ModelRoutingService } from './services/model-routing.service';
import { LLMFactory } from './services/llm-factory.service';
import { MiniMaxClient } from './services/minimax-client.service';
import { DeepSeekClientService } from './services/deepseek-client.service';
import { MiMoClientService } from './services/mimo-client.service';

@Module({
  controllers: [ModelsController],
  providers: [
    ModelRoutingService,
    LLMFactory,
    MiniMaxClient,
    DeepSeekClientService,
    MiMoClientService,
  ],
  exports: [
    ModelRoutingService,
    LLMFactory,
    MiniMaxClient,
    DeepSeekClientService,
    MiMoClientService,
  ],
})
export class ModelsModule {}
