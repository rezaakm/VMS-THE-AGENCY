import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
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
import { ZohoBooksService } from './zoho-books.service';
import { ZohoOAuthService } from './zoho-oauth.service';

function encodeOAuthState(userId: string): string {
  return Buffer.from(JSON.stringify({ userId, ts: Date.now() }), 'utf8').toString(
    'base64url',
  );
}

function decodeOAuthState(state: string): string {
  try {
    const parsed = JSON.parse(
      Buffer.from(state, 'base64url').toString('utf8'),
    ) as { userId?: string };
    if (!parsed.userId) throw new Error('missing userId');
    return parsed.userId;
  } catch {
    throw new BadRequestException('Invalid OAuth state');
  }
}

@ApiTags('zoho')
@Controller('zoho')
export class ZohoBooksController {
  constructor(
    private readonly zohoBooks: ZohoBooksService,
    private readonly oauth: ZohoOAuthService,
    private readonly config: ConfigService,
  ) {}

  private frontendSettingsUrl(query?: string): string {
    const base =
      this.config.get('FRONTEND_URL') || 'http://localhost:3000';
    return `${base}/dashboard/settings${query ? `?${query}` : ''}`;
  }

  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Zoho Books connection status' })
  getStatus() {
    return this.zohoBooks.getStatus();
  }

  @Get('auth/url')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'OAuth authorization URL (admin)' })
  getAuthUrl(@Request() req: { user: { id: string } }) {
    const state = encodeOAuthState(req.user.id);
    return { url: this.oauth.buildAuthorizationUrl(state) };
  }

  @Public()
  @Get('auth/callback')
  @ApiOperation({ summary: 'OAuth callback (public)' })
  async authCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    if (error) {
      return res.redirect(
        this.frontendSettingsUrl(
          `zoho=error&message=${encodeURIComponent(error)}`,
        ),
      );
    }
    if (!code || !state) {
      return res.redirect(
        this.frontendSettingsUrl('zoho=error&message=missing_code'),
      );
    }
    try {
      const userId = decodeOAuthState(state);
      await this.oauth.exchangeCode(code, userId);
      return res.redirect(this.frontendSettingsUrl('zoho=connected'));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'oauth_failed';
      return res.redirect(
        this.frontendSettingsUrl(
          `zoho=error&message=${encodeURIComponent(message)}`,
        ),
      );
    }
  }

  @Post('connect/env')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Connect using ZOHO_REFRESH_TOKEN + ZOHO_ORGANIZATION_ID' })
  connectFromEnv(@Request() req: { user: { id: string } }) {
    return this.oauth.connectFromEnv(req.user.id);
  }

  @Post('disconnect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect Zoho Books' })
  disconnect() {
    return this.oauth.disconnect();
  }

  @Post('organization')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set active Zoho organization' })
  setOrganization(
    @Body() body: { organizationId: string; organizationName?: string },
  ) {
    if (!body.organizationId) {
      throw new BadRequestException('organizationId is required');
    }
    return this.oauth.setOrganization(
      body.organizationId,
      body.organizationName,
    );
  }

  @Get('organizations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  listOrganizations() {
    return this.zohoBooks.listOrganizations();
  }

  @Get('accounts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiBearerAuth()
  listAccounts() {
    return this.zohoBooks.listChartOfAccounts();
  }

  @Get('contacts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiBearerAuth()
  listContacts(@Query('type') type?: 'customer' | 'vendor') {
    return this.zohoBooks.listContacts(type);
  }

  @Get('bills')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiBearerAuth()
  listBills() {
    return this.zohoBooks.listBills();
  }

  @Get('invoices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiBearerAuth()
  listInvoices() {
    return this.zohoBooks.listInvoices();
  }

  @Get('reports/profit-and-loss')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiBearerAuth()
  profitAndLoss(
    @Query('from_date') fromDate?: string,
    @Query('to_date') toDate?: string,
  ) {
    return this.zohoBooks.getProfitAndLoss({
      from_date: fromDate,
      to_date: toDate,
    });
  }

  @Get('sync-mappings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiBearerAuth()
  syncMappings() {
    return this.zohoBooks.getSyncMappings();
  }

  @Post('sync/vendor/:vendorId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.BUYER)
  @ApiBearerAuth()
  syncVendor(
    @Param('vendorId') vendorId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.zohoBooks.syncVendorToZoho(vendorId, req.user.id);
  }

  @Post('sync/purchase-order/:poId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.BUYER)
  @ApiBearerAuth()
  syncPurchaseOrder(
    @Param('poId') poId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.zohoBooks.createBillFromPurchaseOrder(poId, req.user.id);
  }
}
