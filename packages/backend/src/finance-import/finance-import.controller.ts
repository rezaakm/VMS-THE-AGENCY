import { Controller, Post, Body, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
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
    // For now we save the file locally or to a temp path
    // In production you'd use proper storage
    const tempPath = `./uploads/${Date.now()}-${file.originalname}`;
    require('fs').writeFileSync(tempPath, file.buffer);

    return this.importService.ingestMonthlyFinancePack(tempPath, body.period, 'current-user-id'); // TODO: get from request
  }
}
