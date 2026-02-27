import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { VendorStatus } from '@prisma/client';

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

  async create(createVendorDto: CreateVendorDto) {
    // Generate unique vendor code
    const code = await this.generateVendorCode();

    return this.prisma.vendor.create({
      data: {
        ...createVendorDto,
        code,
      },
      include: {
        contacts: true,
        documents: true,
      },
    });
  }

  async findAll(filters?: any) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.vendor.findMany({
      where,
      include: {
        contacts: true,
        _count: {
          select: {
            purchaseOrders: true,
            contracts: true,
            evaluations: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: {
        contacts: true,
        documents: true,
        purchaseOrders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        contracts: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        evaluations: {
          take: 5,
          orderBy: { evaluationDate: 'desc' },
        },
      },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${id} not found`);
    }

    return vendor;
  }

  async update(id: string, updateVendorDto: UpdateVendorDto) {
    await this.findOne(id);

    return this.prisma.vendor.update({
      where: { id },
      data: updateVendorDto,
      include: {
        contacts: true,
        documents: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.vendor.delete({ where: { id } });
    return { message: 'Vendor deleted successfully' };
  }

  async updateStatus(id: string, status: VendorStatus) {
    await this.findOne(id);

    return this.prisma.vendor.update({
      where: { id },
      data: { status },
    });
  }

  async getStats() {
    const total = await this.prisma.vendor.count();
    const active = await this.prisma.vendor.count({
      where: { status: 'ACTIVE' },
    });
    const pending = await this.prisma.vendor.count({
      where: { status: 'PENDING' },
    });
    const blacklisted = await this.prisma.vendor.count({
      where: { status: 'BLACKLISTED' },
    });

    return {
      total,
      active,
      pending,
      blacklisted,
    };
  }

  async getTopVendors(limit: number = 10) {
    return this.prisma.vendor.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [
        { performanceScore: 'desc' },
        { totalSpent: 'desc' },
      ],
      take: limit,
      select: {
        id: true,
        name: true,
        code: true,
        performanceScore: true,
        totalOrders: true,
        totalSpent: true,
      },
    });
  }

  private async generateVendorCode(): Promise<string> {
    const count = await this.prisma.vendor.count();
    const paddedCount = String(count + 1).padStart(6, '0');
    return `VEN${paddedCount}`;
  }
}

