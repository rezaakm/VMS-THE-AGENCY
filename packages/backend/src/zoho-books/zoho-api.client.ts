import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios, { AxiosRequestConfig } from 'axios';
import { ZohoOAuthService } from './zoho-oauth.service';

@Injectable()
export class ZohoApiClient {
  private readonly logger = new Logger(ZohoApiClient.name);

  constructor(private oauth: ZohoOAuthService) {}

  private async booksBase(): Promise<{ base: string; orgId: string; token: string }> {
    const conn = await this.oauth.getActiveConnection();
    if (!conn) {
      throw new ServiceUnavailableException('Zoho Books is not connected');
    }
    if (conn.organizationId === 'pending-selection') {
      throw new BadRequestException(
        'Select a Zoho organization before calling the API',
      );
    }
    const base = `${conn.apiDomain}/books/v3`;
    return { base, orgId: conn.organizationId, token: conn.accessToken };
  }

  async get<T = unknown>(path: string, query?: Record<string, string | number>) {
    return this.request<T>('GET', path, undefined, query);
  }

  async post<T = unknown>(path: string, body?: unknown) {
    return this.request<T>('POST', path, body);
  }

  async put<T = unknown>(path: string, body?: unknown) {
    return this.request<T>('PUT', path, body);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    extraQuery?: Record<string, string | number>,
  ): Promise<T> {
    const { base, orgId, token } = await this.booksBase();
    const url = path.startsWith('http') ? path : `${base}${path}`;
    const config: AxiosRequestConfig = {
      method,
      url,
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
      },
      params: {
        organization_id: orgId,
        ...extraQuery,
      },
      data: body,
    };

    try {
      const { data } = await axios.request(config);
      return data as T;
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.response?.data
          ? JSON.stringify(err.response.data)
          : err instanceof Error
            ? err.message
            : String(err);
      this.logger.warn(`Zoho API ${method} ${path}: ${message}`);
      throw err;
    }
  }
}
