import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BlizzardToken } from './interfaces/blizzard-token.interface';

/**
 * Service for interacting with Blizzard API
 */
@Injectable()
export class BlizzardService {
  private readonly logger = new Logger(BlizzardService.name);
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get OAuth access token from Blizzard
   */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();

    if (this.accessToken && this.tokenExpiry > now) {
      return this.accessToken;
    }

    const clientId = this.configService.get<string>('BLIZZARD_CLIENT_ID');
    const clientSecret = this.configService.get<string>('BLIZZARD_CLIENT_SECRET');
    const region = this.configService.get<string>('BLIZZARD_REGION', 'us');

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await firstValueFrom(
      this.httpService.post<BlizzardToken>(
        `https://${region}.battle.net/oauth/token`,
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      ),
    );

    this.accessToken = response.data.access_token;
    this.tokenExpiry = now + (response.data.expires_in * 1000) - 60000; // Refresh 1 min before expiry

    this.logger.log('Successfully obtained Blizzard access token');
    return this.accessToken!;
  }

  /**
   * Fetch realm data from WoW API
   */
  async getRealmData(realmSlug: string): Promise<any> {
    const token = await this.getAccessToken();
    const region = this.configService.get<string>('BLIZZARD_REGION', 'us');
    const namespace = `dynamic-${region}`;

    const response = await firstValueFrom(
      this.httpService.get(
        `https://${region}.api.blizzard.com/data/wow/realm/${realmSlug}`,
        {
          params: { namespace, locale: 'en_US' },
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
    );

    return response.data;
  }

  /**
   * Fetch character data from WoW API
   */
  async getCharacterData(realmSlug: string, characterName: string): Promise<any> {
    const token = await this.getAccessToken();
    const region = this.configService.get<string>('BLIZZARD_REGION', 'us');
    const namespace = `profile-${region}`;

    const response = await firstValueFrom(
      this.httpService.get(
        `https://${region}.api.blizzard.com/profile/wow/character/${realmSlug}/${characterName.toLowerCase()}`,
        {
          params: { namespace, locale: 'en_US' },
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
    );

    return response.data;
  }

  /**
   * Search for items in WoW API
   */
  async searchItems(query: string): Promise<any> {
    const token = await this.getAccessToken();
    const region = this.configService.get<string>('BLIZZARD_REGION', 'us');
    const namespace = `static-${region}`;

    const response = await firstValueFrom(
      this.httpService.get(
        `https://${region}.api.blizzard.com/data/wow/search/item`,
        {
          params: {
            namespace,
            locale: 'en_US',
            'name.en_US': query,
            orderby: 'name',
            _page: 1,
          },
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
    );

    return response.data;
  }
}
