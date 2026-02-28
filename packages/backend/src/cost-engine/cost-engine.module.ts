import { Module } from '@nestjs/common';
import { CostEngineService } from './cost-engine.service';
import { CostEngineController } from './cost-engine.controller';
import { DocumentService } from './document.service';
import { OnlinePriceLookupService } from './online-price-lookup.service';
import { PoPriceExtractorService } from './po-price-extractor.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CostEngineController],
  providers: [CostEngineService, DocumentService, OnlinePriceLookupService, PoPriceExtractorService],
  exports: [CostEngineService, DocumentService, OnlinePriceLookupService, PoPriceExtractorService],
})
export class CostEngineModule {}
