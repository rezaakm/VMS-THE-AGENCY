import { Module } from '@nestjs/common';
import { FinancialOversightService } from './financial-oversight.service';
import { FinancialOversightController } from './financial-oversight.controller';
import { FinancialOversightScheduler } from './financial-oversight.scheduler';
import { FinancialOversightEmailService } from './financial-oversight.email.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [PrismaModule, AuditLogModule, ScheduleModule],
  controllers: [FinancialOversightController],
  providers: [
    FinancialOversightService,
    FinancialOversightScheduler,
    FinancialOversightEmailService,
  ],
  exports: [FinancialOversightService],
})
export class FinancialOversightModule {}
