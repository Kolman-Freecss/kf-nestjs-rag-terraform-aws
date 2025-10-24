import { Module } from '@nestjs/common';
import { LocalLLMService } from './local-llm.service';

@Module({
  providers: [LocalLLMService],
  exports: [LocalLLMService],
})
export class LocalLLMModule {}
