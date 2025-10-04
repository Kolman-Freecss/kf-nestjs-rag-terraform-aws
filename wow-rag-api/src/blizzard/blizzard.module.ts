import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BlizzardService } from './blizzard.service';
import { BlizzardController } from './blizzard.controller';

@Module({
  imports: [HttpModule],
  providers: [BlizzardService],
  controllers: [BlizzardController],
  exports: [BlizzardService],
})
export class BlizzardModule {}
