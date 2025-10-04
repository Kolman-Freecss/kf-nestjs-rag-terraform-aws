import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BlizzardModule } from './blizzard/blizzard.module';
import { RagModule } from './rag/rag.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BlizzardModule,
    RagModule,
  ],
})
export class AppModule {}
