import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(options?: { page?: number; search?: string }) {
    const where: any = {};
    if (options?.search) where.name = { contains: options.search, mode: 'insensitive' };
    const page = options?.page || 1;
    const limit = 50;

    const [items, total] = await Promise.all([
      this.prisma.client.findMany({
        where, include: { _count: { select: { projects: true } } },
        orderBy: { name: 'asc' }, skip: (page - 1) * limit, take: limit,
      }),
      this.prisma.client.count({ where }),
    ]);
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    return this.prisma.client.findUnique({
      where: { id }, include: { projects: { include: { _count: { select: { lineItems: true } } }, orderBy: { createdAt: 'desc' } } },
    });
  }
}
