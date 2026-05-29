import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
