import { Module } from '@nestjs/common';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';
import { BlizzardModule } from '../blizzard/blizzard.module';

@Module({
  imports: [BlizzardModule],
  providers: [RagService],
  controllers: [RagController],
})
export class RagModule {}
