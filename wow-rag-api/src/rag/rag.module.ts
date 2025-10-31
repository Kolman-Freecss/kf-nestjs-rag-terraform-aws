import { Module } from '@nestjs/common';
import { BlizzardModule } from '../blizzard/blizzard.module';
import { LocalLLMModule } from './llm/local-llm.module';
import { LangGraphModule } from './langgraph/langgraph.module';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';

@Module({
  imports: [BlizzardModule, LocalLLMModule, LangGraphModule],
  providers: [RagService],
  controllers: [RagController],
})
export class RagModule {}
