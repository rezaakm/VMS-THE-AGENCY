import {
  Controller, Get, Post, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, Redirect,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
  @ApiOperation({ summary: 'Upload Excel cost sheet' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) return { success: false, error: 'No file uploaded' };
    return this.costSheetsService.uploadAndParse(file.buffer, file.originalname);
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

  @Get('drive/status')
  @ApiOperation({ summary: 'Check if Google Drive is connected (very useful for testing existing refresh tokens)' })
  async getDriveStatus() {
    try {
      // This will attempt a lightweight call using whatever GOOGLE_REFRESH_TOKEN is in the environment
      const result = await this.googleDriveService.syncCostSheetMasterArchive('1uDCJBOZARhEiBrOEdG3QP2Cm0GrNI-2I');
      return {
        connected: true,
        message: 'Google Drive connection successful!',
        filesFoundInArchive: result.filesFound,
        newlyProcessed: result.filesProcessed,
      };
    } catch (err: any) {
      return {
        connected: false,
        message: 'Google Drive connection failed.',
        error: err.message,
        hint: 'Most common cause: GOOGLE_REFRESH_TOKEN is missing, expired, or invalid. You can reuse a token from previous Cursor setups if it still works.',
      };
    }
  }

  @Post('drive/sync')
  @ApiOperation({ summary: 'Sync cost sheets from Google Drive folder (general)' })
  async syncDrive() {
    return this.googleDriveService.syncFolder();
  }

  /**
   * Dedicated endpoint for your full historical Cost Sheet Master archive.
   * This folder contains all your detailed cost sheets from 2023 onwards.
   */
  @Post('drive/sync-cost-sheet-master')
  @ApiOperation({ summary: 'Sync your full historical Cost Sheet Master archive (2023-present) from Google Drive' })
  async syncCostSheetMasterArchive(@Body() body?: { masterFolderId?: string }) {
    const folderId = body?.masterFolderId || '1uDCJBOZARhEiBrOEdG3QP2Cm0GrNI-2I';
    return this.googleDriveService.syncCostSheetMasterArchive(folderId);
  }

  /**
   * ONE-CLICK for you (no parameters needed).
   * This will sync your entire historical Cost Sheet Master archive using your already-configured credentials.
   */
  @Post('drive/sync-my-historical-archive')
  @ApiOperation({ summary: 'One-click sync of your full historical Cost Sheet Master (2023+) from Google Drive' })
  async syncMyHistoricalArchive() {
    return this.googleDriveService.syncCostSheetMasterArchive('1uDCJBOZARhEiBrOEdG3QP2Cm0GrNI-2I');
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
