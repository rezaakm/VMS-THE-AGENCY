import { Module } from '@nestjs/common';
import { FinancialOversightController } from './financial-oversight.controller';
import { FinancialOversightService } from './financial-oversight.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FinancialOversightController],
  providers: [FinancialOversightService],
  exports: [FinancialOversightService],
})
export class FinancialOversightModule {}
