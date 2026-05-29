import { Module } from '@nestjs/common';
import { ZohoBooksController } from './zoho-books.controller';
import { ZohoBooksService } from './zoho-books.service';
import { ZohoOAuthService } from './zoho-oauth.service';
import { ZohoApiClient } from './zoho-api.client';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [PrismaModule, AuthModule, AuditLogModule],
  controllers: [ZohoBooksController],
  providers: [ZohoBooksService, ZohoOAuthService, ZohoApiClient],
  exports: [ZohoBooksService, ZohoOAuthService],
})
export class ZohoBooksModule {}
