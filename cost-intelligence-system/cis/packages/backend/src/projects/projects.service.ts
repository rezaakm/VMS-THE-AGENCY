import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll(options?: { year?: number; clientId?: string; status?: string; page?: number; limit?: number }) {
    const where: any = {};
    if (options?.year) where.year = options.year;
    if (options?.clientId) where.clientId = options.clientId;
    if (options?.status) where.status = options.status;
    const page = options?.page || 1;
    const limit = options?.limit || 25;
    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where, include: { client: true, _count: { select: { lineItems: true } } },
        orderBy: { date: 'desc' }, skip: (page - 1) * limit, take: limit,
      }),
      this.prisma.project.count({ where }),
    ]);
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    return this.prisma.project.findUnique({
      where: { id },
      include: {
        client: true,
        lineItems: {
          include: { category: true, vendor: true, alerts: true },
          orderBy: { itemNumber: 'asc' },
        },
      },
    });
  }

  async getYears() {
    const years = await this.prisma.project.groupBy({
      by: ['year'], _count: true, orderBy: { year: 'desc' },
    });
    return years.map(y => ({ year: y.year, count: y._count }));
  }
}
