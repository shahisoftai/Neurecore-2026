import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ModelsModule } from '../models/models.module';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AgentsModule } from '../agents/agents.module';
import { HermesModule } from '../hermes/hermes.module';

@Module({
  imports: [ModelsModule, DatabaseModule, AgentsModule, HermesModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
