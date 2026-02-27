import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(options?: { page?: number; search?: string }) {
    const where: any = {};
    if (options?.search) where.name = { contains: options.search, mode: 'insensitive' };
    const page = options?.page || 1;
    const [items, total] = await Promise.all([
      this.prisma.client.findMany({
        where, include: { _count: { select: { projects: true } } },
        orderBy: { name: 'asc' }, skip: (page - 1) * 50, take: 50,
      }),
      this.prisma.client.count({ where }),
    ]);
    return { items, total, page };
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: { projects: { include: { _count: { select: { lineItems: true } } }, orderBy: { date: 'desc' } } },
    });
    if (!client) return null;

    const financials = await this.prisma.project.aggregate({
      where: { clientId: id },
      _sum: { totalCost: true, totalSell: true },
      _avg: { marginPct: true },
      _count: true,
    });

    return { ...client, financials };
  }
}
