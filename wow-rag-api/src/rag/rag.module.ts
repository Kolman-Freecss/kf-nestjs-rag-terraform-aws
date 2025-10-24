import { Module } from '@nestjs/common';
import { BlizzardModule } from '../blizzard/blizzard.module';
import { LocalLLMModule } from './llm/local-llm.module';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';

@Module({
  imports: [BlizzardModule, LocalLLMModule],
  providers: [RagService],
  controllers: [RagController],
})
export class RagModule {}
