import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { DriveCatalogService } from './drive-catalog.service';
import { GoogleDriveService } from './google-drive.service';

@ApiTags('google-drive')
@Controller('google-drive')
export class GoogleDriveController {
  constructor(
    private catalog: DriveCatalogService,
    private googleDrive: GoogleDriveService,
    private config: ConfigService,
  ) {}

  @Get('config')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Google Drive folder and connection status' })
  getConfig() {
    return this.catalog.getConfig();
  }

  @Put('folder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign the Google Drive folder to sync into the database' })
  assignFolder(@Body() body: { folderId: string; name?: string }) {
    return this.catalog.assignFolder(body.folderId, body.name);
  }

  @Get('files')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List cataloged Drive files from the assigned folder' })
  listFiles(
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.catalog.listFiles({ category, search });
  }

  @Post('sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.BUYER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Sync assigned folder: catalog all files + parse Excel cost sheets',
  })
  sync() {
    return this.catalog.syncCatalogAndCostSheets();
  }

  @Public()
  @Get('auth')
  @ApiOperation({ summary: 'Get Google OAuth URL for Drive read access' })
  async getAuthUrl() {
    const url = await this.googleDrive.getAuthUrl();
    return { authUrl: url };
  }

  @Public()
  @Get('auth/callback')
  @ApiOperation({ summary: 'OAuth callback — returns refresh token for .env' })
  async authCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontend =
      this.config.get('FRONTEND_URL') || 'http://localhost:3000';

    if (error) {
      return res.redirect(
        `${frontend}/dashboard/settings?drive=error&message=${encodeURIComponent(error)}`,
      );
    }
    if (!code) {
      return res.redirect(`${frontend}/dashboard/settings?drive=error`);
    }

    try {
      const result = await this.googleDrive.exchangeCodeForToken(code);
      const tokenParam = encodeURIComponent(result.refresh_token);
      return res.redirect(
        `${frontend}/dashboard/google-drive?drive=connected&token=${tokenParam}`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'oauth_failed';
      return res.redirect(
        `${frontend}/dashboard/google-drive?drive=error&message=${encodeURIComponent(message)}`,
      );
    }
  }
}
