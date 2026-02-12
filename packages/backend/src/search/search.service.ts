import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SearchResult {
  id: string; description: string; categoryId: string | null; categoryName: string | null;
  quantity: number; unitCost: number; totalCost: number; unitSelling: number; totalSelling: number;
  marginPct: number; vendorId: string | null; vendorName: string | null; vendorRaw: string | null;
  projectId: string; jobNumber: string; clientName: string; projectSubject: string;
  projectDate: Date | null; projectYear: number; relevanceScore?: number;
}

export interface PriceBenchmark {
  categoryName: string; avgUnitCost: number; minUnitCost: number; maxUnitCost: number;
  medianUnitCost: number; itemCount: number; avgMarginPct: number; priceRange: string;
  topVendors: { name: string; avgCost: number; itemCount: number }[];
}

export interface VendorRecommendation {
  vendorId: string; vendorName: string; avgUnitCost: number; itemCount: number;
  reliabilityScore: number; categories: string[]; score: number;
}

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async searchSimple(query: string, limit = 50): Promise<any[]> {
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
    const items = await this.prisma.lineItem.findMany({
      where: {
        AND: keywords.map(keyword => ({
          description: { contains: keyword, mode: 'insensitive' as any },
        })),
      },
      include: {
        category: true,
        vendor: true,
        project: { include: { client: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return items.map(item => ({
      id: item.id, description: item.description,
      categoryId: item.categoryId, categoryName: item.category?.name || null,
      quantity: item.quantity, unitCost: item.unitCost, totalCost: item.totalCost,
      unitSelling: item.unitSelling, totalSelling: item.totalSelling, marginPct: item.marginPct,
      vendorId: item.vendorId, vendorName: item.vendor?.name || null, vendorRaw: item.vendorRaw,
      projectId: item.projectId, jobNumber: item.project.jobNumber,
      clientName: item.project.client.name, projectSubject: item.project.subject,
      projectDate: item.project.date, projectYear: item.project.year,
    }));
  }

  async getBenchmark(itemDescription: string, categoryId?: string): Promise<PriceBenchmark | null> {
    const similarItems = await this.searchSimple(itemDescription, 100);
    if (similarItems.length === 0) return null;

    const items = categoryId ? similarItems.filter(i => i.categoryId === categoryId) : similarItems;
    if (items.length === 0) return null;

    const costs = items.map(i => i.unitCost).filter(c => c > 0).sort((a, b) => a - b);
    if (costs.length === 0) return null;

    const avg = costs.reduce((a, b) => a + b, 0) / costs.length;
    const median = costs[Math.floor(costs.length / 2)];
    const min = costs[0];
    const max = costs[costs.length - 1];

    const vendorMap = new Map<string, { name: string; costs: number[]; count: number }>();
    for (const item of items) {
      if (item.vendorName && item.unitCost > 0) {
        const existing = vendorMap.get(item.vendorName) || { name: item.vendorName, costs: [] as number[], count: 0 };
        existing.costs.push(item.unitCost);
        existing.count++;
        vendorMap.set(item.vendorName, existing);
      }
    }

    const topVendors = Array.from(vendorMap.values())
      .map(v => ({ name: v.name, avgCost: v.costs.reduce((a, b) => a + b, 0) / v.costs.length, itemCount: v.count }))
      .sort((a, b) => b.itemCount - a.itemCount).slice(0, 5);

    const margins = items.map(i => i.marginPct).filter(m => m > 0);
    const avgMargin = margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;

    return {
      categoryName: items[0]?.categoryName || 'Uncategorized',
      avgUnitCost: Math.round(avg * 1000) / 1000,
      minUnitCost: Math.round(min * 1000) / 1000,
      maxUnitCost: Math.round(max * 1000) / 1000,
      medianUnitCost: Math.round(median * 1000) / 1000,
      itemCount: costs.length, avgMarginPct: Math.round(avgMargin * 100) / 100,
      priceRange: `OMR ${min.toFixed(2)} - ${max.toFixed(2)}`, topVendors,
    };
  }

  async recommendVendors(categoryId?: string, itemDescription?: string): Promise<VendorRecommendation[]> {
    const items = itemDescription ? await this.searchSimple(itemDescription, 200) : [];
    const relevantItems = categoryId ? items.filter(i => i.categoryId === categoryId) : items;
    if (relevantItems.length === 0 && !categoryId) return [];

    const vendorData = new Map<string, { vendorId: string; vendorName: string; costs: number[]; reliabilityScore: number; categories: Set<string> }>();

    for (const item of relevantItems) {
      if (!item.vendorId || !item.vendorName) continue;
      const existing = vendorData.get(item.vendorId) || {
        vendorId: item.vendorId, vendorName: item.vendorName,
        costs: [] as number[], reliabilityScore: 3.0, categories: new Set<string>(),
      };
      existing.costs.push(item.unitCost);
      if (item.categoryName) existing.categories.add(item.categoryName);
      vendorData.set(item.vendorId, existing);
    }

    return Array.from(vendorData.values())
      .filter(v => v.costs.length > 0)
      .map(v => {
        const avgCost = v.costs.reduce((a, b) => a + b, 0) / v.costs.length;
        const costScore = 1 / (avgCost + 1) * 100;
        const volumeScore = Math.min(v.costs.length / 10, 1) * 30;
        const reliabilityScoreWeighted = (v.reliabilityScore / 5) * 50;
        const score = costScore + volumeScore + reliabilityScoreWeighted;
        return {
          vendorId: v.vendorId, vendorName: v.vendorName,
          avgUnitCost: Math.round(avgCost * 1000) / 1000, itemCount: v.costs.length,
          reliabilityScore: v.reliabilityScore, categories: Array.from(v.categories),
          score: Math.round(score * 100) / 100,
        };
      })
      .sort((a, b) => b.score - a.score).slice(0, 10);
  }

  async getDashboardStats() {
    const [totalProjects, totalItems, totalClients, totalVendors, recentAlerts, yearlyStats] = await Promise.all([
      this.prisma.project.count(),
      this.prisma.lineItem.count(),
      this.prisma.client.count(),
      this.prisma.vendor.count(),
      this.prisma.priceAlert.findMany({
        where: { resolved: false }, orderBy: { createdAt: 'desc' }, take: 10,
        include: { lineItem: { include: { project: { include: { client: true } } } } },
      }),
      this.prisma.project.groupBy({
        by: ['year'], _sum: { totalCost: true, totalSell: true }, _count: true, orderBy: { year: 'asc' },
      }),
    ]);

    const totalRevenue = yearlyStats.reduce((sum, y) => sum + (y._sum.totalSell || 0), 0);
    const totalCost = yearlyStats.reduce((sum, y) => sum + (y._sum.totalCost || 0), 0);
    const overallMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;

    return {
      totalProjects, totalItems, totalClients, totalVendors,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      overallMargin: Math.round(overallMargin * 100) / 100,
      recentAlerts: recentAlerts.map(a => ({
        id: a.id, type: a.alertType, message: a.message, deviation: a.deviationPct,
        projectName: a.lineItem.project.subject, clientName: a.lineItem.project.client.name, createdAt: a.createdAt,
      })),
      yearlyStats: yearlyStats.map(y => ({
        year: y.year, projects: y._count,
        totalCost: Math.round((y._sum.totalCost || 0) * 100) / 100,
        totalRevenue: Math.round((y._sum.totalSell || 0) * 100) / 100,
        margin: y._sum.totalSell ? Math.round(((y._sum.totalSell - (y._sum.totalCost || 0)) / y._sum.totalSell) * 10000) / 100 : 0,
      })),
    };
  }
}
