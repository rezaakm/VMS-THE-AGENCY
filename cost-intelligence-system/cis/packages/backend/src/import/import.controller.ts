import { Controller, Post, UploadedFile, UseInterceptors, Body, Get } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ImportService } from './import.service';

@ApiTags('Import')
@Controller('api/import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('initialize')
  @ApiOperation({ summary: 'Initialize categories and normalization maps' })
  async initialize() {
    await this.importService.initialize();
    return { message: 'Initialized successfully' };
  }

  @Post('file')
  @ApiOperation({ summary: 'Upload and import a single Excel cost sheet' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('year') year: string,
  ) {
    if (!file) {
      return { success: false, error: 'No file provided' };
    }
    await this.importService.initialize();
    return this.importService.importFromBuffer(
      file.buffer,
      file.originalname,
      parseInt(year) || new Date().getFullYear(),
    );
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk import from a directory path (server-side)' })
  async importBulk(@Body() body: { path: string; year: number }) {
    await this.importService.initialize();
    return this.importService.importDirectory(body.path, body.year);
  }
}
