import { Module, forwardRef } from '@nestjs/common';
import { GoogleDriveController } from './google-drive.controller';
import { GoogleDriveService } from './google-drive.service';
import { DriveCatalogService } from './drive-catalog.service';
import { DriveSyncScheduler } from './drive-sync.scheduler';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CostSheetsModule } from '../cost-sheets/cost-sheets.module';

@Module({
  imports: [PrismaModule, AuthModule, forwardRef(() => CostSheetsModule)],
  controllers: [GoogleDriveController],
  providers: [GoogleDriveService, DriveCatalogService, DriveSyncScheduler],
  exports: [GoogleDriveService, DriveCatalogService],
})
export class GoogleDriveModule {}
