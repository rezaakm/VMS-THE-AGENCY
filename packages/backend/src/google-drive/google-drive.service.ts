import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { categorizeMimeType, EXCEL_MIME_TYPES } from './google-drive.config';

export interface DriveFileEntry {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  webViewLink?: string;
  subfolderPath?: string;
}

export interface DriveSyncResult {
  success: boolean;
  filesFound: number;
  filesProcessed: number;
  filesSkipped: number;
  errors: string[];
  details: Array<{
    fileName: string;
    driveFileId: string;
    rowsInserted: number;
    rowsSkipped: number;
    error?: string;
  }>;
}

@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);

  constructor(private configService: ConfigService) {}

  isConfigured(): boolean {
    return !!(
      this.configService.get('GOOGLE_CLIENT_ID') &&
      this.configService.get('GOOGLE_CLIENT_SECRET') &&
      this.configService.get('GOOGLE_REFRESH_TOKEN')
    );
  }

  getOAuth2Client() {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const refreshToken = this.configService.get<string>('GOOGLE_REFRESH_TOKEN');

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error(
        'Google Drive credentials not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in .env',
      );
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
  }

  async listExcelFiles(
    folderId: string,
  ): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
    const all = await this.listAllFilesRecursive(folderId);
    return all
      .filter((f) => EXCEL_MIME_TYPES.includes(f.mimeType))
      .map((f) => ({
        id: f.id,
        name: f.name,
        modifiedTime: f.modifiedTime,
      }));
  }

  async listSubfolderFiles(
    folderId: string,
  ): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
    const all = await this.listAllFilesRecursive(folderId);
    return all
      .filter((f) => EXCEL_MIME_TYPES.includes(f.mimeType))
      .map((f) => ({
        id: f.id,
        name: f.name,
        modifiedTime: f.modifiedTime,
      }));
  }

  async listAllFilesRecursive(folderId: string): Promise<DriveFileEntry[]> {
    const auth = this.getOAuth2Client();
    const drive = google.drive({ version: 'v3', auth });
    const entries: DriveFileEntry[] = [];

    const walk = async (parentId: string, pathPrefix: string) => {
      let pageToken: string | undefined;
      do {
        const response = await drive.files.list({
          q: `'${parentId}' in parents and trashed=false`,
          fields:
            'nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)',
          pageSize: 200,
          pageToken,
        });

        for (const file of response.data.files || []) {
          if (!file.id || !file.name || !file.mimeType) continue;

          if (file.mimeType === 'application/vnd.google-apps.folder') {
            const childPath = pathPrefix
              ? `${pathPrefix}/${file.name}`
              : file.name;
            await walk(file.id, childPath);
          } else {
            entries.push({
              id: file.id,
              name: file.name,
              mimeType: file.mimeType,
              modifiedTime: file.modifiedTime || new Date().toISOString(),
              size: file.size ?? undefined,
              webViewLink: file.webViewLink ?? undefined,
              subfolderPath: pathPrefix || undefined,
            });
          }
        }
        pageToken = response.data.nextPageToken ?? undefined;
      } while (pageToken);
    };

    await walk(folderId, '');
    return entries;
  }

  async getFolderMetadata(folderId: string): Promise<{ id: string; name: string }> {
    const auth = this.getOAuth2Client();
    const drive = google.drive({ version: 'v3', auth });
    const { data } = await drive.files.get({
      fileId: folderId,
      fields: 'id, name',
    });
    return { id: data.id!, name: data.name || 'Google Drive folder' };
  }

  async downloadFile(fileId: string): Promise<Buffer> {
    const auth = this.getOAuth2Client();
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' },
    );

    return Buffer.from(response.data as ArrayBuffer);
  }

  getRedirectUri(): string {
    return (
      this.configService.get<string>('GOOGLE_REDIRECT_URI') ||
      'http://localhost:3001/google-drive/auth/callback'
    );
  }

  async getAuthUrl(): Promise<string> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.getRedirectUri();

    if (!clientId || !clientSecret) {
      throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.readonly'],
      prompt: 'consent',
    });
  }

  async exchangeCodeForToken(code: string): Promise<{ refresh_token: string }> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.getRedirectUri();

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      throw new Error(
        'No refresh token received. Try revoking app access at myaccount.google.com and re-authorizing.',
      );
    }

    return { refresh_token: tokens.refresh_token };
  }

  categorizeMimeType(mimeType: string): string {
    return categorizeMimeType(mimeType);
  }
}
