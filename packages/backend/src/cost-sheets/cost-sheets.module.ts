import { Module } from '@nestjs/common';
import { CostSheetsService } from './cost-sheets.service';
import { CostSheetsController } from './cost-sheets.controller';
import { ExcelParserService } from './excel-parser.service';
import { AiService } from './ai.service';
import { GoogleDriveService } from './google-drive.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CostSheetsController],
  providers: [CostSheetsService, ExcelParserService, AiService, GoogleDriveService],
  exports: [CostSheetsService, ExcelParserService, AiService, GoogleDriveService],
})
export class CostSheetsModule {}
