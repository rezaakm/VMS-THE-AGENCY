import { Module } from '@nestjs/common';
import { BoqController } from './boq.controller';
import { BoqService } from './boq.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CostEngineModule } from '../cost-engine/cost-engine.module';
import { CostSheetsModule } from '../cost-sheets/cost-sheets.module';

@Module({
  imports: [PrismaModule, CostEngineModule, CostSheetsModule],
  controllers: [BoqController],
  providers: [BoqService],
  exports: [BoqService],
})
export class BoqModule {}
