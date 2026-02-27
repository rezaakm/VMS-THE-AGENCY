import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const [
      totalVendors,
      activeVendors,
      totalPOs,
      activePOs,
      totalContracts,
      activeContracts,
      expiringContracts,
    ] = await Promise.all([
      this.prisma.vendor.count(),
      this.prisma.vendor.count({ where: { status: 'ACTIVE' } }),
      this.prisma.purchaseOrder.count(),
      this.prisma.purchaseOrder.count({
        where: { status: { in: ['APPROVED', 'IN_PROGRESS'] } },
      }),
      this.prisma.contract.count(),
      this.prisma.contract.count({ where: { status: 'ACTIVE' } }),
      this.getExpiringContractsCount(30),
    ]);

    const totalSpend = await this.prisma.purchaseOrder.aggregate({
      _sum: { totalAmount: true },
      where: { status: 'COMPLETED' },
    });

    return {
      vendors: {
        total: totalVendors,
        active: activeVendors,
      },
      purchaseOrders: {
        total: totalPOs,
        active: activePOs,
      },
      contracts: {
        total: totalContracts,
        active: activeContracts,
        expiring: expiringContracts,
      },
      spend: {
        total: totalSpend._sum.totalAmount || 0,
      },
    };
  }

  async getSpendByVendor(startDate?: Date, endDate?: Date) {
    const where: any = { status: 'COMPLETED' };

    if (startDate && endDate) {
      where.orderDate = {
        gte: startDate,
        lte: endDate,
      };
    }

    const orders = await this.prisma.purchaseOrder.groupBy({
      by: ['vendorId'],
      where,
      _sum: {
        totalAmount: true,
      },
      _count: {
        id: true,
      },
    });

    // Get vendor details
    const vendorIds = orders.map((o) => o.vendorId);
    const vendors = await this.prisma.vendor.findMany({
      where: { id: { in: vendorIds } },
      select: { id: true, name: true, code: true },
    });

    return orders.map((order) => {
      const vendor = vendors.find((v) => v.id === order.vendorId);
      return {
        vendorId: order.vendorId,
        vendorName: vendor?.name || 'Unknown',
        vendorCode: vendor?.code || 'N/A',
        totalSpent: order._sum.totalAmount || 0,
        orderCount: order._count.id,
      };
    }).sort((a, b) => b.totalSpent - a.totalSpent);
  }

  async getSpendByCategory(startDate?: Date, endDate?: Date) {
    const where: any = { status: 'COMPLETED' };

    if (startDate && endDate) {
      where.orderDate = {
        gte: startDate,
        lte: endDate,
      };
    }

    const orders = await this.prisma.purchaseOrder.findMany({
      where,
      select: {
        totalAmount: true,
        vendor: {
          select: {
            category: true,
          },
        },
      },
    });

    const categoryMap = new Map<string, number>();

    orders.forEach((order) => {
      const category = order.vendor.category || 'Uncategorized';
      const current = categoryMap.get(category) || 0;
      categoryMap.set(category, current + order.totalAmount);
    });

    return Array.from(categoryMap.entries())
      .map(([category, totalSpent]) => ({
        category,
        totalSpent,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }

  async getMonthlySpend(months: number = 12) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const orders = await this.prisma.purchaseOrder.findMany({
      where: {
        status: 'COMPLETED',
        orderDate: {
          gte: startDate,
        },
      },
      select: {
        orderDate: true,
        totalAmount: true,
      },
    });

    const monthlyData = new Map<string, number>();

    orders.forEach((order) => {
      const monthKey = order.orderDate.toISOString().substring(0, 7); // YYYY-MM
      const current = monthlyData.get(monthKey) || 0;
      monthlyData.set(monthKey, current + order.totalAmount);
    });

    return Array.from(monthlyData.entries())
      .map(([month, totalSpent]) => ({
        month,
        totalSpent,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  async getVendorPerformanceReport() {
    const vendors = await this.prisma.vendor.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        code: true,
        performanceScore: true,
        totalOrders: true,
        totalSpent: true,
        evaluations: {
          take: 1,
          orderBy: { evaluationDate: 'desc' },
          select: {
            qualityScore: true,
            deliveryScore: true,
            pricingScore: true,
            serviceScore: true,
            evaluationDate: true,
          },
        },
      },
      orderBy: {
        performanceScore: 'desc',
      },
    });

    return vendors.map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      code: vendor.code,
      performanceScore: vendor.performanceScore || 0,
      totalOrders: vendor.totalOrders,
      totalSpent: vendor.totalSpent,
      lastEvaluation: vendor.evaluations[0] || null,
    }));
  }

  private async getExpiringContractsCount(days: number): Promise<number> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return this.prisma.contract.count({
      where: {
        status: 'ACTIVE',
        endDate: {
          lte: futureDate,
          gte: new Date(),
        },
      },
    });
  }
}

