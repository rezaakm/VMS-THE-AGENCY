import { Module, forwardRef } from '@nestjs/common';
import { CostSheetsService } from './cost-sheets.service';
import { CostSheetsController } from './cost-sheets.controller';
import { ExcelParserService } from './excel-parser.service';
import { AiService } from './ai.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogleDriveModule } from '../google-drive/google-drive.module';

@Module({
  imports: [PrismaModule, forwardRef(() => GoogleDriveModule)],
  controllers: [CostSheetsController],
  providers: [CostSheetsService, ExcelParserService, AiService],
  exports: [CostSheetsService, ExcelParserService, AiService],
})
export class CostSheetsModule {}
