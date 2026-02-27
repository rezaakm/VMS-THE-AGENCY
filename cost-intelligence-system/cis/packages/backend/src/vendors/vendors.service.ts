import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

  async findAll(options?: { page?: number; limit?: number; search?: string; isActive?: boolean }) {
    const where: any = {};
    if (options?.isActive !== undefined) where.isActive = options.isActive;
    if (options?.search) where.name = { contains: options.search, mode: 'insensitive' };
    const page = options?.page || 1;
    const limit = options?.limit || 50;

    const [items, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        include: { _count: { select: { lineItems: true } } },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit, take: limit,
      }),
      this.prisma.vendor.count({ where }),
    ]);

    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: { _count: { select: { lineItems: true } } },
    });
    if (!vendor) return null;

    // Get category breakdown
    const categoryBreakdown = await this.prisma.lineItem.groupBy({
      by: ['categoryId'],
      where: { vendorId: id, categoryId: { not: null } },
      _count: true,
      _avg: { unitCost: true },
    });

    const categories = await Promise.all(
      categoryBreakdown.map(async (cb) => {
        const cat = cb.categoryId ? await this.prisma.category.findUnique({ where: { id: cb.categoryId } }) : null;
        return { name: cat?.name || 'Uncategorized', itemCount: cb._count, avgUnitCost: cb._avg.unitCost || 0 };
      })
    );

    // Get recent items
    const recentItems = await this.prisma.lineItem.findMany({
      where: { vendorId: id },
      include: { project: { include: { client: true } }, category: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Financial summary
    const financials = await this.prisma.lineItem.aggregate({
      where: { vendorId: id },
      _sum: { totalCost: true, totalSelling: true },
      _avg: { unitCost: true, marginPct: true },
      _count: true,
    });

    return { ...vendor, categories, recentItems, financials };
  }

  async update(id: string, data: { reliabilityScore?: number; notes?: string; isActive?: boolean; contactName?: string; phone?: string; email?: string }) {
    return this.prisma.vendor.update({ where: { id }, data });
  }
}
