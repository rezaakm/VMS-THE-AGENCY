import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CostSheetsService } from './cost-sheets.service';
import { CostSheetsController } from './cost-sheets.controller';
import { ExcelParserService } from './excel-parser.service';
import { AiService } from './ai.service';
import { GoogleDriveService } from './google-drive.service';
import { DriveSyncScheduler } from './drive-sync.scheduler';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  controllers: [CostSheetsController],
  providers: [CostSheetsService, ExcelParserService, AiService, GoogleDriveService, DriveSyncScheduler],
  exports: [CostSheetsService, ExcelParserService, AiService, GoogleDriveService],
})
export class CostSheetsModule {}
