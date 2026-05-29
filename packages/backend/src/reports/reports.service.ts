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

  async getArAging() {
    const receivables = await this.prisma.clientReceivable.findMany({
      where: { status: { in: ['PENDING', 'OVERDUE'] } },
      orderBy: { dueDate: 'asc' },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const buckets = {
      current: 0,
      days1_30: 0,
      days31_60: 0,
      days61_90: 0,
      days90_plus: 0,
      total: 0,
    };

    const details = receivables
      .map((r) => {
        const outstanding = r.amount - r.paidAmount;
        if (outstanding <= 0) return null;

        const due = new Date(r.dueDate);
        due.setHours(0, 0, 0, 0);
        const daysPast = Math.floor(
          (today.getTime() - due.getTime()) / 86400000,
        );

        let bucket: 'current' | 'days1_30' | 'days31_60' | 'days61_90' | 'days90_plus' =
          'current';
        if (daysPast <= 0) bucket = 'current';
        else if (daysPast <= 30) bucket = 'days1_30';
        else if (daysPast <= 60) bucket = 'days31_60';
        else if (daysPast <= 90) bucket = 'days61_90';
        else bucket = 'days90_plus';

        buckets[bucket] += outstanding;
        buckets.total += outstanding;

        return {
          id: r.id,
          clientName: r.clientName,
          reference: r.reference,
          dueDate: r.dueDate,
          outstanding,
          daysPast: Math.max(0, daysPast),
          bucket,
        };
      })
      .filter(Boolean);

    return {
      asOf: today.toISOString(),
      currency: 'OMR',
      buckets,
      details,
    };
  }

  async getMonthlyPlSummary(year?: number, month?: number) {
    const now = new Date();
    const y = year ?? now.getFullYear();
    const m = month ?? now.getMonth() + 1;
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59, 999);

    const [poAgg, paidInvoices, ar] = await Promise.all([
      this.prisma.purchaseOrder.aggregate({
        _sum: { totalAmount: true },
        where: {
          status: 'COMPLETED',
          orderDate: { gte: start, lte: end },
        },
      }),
      this.prisma.invoice.aggregate({
        _sum: { paidAmount: true },
        where: {
          status: 'PAID',
          paidDate: { gte: start, lte: end },
        },
      }),
      this.getArAging(),
    ]);

    return {
      period: `${y}-${String(m).padStart(2, '0')}`,
      currency: 'OMR',
      procurementSpendCompleted: poAgg._sum.totalAmount || 0,
      vendorPaymentsRecorded: paidInvoices._sum.paidAmount || 0,
      outstandingReceivables: ar.buckets.total,
      note:
        'Operational summary from VMS procurement and AR data. Full revenue and OpEx P&L requires Zoho Books integration (Phase 4).',
    };
  }

  async getSpendByVendorCsv(): Promise<string> {
    const rows = await this.getSpendByVendor();
    const header = 'Vendor,Code,Total Spent (OMR),Order Count';
    const lines = rows.map(
      (r) =>
        `"${r.vendorName.replace(/"/g, '""')}",${r.vendorCode},${r.totalSpent},${r.orderCount}`,
    );
    return [header, ...lines].join('\n');
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

