import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { ExcelParserService } from './excel-parser.service';

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

  constructor(
    private configService: ConfigService,
    private excelParser: ExcelParserService,
  ) {}

  private getOAuth2Client() {
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

  async listExcelFiles(folderId: string): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
    const auth = this.getOAuth2Client();
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.list({
      q: `'${folderId}' in parents and (mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='application/vnd.ms-excel') and trashed=false`,
      fields: 'files(id, name, modifiedTime)',
      orderBy: 'modifiedTime desc',
    });

    return (response.data.files || []).map((f) => ({
      id: f.id!,
      name: f.name!,
      modifiedTime: f.modifiedTime!,
    }));
  }

  async listSubfolderFiles(folderId: string): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
    const auth = this.getOAuth2Client();
    const drive = google.drive({ version: 'v3', auth });

    // Get direct xlsx files
    const direct = await this.listExcelFiles(folderId);

    // Get subfolders
    const subfolderResponse = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
    });

    const subfolders = subfolderResponse.data.files || [];
    const subfolderFiles = await Promise.all(
      subfolders.map((sf) => this.listExcelFiles(sf.id!)),
    );

    return [...direct, ...subfolderFiles.flat()];
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

  async syncFolder(): Promise<DriveSyncResult> {
    const folderId = this.configService.get<string>('GOOGLE_DRIVE_FOLDER_ID');
    if (!folderId) {
      return {
        success: false,
        filesFound: 0,
        filesProcessed: 0,
        filesSkipped: 0,
        errors: ['GOOGLE_DRIVE_FOLDER_ID not set in environment'],
        details: [],
      };
    }

    const result: DriveSyncResult = {
      success: true,
      filesFound: 0,
      filesProcessed: 0,
      filesSkipped: 0,
      errors: [],
      details: [],
    };

    try {
      const files = await this.listSubfolderFiles(folderId);
      result.filesFound = files.length;
      this.logger.log(`Found ${files.length} Excel files in Drive folder`);

      for (const file of files) {
        try {
          this.logger.log(`Processing: ${file.name} (${file.id})`);
          const buffer = await this.downloadFile(file.id);
          const parseResult = await this.excelParser.parseAndInsert(buffer, file.name, file.id);

          result.details.push({
            fileName: file.name,
            driveFileId: file.id,
            rowsInserted: parseResult.rowsInserted,
            rowsSkipped: parseResult.rowsSkipped,
            error: parseResult.error,
          });

          if (parseResult.success) {
            result.filesProcessed++;
          } else {
            result.filesSkipped++;
            if (parseResult.error) result.errors.push(`${file.name}: ${parseResult.error}`);
          }
        } catch (fileErr: any) {
          this.logger.error(`Failed to process ${file.name}: ${fileErr.message}`);
          result.filesSkipped++;
          result.errors.push(`${file.name}: ${fileErr.message}`);
          result.details.push({
            fileName: file.name,
            driveFileId: file.id,
            rowsInserted: 0,
            rowsSkipped: 0,
            error: fileErr.message,
          });
        }
      }
    } catch (err: any) {
      result.success = false;
      result.errors.push(err.message);
      this.logger.error(`Drive sync failed: ${err.message}`);
    }

    return result;
  }

  async getAuthUrl(): Promise<string> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('GOOGLE_REDIRECT_URI') || 'http://localhost:3001/cost-sheets/drive/callback';

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
    const redirectUri = this.configService.get<string>('GOOGLE_REDIRECT_URI') || 'http://localhost:3001/cost-sheets/drive/callback';

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      throw new Error('No refresh token received. Try revoking app access at myaccount.google.com and re-authorizing.');
    }

    return { refresh_token: tokens.refresh_token };
  }
}
