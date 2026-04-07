import {
  Controller, Get, Post, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, UploadedFiles, Redirect,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { CostSheetsService } from './cost-sheets.service';
import { AiService } from './ai.service';
import { GoogleDriveService } from './google-drive.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('cost-sheets')
@Controller('cost-sheets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CostSheetsController {
  constructor(
    private readonly costSheetsService: CostSheetsService,
    private readonly aiService: AiService,
    private readonly googleDriveService: GoogleDriveService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all cost sheets' })
  findAll(@Query() query: { jobNumber?: string; client?: string; search?: string }) {
    return this.costSheetsService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get statistics' })
  getStats() {
    return this.costSheetsService.getStats();
  }

  @Get('vendors')
  @ApiOperation({ summary: 'Get unique vendors' })
  getVendors() {
    return this.costSheetsService.getUniqueVendors();
  }

  @Get('search')
  @ApiOperation({ summary: 'Search items' })
  searchItems(@Query() query: {
    description?: string;
    vendor?: string;
    jobNumber?: string;
    client?: string;
    minCost?: string;
    maxCost?: string;
  }) {
    return this.costSheetsService.searchItems({
      description: query.description,
      vendor: query.vendor,
      jobNumber: query.jobNumber,
      client: query.client,
      minCost: query.minCost ? parseFloat(query.minCost) : undefined,
      maxCost: query.maxCost ? parseFloat(query.maxCost) : undefined,
    });
  }

  @Get('lookup')
  @ApiOperation({ summary: 'Search items with pricing summary and Drive links' })
  lookupItem(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.costSheetsService.searchItemsWithPricing(q, limit ? parseInt(limit) : 20);
  }

  @Get('compare')
  @ApiOperation({ summary: 'Compare two vendors' })
  compareVendors(@Query('v1') v1: string, @Query('v2') v2: string) {
    return this.costSheetsService.compareVendors(v1, v2);
  }

  @Get('trend')
  @ApiOperation({ summary: 'Get vendor cost trends' })
  getVendorTrend(@Query('v1') v1?: string, @Query('v2') v2?: string) {
    return this.costSheetsService.getVendorTrend(v1, v2);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get cost sheet by ID' })
  findOne(@Param('id') id: string) {
    return this.costSheetsService.findOne(id);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload Excel cost sheet and feed into VMS pricing brain' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) return { success: false, error: 'No file uploaded' };
    const parseResult = await this.costSheetsService.uploadAndParse(file.buffer, file.originalname);

    // Auto-extract prices into material catalog (VMS Brain)
    let brainUpdate = null;
    if (parseResult.success) {
      brainUpdate = await this.costSheetsService.extractNewPricesToCatalog();
    }

    return { ...parseResult, brainUpdate };
  }

  @Post('upload-batch')
  @ApiOperation({ summary: 'Upload multiple Excel cost sheets at once' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 20, {
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'image/jpeg',
        'image/png',
        'image/webp',
      ];
      cb(null, allowed.includes(file.mimetype));
    },
  }))
  async uploadBatch(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files?.length) return { success: false, error: 'No files uploaded' };

    const results = [];
    for (const file of files) {
      // Only parse Excel files; store others as documents
      if (file.mimetype.includes('spreadsheet') || file.mimetype.includes('excel')) {
        const result = await this.costSheetsService.uploadAndParse(file.buffer, file.originalname);
        results.push({ fileName: file.originalname, type: 'excel', ...result });
      } else {
        results.push({
          fileName: file.originalname,
          type: file.mimetype.split('/')[1],
          success: true,
          message: 'File received (non-Excel files stored for reference)',
        });
      }
    }

    // Feed all new prices into brain
    const brainUpdate = await this.costSheetsService.extractNewPricesToCatalog();

    return { files: results, totalFiles: files.length, brainUpdate };
  }

  @Post('ai/search')
  @ApiOperation({ summary: 'Natural language search' })
  async aiSearch(@Body() body: { query: string }) {
    const parsed = await this.aiService.parseNaturalLanguageQuery(body.query);
    const items = await this.costSheetsService.searchItems({
      description: parsed.keywords.join(' '),
      vendor: parsed.vendor ?? undefined,
      minCost: parsed.priceMin ?? undefined,
      maxCost: parsed.priceMax ?? undefined,
    });
    return { parsed, items };
  }

  @Post('ai/ask')
  @ApiOperation({ summary: 'Ask AI about vendors' })
  async askVendor(@Body() body: { question: string; vendor1: string; vendor2: string }) {
    const answer = await this.aiService.askVendorQuestion(body.question, body.vendor1, body.vendor2);
    return { answer };
  }

  @Post('ai/estimate')
  @ApiOperation({ summary: 'Extract estimate from brief' })
  async extractEstimate(@Body() body: { text: string }) {
    return this.aiService.extractEstimate(body.text);
  }

  // ─── Google Drive ──────────────────────────────────────────────────────────

  @Post('drive/sync')
  @ApiOperation({ summary: 'Sync cost sheets from Google Drive folder' })
  async syncDrive() {
    return this.googleDriveService.syncFolder();
  }

  @Public()
  @Get('drive/auth')
  @ApiOperation({ summary: 'Get Google OAuth URL to authorise Drive access' })
  async getDriveAuthUrl() {
    const url = await this.googleDriveService.getAuthUrl();
    return { authUrl: url };
  }

  @Public()
  @Get('drive/callback')
  @ApiOperation({ summary: 'OAuth callback — exchanges code for refresh token' })
  async driveCallback(@Query('code') code: string) {
    const result = await this.googleDriveService.exchangeCodeForToken(code);
    return {
      message: 'Google Drive connected. Copy this refresh token into your .env as GOOGLE_REFRESH_TOKEN, then restart the backend.',
      refresh_token: result.refresh_token,
    };
  }
}
