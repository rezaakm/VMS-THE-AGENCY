import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { GoogleDriveService } from './google-drive.service';

@Injectable()
export class DriveSyncScheduler {
  private readonly logger = new Logger(DriveSyncScheduler.name);

  constructor(
    private googleDriveService: GoogleDriveService,
    private configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleAutoSync() {
    const refreshToken = this.configService.get<string>('GOOGLE_REFRESH_TOKEN');
    const folderId = this.configService.get<string>('GOOGLE_DRIVE_FOLDER_ID');

    if (!refreshToken || !folderId) {
      this.logger.debug('Auto-sync skipped: Google Drive not configured');
      return;
    }

    this.logger.log('Starting scheduled Google Drive sync...');
    try {
      const result = await this.googleDriveService.syncFolder();
      this.logger.log(
        `Auto-sync complete: ${result.filesProcessed} files processed, ${result.filesSkipped} skipped`,
      );
    } catch (err: any) {
      this.logger.error(`Auto-sync failed: ${err.message}`);
    }
  }
}
