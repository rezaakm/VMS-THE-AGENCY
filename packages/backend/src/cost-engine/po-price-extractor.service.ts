import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PriceSource } from '@prisma/client';

export interface ExtractionResult {
  linesProcessed: number;
  materialsCreated: number;
  pricesInserted: number;
  skipped: number;
  errors: string[];
}

@Injectable()
export class PoPriceExtractorService {
  private readonly logger = new Logger(PoPriceExtractorService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Reads all APPROVED PO line items and inserts their unit prices into the
   * raw material price catalog (source = VENDOR_PO). Already-imported lines
   * are skipped by checking for an existing price with the same sourceRef.
   */
  async extractFromPurchaseOrders(): Promise<ExtractionResult> {
    const result: ExtractionResult = {
      linesProcessed: 0,
      materialsCreated: 0,
      pricesInserted: 0,
      skipped: 0,
      errors: [],
    };

    const orders = await this.prisma.purchaseOrder.findMany({
      where: { status: { in: ['APPROVED', 'IN_PROGRESS', 'COMPLETED'] } },
      include: {
        items: true,
        vendor: { select: { name: true } },
      },
    });

    for (const order of orders) {
      for (const item of order.items) {
        result.linesProcessed++;

        if (!item.description || !item.unitPrice || item.unitPrice <= 0) {
          result.skipped++;
          continue;
        }

        const sourceRef = `PO:${order.orderNumber}:item:${item.id}`;

        // Skip if already imported
        const exists = await this.prisma.materialPrice.findFirst({
          where: { sourceRef },
        });
        if (exists) {
          result.skipped++;
          continue;
        }

        try {
          // Find or create the raw material by description
          let material = await this.prisma.rawMaterial.findFirst({
            where: { name: { equals: item.description, mode: 'insensitive' } },
          });

          if (!material) {
            material = await this.prisma.rawMaterial.create({
              data: {
                name: item.description,
                unit: 'piece',
              },
            });
            result.materialsCreated++;
          }

          await this.prisma.materialPrice.create({
            data: {
              materialId: material.id,
              source: PriceSource.VENDOR_PO,
              unitPrice: item.unitPrice,
              currency: 'OMR',
              vendorName: order.vendor.name,
              sourceRef,
              confidence: 0.9,
            },
          });

          result.pricesInserted++;
        } catch (err: any) {
          result.errors.push(`${item.description}: ${err.message}`);
          this.logger.error(`Failed to extract price from PO item: ${err.message}`);
        }
      }
    }

    this.logger.log(
      `PO extraction complete: ${result.linesProcessed} lines, ` +
      `${result.pricesInserted} prices inserted, ${result.materialsCreated} new materials, ` +
      `${result.skipped} skipped`,
    );

    return result;
  }

  /**
   * Reads cost sheet items and uses them as historical price data.
   * Maps CostSheetItem.description + vendor → raw material price (COST_SHEET source).
   */
  async extractFromCostSheets(): Promise<ExtractionResult> {
    const result: ExtractionResult = {
      linesProcessed: 0,
      materialsCreated: 0,
      pricesInserted: 0,
      skipped: 0,
      errors: [],
    };

    const items = await this.prisma.costSheetItem.findMany({
      where: {
        unitCost: { gt: 0 },
        description: { not: '' },
      },
      include: {
        costSheet: { select: { driveFileId: true, fileName: true } },
      },
      take: 5000,
    });

    for (const item of items) {
      result.linesProcessed++;

      const sourceRef = `COSTSHEET:${item.id}`;
      const exists = await this.prisma.materialPrice.findFirst({ where: { sourceRef } });
      if (exists) { result.skipped++; continue; }

      try {
        let material = await this.prisma.rawMaterial.findFirst({
          where: { name: { equals: item.description, mode: 'insensitive' } },
        });
        if (!material) {
          material = await this.prisma.rawMaterial.create({
            data: { name: item.description, unit: item.days ? 'day' : 'piece' },
          });
          result.materialsCreated++;
        }

        await this.prisma.materialPrice.create({
          data: {
            materialId: material.id,
            source: PriceSource.COST_SHEET,
            unitPrice: item.unitCost!,
            currency: 'OMR',
            vendorName: item.vendor ?? undefined,
            sourceRef,
            confidence: 0.8,
          },
        });
        result.pricesInserted++;
      } catch (err: any) {
        result.errors.push(`${item.description}: ${err.message}`);
      }
    }

    this.logger.log(
      `Cost sheet extraction: ${result.pricesInserted} prices from ${result.linesProcessed} items`,
    );

    return result;
  }
}
