import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DriveCatalogService } from './drive-catalog.service';
import { GoogleDriveService } from './google-drive.service';

@Injectable()
export class DriveSyncScheduler {
  private readonly logger = new Logger(DriveSyncScheduler.name);

  constructor(
    private catalog: DriveCatalogService,
    private googleDrive: GoogleDriveService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleAutoSync() {
    if (!this.googleDrive.isConfigured()) {
      this.logger.debug('Auto-sync skipped: Google Drive not configured');
      return;
    }

    const config = await this.catalog.getConfig();
    if (!config.activeFolder && !config.envFolderId) {
      this.logger.debug('Auto-sync skipped: no folder assigned');
      return;
    }

    this.logger.log('Starting scheduled Google Drive catalog sync...');
    try {
      const result = await this.catalog.syncCatalogAndCostSheets();
      this.logger.log(
        `Auto-sync complete: ${result.cataloged} files cataloged, ${result.filesProcessed} spreadsheets parsed`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Auto-sync failed: ${message}`);
    }
  }
}
