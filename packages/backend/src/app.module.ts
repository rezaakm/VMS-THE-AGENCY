import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AuthModule } from './auth/auth.module';
import { VendorsModule } from './vendors/vendors.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { ContractsModule } from './contracts/contracts.module';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { ReportsModule } from './reports/reports.module';
import { UsersModule } from './users/users.module';
import { CostSheetsModule } from './cost-sheets/cost-sheets.module';
import { CostEngineModule } from './cost-engine/cost-engine.module';
import { AiAssistantModule } from './ai-assistant/ai-assistant.module';
import { RfqsModule } from './rfqs/rfqs.module';
import { FinancialOversightModule } from './financial-oversight/financial-oversight.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditLogModule,
    AuthModule,
    UsersModule,
    VendorsModule,
    PurchaseOrdersModule,
    ContractsModule,
    EvaluationsModule,
    ReportsModule,
    CostSheetsModule,
    CostEngineModule,
    AiAssistantModule,
    RfqsModule,
    FinancialOversightModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

