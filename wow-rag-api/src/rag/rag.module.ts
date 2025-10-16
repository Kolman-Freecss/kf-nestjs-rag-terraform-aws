import { Module } from '@nestjs/common';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';
import { BlizzardModule } from '../blizzard/blizzard.module';
import { ModelFactory } from './models/factory/model.factory';

@Module({
  imports: [BlizzardModule],
  providers: [RagService, ModelFactory],
  controllers: [RagController],
  exports: [RagService, ModelFactory],
})
export class RagModule {}
