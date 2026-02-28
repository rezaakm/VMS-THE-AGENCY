import { Module } from '@nestjs/common';
import { CostEngineService } from './cost-engine.service';
import { CostEngineController } from './cost-engine.controller';
import { DocumentService } from './document.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CostEngineController],
  providers: [CostEngineService, DocumentService],
  exports: [CostEngineService, DocumentService],
})
export class CostEngineModule {}
