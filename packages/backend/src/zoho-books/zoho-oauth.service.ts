import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { ZOHO_BOOKS_SCOPES, ZOHO_DC_MAP } from './zoho-books.config';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  api_domain?: string;
  token_type?: string;
}

@Injectable()
export class ZohoOAuthService {
  private readonly logger = new Logger(ZohoOAuthService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  getDataCenter(): string {
    return this.config.get('ZOHO_DATA_CENTER') || 'com';
  }

  getDcConfig() {
    const dc = this.getDataCenter();
    return ZOHO_DC_MAP[dc] || ZOHO_DC_MAP.com;
  }

  getRedirectUri(): string {
    return (
      this.config.get('ZOHO_REDIRECT_URI') ||
      `${this.config.get('BACKEND_URL') || 'http://localhost:3001'}/zoho/auth/callback`
    );
  }

  buildAuthorizationUrl(state: string): string {
    const clientId = this.config.get('ZOHO_CLIENT_ID');
    if (!clientId) {
      throw new BadRequestException(
        'ZOHO_CLIENT_ID is not configured. Add it to packages/backend/.env',
      );
    }
    const { accounts } = this.getDcConfig();
    const params = new URLSearchParams({
      scope: ZOHO_BOOKS_SCOPES,
      client_id: clientId,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      redirect_uri: this.getRedirectUri(),
      state,
    });
    return `${accounts}/oauth/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string, userId?: string) {
    const clientId = this.config.get('ZOHO_CLIENT_ID');
    const clientSecret = this.config.get('ZOHO_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new BadRequestException('ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET required');
    }

    const { accounts } = this.getDcConfig();
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: this.getRedirectUri(),
      code,
    });

    const { data } = await axios.post<TokenResponse>(
      `${accounts}/oauth/v2/token?${params.toString()}`,
    );

    if (!data.access_token) {
      throw new BadRequestException('Zoho did not return an access token');
    }

    const apiDomain = data.api_domain || this.getDcConfig().api;
    const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);

    const orgId =
      this.config.get('ZOHO_ORGANIZATION_ID') || 'pending-selection';

    await this.prisma.zohoConnection.updateMany({ data: { isActive: false } });

    return this.prisma.zohoConnection.create({
      data: {
        organizationId: orgId,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || '',
        expiresAt,
        apiDomain: apiDomain.replace(/\/$/, ''),
        accountsDomain: accounts,
        dataCenter: this.getDataCenter(),
        scopes: ZOHO_BOOKS_SCOPES,
        connectedById: userId,
        isActive: true,
      },
    });
  }

  async connectFromEnv(userId?: string) {
    const refreshToken = this.config.get('ZOHO_REFRESH_TOKEN');
    const orgId = this.config.get('ZOHO_ORGANIZATION_ID');
    if (!refreshToken || !orgId) {
      throw new BadRequestException(
        'ZOHO_REFRESH_TOKEN and ZOHO_ORGANIZATION_ID required for env-based connect',
      );
    }

    const tokens = await this.refreshAccessToken(refreshToken);
    await this.prisma.zohoConnection.updateMany({ data: { isActive: false } });

    return this.prisma.zohoConnection.create({
      data: {
        organizationId: orgId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || refreshToken,
        expiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
        apiDomain: (tokens.api_domain || this.getDcConfig().api).replace(
          /\/$/,
          '',
        ),
        accountsDomain: this.getDcConfig().accounts,
        dataCenter: this.getDataCenter(),
        scopes: ZOHO_BOOKS_SCOPES,
        connectedById: userId,
        isActive: true,
      },
    });
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const clientId = this.config.get('ZOHO_CLIENT_ID');
    const clientSecret = this.config.get('ZOHO_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new BadRequestException('Zoho OAuth client credentials missing');
    }

    const { accounts } = this.getDcConfig();
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    });

    const { data } = await axios.post<TokenResponse>(
      `${accounts}/oauth/v2/token?${params.toString()}`,
    );
    return data;
  }

  async getActiveConnection() {
    const conn = await this.prisma.zohoConnection.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!conn) return null;

    if (conn.expiresAt.getTime() <= Date.now() + 60_000) {
      return this.refreshStoredConnection(conn.id);
    }
    return conn;
  }

  private async refreshStoredConnection(connectionId: string) {
    const conn = await this.prisma.zohoConnection.findUnique({
      where: { id: connectionId },
    });
    if (!conn?.refreshToken) {
      throw new UnauthorizedException('Zoho connection expired; reconnect required');
    }

    const tokens = await this.refreshAccessToken(conn.refreshToken);
    return this.prisma.zohoConnection.update({
      where: { id: connectionId },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || conn.refreshToken,
        expiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
        apiDomain: tokens.api_domain
          ? tokens.api_domain.replace(/\/$/, '')
          : conn.apiDomain,
      },
    });
  }

  async disconnect() {
    await this.prisma.zohoConnection.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
    return { disconnected: true };
  }

  async setOrganization(organizationId: string, organizationName?: string) {
    const conn = await this.getActiveConnection();
    if (!conn) {
      throw new BadRequestException('No active Zoho connection');
    }
    return this.prisma.zohoConnection.update({
      where: { id: conn.id },
      data: { organizationId, organizationName },
    });
  }
}
