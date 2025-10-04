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
   * Get OAuth region (CN uses gateway.battlenet.com.cn, others use same region)
   */
  private getOAuthRegion(region: string): string {
    return region === 'cn' ? 'gateway.battlenet.com.cn' : `${region}.battle.net`;
  }

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

    if (!clientId || !clientSecret) {
      throw new Error('BLIZZARD_CLIENT_ID and BLIZZARD_CLIENT_SECRET are required');
    }

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const oauthHost = this.getOAuthRegion(region);

    try {
      const response = await firstValueFrom(
        this.httpService.post<BlizzardToken>(
          `https://${oauthHost}/oauth/token`,
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
    } catch (error) {
      this.logger.error('Failed to obtain Blizzard access token', error);
      throw new Error('Failed to authenticate with Blizzard API');
    }
  }

  /**
   * Fetch realm data from WoW API
   */
  async getRealmData(realmSlug: string): Promise<any> {
    const token = await this.getAccessToken();
    const region = this.configService.get<string>('BLIZZARD_REGION', 'us');
    const namespace = `dynamic-${region}`;

    try {
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
    } catch (error) {
      this.logger.error(`Failed to fetch realm data for ${realmSlug}`, error);
      throw new Error(`Failed to fetch realm data: ${realmSlug}`);
    }
  }

  /**
   * Fetch character data from WoW API
   */
  async getCharacterData(realmSlug: string, characterName: string): Promise<any> {
    const token = await this.getAccessToken();
    const region = this.configService.get<string>('BLIZZARD_REGION', 'us');
    const namespace = `profile-${region}`;

    try {
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
    } catch (error) {
      this.logger.error(`Failed to fetch character ${characterName} on ${realmSlug}`, error);
      throw new Error(`Failed to fetch character: ${characterName}@${realmSlug}`);
    }
  }

  /**
   * Search for items in WoW API
   */
  async searchItems(query: string): Promise<any> {
    const token = await this.getAccessToken();
    const region = this.configService.get<string>('BLIZZARD_REGION', 'us');
    const namespace = `static-${region}`;

    try {
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
    } catch (error) {
      this.logger.error(`Failed to search items with query: ${query}`, error);
      throw new Error(`Failed to search items: ${query}`);
    }
  }
}
