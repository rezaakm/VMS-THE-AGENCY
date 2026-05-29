import { Module } from '@nestjs/common';
import { FinancialOversightController } from './financial-oversight.controller';
import { FinancialOversightService } from './financial-oversight.service';
import { FinancialOversightScheduler } from './financial-oversight.scheduler';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FinancialOversightController],
  providers: [FinancialOversightService, FinancialOversightScheduler],
  exports: [FinancialOversightService],
})
export class FinancialOversightModule {}
