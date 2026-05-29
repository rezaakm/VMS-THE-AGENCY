import { Controller, Post, UseGuards, UploadedFile, UseInterceptors, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { FinanceImportService } from './finance-import.service';

@Controller('finance-import')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceImportController {
  constructor(private readonly importService: FinanceImportService) {}

  @Post('monthly-pack')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @UseInterceptors(FileInterceptor('file'))
  async importMonthlyPack(@UploadedFile() file: Express.Multer.File, @Body() body: { period: string }) {
    const tempPath = `./uploads/${Date.now()}-${file.originalname}`;
    require('fs').writeFileSync(tempPath, file.buffer);
    return this.importService.ingestMonthlyFinancePack(tempPath, body.period, 'current-user');
  }

  @Post('pl-report')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @UseInterceptors(FileInterceptor('file'))
  async importPLReport(@UploadedFile() file: Express.Multer.File, @Body() body: { period: string }) {
    const tempPath = `./uploads/${Date.now()}-${file.originalname}`;
    require('fs').writeFileSync(tempPath, file.buffer);
    return this.importService.ingestPLReportPdf(tempPath, body.period, 'current-user');
  }

  /**
   * Import a single detailed cost sheet (from Cost Sheet-Master folder).
   * Example: the Saud Bahwan iCAUR file the user just provided.
   */
  @Post('cost-sheet')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @UseInterceptors(FileInterceptor('file'))
  async importCostSheet(@UploadedFile() file: Express.Multer.File) {
    const tempPath = `./uploads/${Date.now()}-${file.originalname}`;
    require('fs').writeFileSync(tempPath, file.buffer);
    return this.importService.importCostSheetFromMaster(tempPath);
  }

  /**
   * Bulk import the entire Cost Sheet-Master folder from the user's machine.
   * This is powerful for sucking in years of detailed job cost data at once.
   */
  @Post('cost-sheet-master-folder')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async importCostSheetMasterFolder(@Body() body: { folderPath: string }) {
    return this.importService.importCostSheetMasterFolder(body.folderPath);
  }
}
