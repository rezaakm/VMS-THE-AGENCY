import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExcelParserService } from './excel-parser.service';

@Injectable()
export class CostSheetsService {
  constructor(
    private prisma: PrismaService,
    private excelParser: ExcelParserService,
  ) {}

  async findAll(filters?: { jobNumber?: string; client?: string; search?: string }) {
    const where: any = {};

    if (filters?.jobNumber) {
      where.jobNumber = { contains: filters.jobNumber, mode: 'insensitive' };
    }
    if (filters?.client) {
      where.client = { contains: filters.client, mode: 'insensitive' };
    }
    if (filters?.search) {
      where.OR = [
        { jobNumber: { contains: filters.search, mode: 'insensitive' } },
        { client: { contains: filters.search, mode: 'insensitive' } },
        { event: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.costSheet.findMany({
      where,
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const costSheet = await this.prisma.costSheet.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!costSheet) throw new NotFoundException(`Cost sheet ${id} not found`);
    return costSheet;
  }

  async searchItems(filters: {
    description?: string;
    vendor?: string;
    jobNumber?: string;
    client?: string;
    minCost?: number;
    maxCost?: number;
  }) {
    const where: any = {};

    if (filters.description) {
      where.description = { contains: filters.description, mode: 'insensitive' };
    }
    if (filters.vendor) {
      where.vendor = { contains: filters.vendor, mode: 'insensitive' };
    }
    if (filters.minCost !== undefined || filters.maxCost !== undefined) {
      where.totalCost = {};
      if (filters.minCost !== undefined) where.totalCost.gte = filters.minCost;
      if (filters.maxCost !== undefined) where.totalCost.lte = filters.maxCost;
    }

    const items = await this.prisma.costSheetItem.findMany({
      where,
      include: {
        costSheet: {
          select: { id: true, jobNumber: true, client: true, event: true, date: true },
        },
      },
      orderBy: { totalCost: 'desc' },
      take: 500,
    });

    let result = items;
    if (filters.jobNumber) {
      result = result.filter((i) =>
        i.costSheet?.jobNumber?.toLowerCase().includes(filters.jobNumber!.toLowerCase()),
      );
    }
    if (filters.client) {
      result = result.filter((i) =>
        i.costSheet?.client?.toLowerCase().includes(filters.client!.toLowerCase()),
      );
    }
    return result;
  }

  async compareVendors(vendor1: string, vendor2: string) {
    const getStats = async (vendorName: string) => {
      const items = await this.prisma.costSheetItem.findMany({
        where: { vendor: { contains: vendorName, mode: 'insensitive' } },
        include: { costSheet: { select: { date: true } } },
      });

      if (items.length === 0) {
        return { vendor: vendorName, avgUnitCost: 0, avgTotalCost: 0, totalJobs: 0, itemCount: 0, recentItems: [] };
      }

      const validCosts = items.filter((i) => i.totalCost != null);
      const avgTotalCost = validCosts.length > 0
        ? validCosts.reduce((sum, i) => sum + (i.totalCost || 0), 0) / validCosts.length
        : 0;

      const validUnitCosts = items.filter((i) => i.unitCost != null);
      const avgUnitCost = validUnitCosts.length > 0
        ? validUnitCosts.reduce((sum, i) => sum + (i.unitCost || 0), 0) / validUnitCosts.length
        : 0;

      const uniqueSheets = new Set(items.map((i) => i.costSheetId));
      const recentItems = items.slice(0, 5).map((item) => ({
        description: item.description,
        totalCost: item.totalCost || 0,
        date: item.costSheet?.date || null,
      }));

      return {
        vendor: vendorName,
        avgUnitCost,
        avgTotalCost,
        totalJobs: uniqueSheets.size,
        itemCount: items.length,
        recentItems,
      };
    };

    const [v1Stats, v2Stats] = await Promise.all([getStats(vendor1), getStats(vendor2)]);
    return { v1: v1Stats, v2: v2Stats };
  }

  async getVendorTrend(vendor1?: string, vendor2?: string) {
    const getMonthlyData = async (vendor: string) => {
      if (!vendor || vendor === 'none') return [];

      const items = await this.prisma.costSheetItem.findMany({
        where: { vendor: { contains: vendor, mode: 'insensitive' } },
        include: { costSheet: { select: { date: true } } },
      });

      const monthlyMap = new Map<string, number>();
      items.forEach((item) => {
        if (item.costSheet?.date && item.totalCost) {
          const month = new Date(item.costSheet.date).toISOString().substring(0, 7);
          monthlyMap.set(month, (monthlyMap.get(month) || 0) + item.totalCost);
        }
      });

      return Array.from(monthlyMap.entries())
        .map(([month, cost]) => ({ month, cost, vendor }))
        .sort((a, b) => a.month.localeCompare(b.month));
    };

    const [data1, data2] = await Promise.all([
      vendor1 ? getMonthlyData(vendor1) : [],
      vendor2 ? getMonthlyData(vendor2) : [],
    ]);

    const allMonths = Array.from(new Set([...data1.map((d) => d.month), ...data2.map((d) => d.month)])).sort();
    const merged = allMonths.map((month) => ({
      month,
      [vendor1 || 'v1']: data1.find((d) => d.month === month)?.cost || 0,
      [vendor2 || 'v2']: data2.find((d) => d.month === month)?.cost || 0,
    }));

    const calcTrend = (data: typeof data1) => {
      if (data.length < 2) return 0;
      const current = data[data.length - 1].cost;
      const previous = data[data.length - 2].cost;
      return previous === 0 ? 0 : ((current - previous) / previous) * 100;
    };

    return { data: merged, trend: { v1: calcTrend(data1), v2: calcTrend(data2) } };
  }

  async getUniqueVendors() {
    const items = await this.prisma.costSheetItem.findMany({
      where: { vendor: { not: null } },
      select: { vendor: true },
      distinct: ['vendor'],
    });
    return items.map((i) => i.vendor).filter((v): v is string => v != null).sort();
  }

  async uploadAndParse(fileBuffer: Buffer, fileName: string, driveFileId?: string) {
    return this.excelParser.parseAndInsert(fileBuffer, fileName, driveFileId || `upload-${Date.now()}`);
  }

  async getStats() {
    const [totalSheets, totalItems, vendors] = await Promise.all([
      this.prisma.costSheet.count(),
      this.prisma.costSheetItem.count(),
      this.prisma.costSheetItem.findMany({
        where: { vendor: { not: null } },
        select: { vendor: true },
        distinct: ['vendor'],
      }),
    ]);

    const totalValue = await this.prisma.costSheetItem.aggregate({ _sum: { totalCost: true } });

    return {
      totalSheets,
      totalItems,
      totalVendors: vendors.length,
      totalValue: totalValue._sum.totalCost || 0,
    };
  }
}
