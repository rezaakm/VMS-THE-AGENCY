import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SearchResult {
  id: string;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  quantity: number;
  unitCost: number;
  totalCost: number;
  unitSelling: number;
  totalSelling: number;
  marginPct: number;
  vendorId: string | null;
  vendorName: string | null;
  vendorRaw: string | null;
  projectId: string;
  jobNumber: string;
  clientName: string;
  projectSubject: string;
  projectDate: Date | null;
  projectYear: number;
  relevanceScore: number;
}

export interface PriceBenchmark {
  categoryName: string;
  avgUnitCost: number;
  minUnitCost: number;
  maxUnitCost: number;
  medianUnitCost: number;
  itemCount: number;
  avgMarginPct: number;
  priceRange: string;
  topVendors: { name: string; avgCost: number; itemCount: number }[];
}

export interface VendorRecommendation {
  vendorId: string;
  vendorName: string;
  avgUnitCost: number;
  itemCount: number;
  reliabilityScore: number;
  categories: string[];
  score: number; // composite recommendation score
}

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  /**
   * Full-text + fuzzy search across all line items
   */
  async search(query: string, options?: {
    limit?: number;
    categoryId?: string;
    vendorId?: string;
    yearFrom?: number;
    yearTo?: number;
    minCost?: number;
    maxCost?: number;
  }): Promise<SearchResult[]> {
    const limit = options?.limit || 50;

    // Use raw SQL for combined FTS + trigram search
    const results = await this.prisma.$queryRaw<any[]>`
      SELECT
        li.id,
        li.description,
        li.category_id as "categoryId",
        c.name as "categoryName",
        li.quantity,
        li.unit_cost as "unitCost",
        li.total_cost as "totalCost",
        li.unit_selling as "unitSelling",
        li.total_selling as "totalSelling",
        li.margin_pct as "marginPct",
        li.vendor_id as "vendorId",
        v.name as "vendorName",
        li.vendor_raw as "vendorRaw",
        li.project_id as "projectId",
        p.job_number as "jobNumber",
        cl.name as "clientName",
        p.subject as "projectSubject",
        p.date as "projectDate",
        p.year as "projectYear",
        (
          COALESCE(ts_rank(li.description_tsv, plainto_tsquery('english', ${query})), 0) * 2 +
          COALESCE(similarity(li.description, ${query}), 0)
        ) as "relevanceScore"
      FROM line_items li
      LEFT JOIN categories c ON li.category_id = c.id
      LEFT JOIN vendors v ON li.vendor_id = v.id
      JOIN projects p ON li.project_id = p.id
      JOIN clients cl ON p.client_id = cl.id
      WHERE (
        li.description_tsv @@ plainto_tsquery('english', ${query})
        OR similarity(li.description, ${query}) > 0.15
      )
      ${options?.categoryId ? this.prisma.$queryRaw`AND li.category_id = ${options.categoryId}::uuid` : this.prisma.$queryRaw``}
      ${options?.yearFrom ? this.prisma.$queryRaw`AND p.year >= ${options.yearFrom}` : this.prisma.$queryRaw``}
      ${options?.yearTo ? this.prisma.$queryRaw`AND p.year <= ${options.yearTo}` : this.prisma.$queryRaw``}
      ORDER BY "relevanceScore" DESC
      LIMIT ${limit}
    `;

    return results;
  }

  /**
   * Simple search using Prisma (fallback if raw SQL has issues)
   */
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
        project: {
          include: { client: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return items.map(item => ({
      id: item.id,
      description: item.description,
      categoryId: item.categoryId,
      categoryName: item.category?.name || null,
      quantity: item.quantity,
      unitCost: item.unitCost,
      totalCost: item.totalCost,
      unitSelling: item.unitSelling,
      totalSelling: item.totalSelling,
      marginPct: item.marginPct,
      vendorId: item.vendorId,
      vendorName: item.vendor?.name || null,
      vendorRaw: item.vendorRaw,
      projectId: item.projectId,
      jobNumber: item.project.jobNumber,
      clientName: item.project.client.name,
      projectSubject: item.project.subject,
      projectDate: item.project.date,
      projectYear: item.project.year,
    }));
  }

  /**
   * Get price benchmarks for a specific item or category
   */
  async getBenchmark(itemDescription: string, categoryId?: string): Promise<PriceBenchmark | null> {
    // Find similar items
    const similarItems = await this.searchSimple(itemDescription, 100);
    if (similarItems.length === 0) return null;

    // If categoryId provided, filter to that category
    const items = categoryId
      ? similarItems.filter(i => i.categoryId === categoryId)
      : similarItems;

    if (items.length === 0) return null;

    const costs = items.map(i => i.unitCost).filter(c => c > 0).sort((a, b) => a - b);
    if (costs.length === 0) return null;

    const avg = costs.reduce((a, b) => a + b, 0) / costs.length;
    const median = costs[Math.floor(costs.length / 2)];
    const min = costs[0];
    const max = costs[costs.length - 1];

    // Get top vendors for this type of item
    const vendorMap = new Map<string, { name: string; costs: number[]; count: number }>();
    for (const item of items) {
      if (item.vendorName && item.unitCost > 0) {
        const existing = vendorMap.get(item.vendorName) || { name: item.vendorName, costs: [], count: 0 };
        existing.costs.push(item.unitCost);
        existing.count++;
        vendorMap.set(item.vendorName, existing);
      }
    }

    const topVendors = Array.from(vendorMap.values())
      .map(v => ({
        name: v.name,
        avgCost: v.costs.reduce((a, b) => a + b, 0) / v.costs.length,
        itemCount: v.count,
      }))
      .sort((a, b) => b.itemCount - a.itemCount)
      .slice(0, 5);

    const margins = items.map(i => i.marginPct).filter(m => m > 0);
    const avgMargin = margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;

    return {
      categoryName: items[0]?.categoryName || 'Uncategorized',
      avgUnitCost: Math.round(avg * 1000) / 1000,
      minUnitCost: Math.round(min * 1000) / 1000,
      maxUnitCost: Math.round(max * 1000) / 1000,
      medianUnitCost: Math.round(median * 1000) / 1000,
      itemCount: costs.length,
      avgMarginPct: Math.round(avgMargin * 100) / 100,
      priceRange: `OMR ${min.toFixed(2)} - ${max.toFixed(2)}`,
      topVendors,
    };
  }

  /**
   * Get vendor recommendations for a category or item type
   */
  async recommendVendors(categoryId?: string, itemDescription?: string): Promise<VendorRecommendation[]> {
    let items: any[];

    if (itemDescription) {
      items = await this.searchSimple(itemDescription, 200);
    } else if (categoryId) {
      items = await this.prisma.lineItem.findMany({
        where: { categoryId },
        include: { vendor: true },
      });
    } else {
      return [];
    }

    // Aggregate by vendor
    const vendorMap = new Map<string, {
      vendorId: string;
      vendorName: string;
      costs: number[];
      reliabilityScore: number;
      categories: Set<string>;
    }>();

    for (const item of items) {
      if (!item.vendorId || !item.vendorName) continue;
      const existing = vendorMap.get(item.vendorId) || {
        vendorId: item.vendorId,
        vendorName: item.vendorName,
        costs: [],
        reliabilityScore: item.vendor?.reliabilityScore || 3.0,
        categories: new Set<string>(),
      };
      if (item.unitCost > 0) existing.costs.push(item.unitCost);
      if (item.categoryName) existing.categories.add(item.categoryName);
      vendorMap.set(item.vendorId, existing);
    }

    return Array.from(vendorMap.values())
      .filter(v => v.costs.length > 0)
      .map(v => {
        const avgCost = v.costs.reduce((a, b) => a + b, 0) / v.costs.length;
        // Score: higher is better. Factors: lower avg cost, more items (experience), higher reliability
        const costScore = 1 / (avgCost + 1) * 100;
        const volumeScore = Math.min(v.costs.length / 10, 1) * 30;
        const reliabilityScoreWeighted = (v.reliabilityScore / 5) * 50;
        const score = costScore + volumeScore + reliabilityScoreWeighted;

        return {
          vendorId: v.vendorId,
          vendorName: v.vendorName,
          avgUnitCost: Math.round(avgCost * 1000) / 1000,
          itemCount: v.costs.length,
          reliabilityScore: v.reliabilityScore,
          categories: Array.from(v.categories),
          score: Math.round(score * 100) / 100,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  /**
   * Dashboard stats
   */
  async getDashboardStats() {
    const [
      totalProjects,
      totalItems,
      totalClients,
      totalVendors,
      recentAlerts,
      yearlyStats,
    ] = await Promise.all([
      this.prisma.project.count(),
      this.prisma.lineItem.count(),
      this.prisma.client.count(),
      this.prisma.vendor.count(),
      this.prisma.priceAlert.findMany({
        where: { resolved: false },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { lineItem: { include: { project: { include: { client: true } } } } },
      }),
      this.prisma.project.groupBy({
        by: ['year'],
        _sum: { totalCost: true, totalSell: true },
        _count: true,
        orderBy: { year: 'asc' },
      }),
    ]);

    const totalRevenue = yearlyStats.reduce((sum, y) => sum + (y._sum.totalSell || 0), 0);
    const totalCost = yearlyStats.reduce((sum, y) => sum + (y._sum.totalCost || 0), 0);
    const overallMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;

    return {
      totalProjects,
      totalItems,
      totalClients,
      totalVendors,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      overallMargin: Math.round(overallMargin * 100) / 100,
      recentAlerts: recentAlerts.map(a => ({
        id: a.id,
        type: a.alertType,
        message: a.message,
        deviation: a.deviationPct,
        projectName: a.lineItem.project.subject,
        clientName: a.lineItem.project.client.name,
        createdAt: a.createdAt,
      })),
      yearlyStats: yearlyStats.map(y => ({
        year: y.year,
        projects: y._count,
        totalCost: Math.round((y._sum.totalCost || 0) * 100) / 100,
        totalRevenue: Math.round((y._sum.totalSell || 0) * 100) / 100,
        margin: y._sum.totalSell
          ? Math.round(((y._sum.totalSell - (y._sum.totalCost || 0)) / y._sum.totalSell) * 10000) / 100
          : 0,
      })),
    };
  }
}
