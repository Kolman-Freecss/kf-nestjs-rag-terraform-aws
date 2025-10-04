import { Controller, Get, Param, Query } from '@nestjs/common';
import { BlizzardService } from './blizzard.service';

/**
 * Controller for Blizzard API endpoints
 */
@Controller('blizzard')
export class BlizzardController {
  constructor(private readonly blizzardService: BlizzardService) {}

  /**
   * Get realm information
   */
  @Get('realm/:slug')
  async getRealm(@Param('slug') slug: string) {
    return this.blizzardService.getRealmData(slug);
  }

  /**
   * Get character information
   */
  @Get('character/:realm/:name')
  async getCharacter(
    @Param('realm') realm: string,
    @Param('name') name: string,
  ) {
    return this.blizzardService.getCharacterData(realm, name);
  }

  /**
   * Search for items
   */
  @Get('items/search')
  async searchItems(@Query('q') query: string) {
    return this.blizzardService.searchItems(query);
  }
}
