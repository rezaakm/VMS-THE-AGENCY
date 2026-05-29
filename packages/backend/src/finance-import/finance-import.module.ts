import { Module } from '@nestjs/common';
import { FinanceImportService } from './finance-import.service';
import { FinanceImportController } from './finance-import.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FinanceImportController],
  providers: [FinanceImportService],
  exports: [FinanceImportService],
})
export class FinanceImportModule {}
