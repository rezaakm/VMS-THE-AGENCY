import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const categories = await this.prisma.category.findMany({
      include: { _count: { select: { items: true } } },
      orderBy: { name: 'asc' },
    });

    // Enrich with pricing stats
    return Promise.all(categories.map(async (cat) => {
      const stats = await this.prisma.lineItem.aggregate({
        where: { categoryId: cat.id, unitCost: { gt: 0 } },
        _avg: { unitCost: true, marginPct: true },
        _min: { unitCost: true },
        _max: { unitCost: true },
      });
      return {
        ...cat,
        itemCount: cat._count.items,
        avgUnitCost: Math.round((stats._avg.unitCost || 0) * 100) / 100,
        minUnitCost: Math.round((stats._min.unitCost || 0) * 100) / 100,
        maxUnitCost: Math.round((stats._max.unitCost || 0) * 100) / 100,
        avgMarginPct: Math.round((stats._avg.marginPct || 0) * 100) / 100,
      };
    }));
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) return null;

    const items = await this.prisma.lineItem.findMany({
      where: { categoryId: id },
      include: { vendor: true, project: { include: { client: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Vendor breakdown for this category
    const vendorBreakdown = await this.prisma.lineItem.groupBy({
      by: ['vendorId'],
      where: { categoryId: id, vendorId: { not: null }, unitCost: { gt: 0 } },
      _count: true,
      _avg: { unitCost: true },
    });

    const vendors = await Promise.all(
      vendorBreakdown.map(async (vb) => {
        const vendor = vb.vendorId ? await this.prisma.vendor.findUnique({ where: { id: vb.vendorId } }) : null;
        return { name: vendor?.name || 'Unknown', itemCount: vb._count, avgUnitCost: Math.round((vb._avg.unitCost || 0) * 100) / 100 };
      })
    );

    return { ...category, items, vendors: vendors.sort((a, b) => b.itemCount - a.itemCount) };
  }
}
