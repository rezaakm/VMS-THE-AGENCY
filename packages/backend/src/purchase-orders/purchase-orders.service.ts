import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { POStatus } from '@prisma/client';

@Injectable()
export class PurchaseOrdersService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreatePurchaseOrderDto, userId: string) {
    const orderNumber = await this.generateOrderNumber();

    // Calculate totals from items
    const subtotal = createDto.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice * (1 - item.discount / 100),
      0,
    );

    const taxAmount = createDto.items.reduce(
      (sum, item) =>
        sum + (item.quantity * item.unitPrice * (1 - item.discount / 100) * item.taxRate) / 100,
      0,
    );

    const totalAmount = subtotal + taxAmount + (createDto.shippingCost || 0);

    const { items, ...orderData } = createDto;

    return this.prisma.purchaseOrder.create({
      data: {
        ...orderData,
        orderNumber,
        userId,
        subtotal,
        taxAmount,
        totalAmount,
        items: {
          create: items.map((item) => ({
            ...item,
            totalPrice: item.quantity * item.unitPrice * (1 - item.discount / 100),
          })),
        },
      },
      include: {
        items: true,
        vendor: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async findAll(filters?: any) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.vendorId) {
      where.vendorId = filters.vendorId;
    }

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    return this.prisma.purchaseOrder.findMany({
      where,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        vendor: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        items: true,
        invoices: true,
      },
    });

    if (!po) {
      throw new NotFoundException(`Purchase order with ID ${id} not found`);
    }

    return po;
  }

  async update(id: string, updateDto: UpdatePurchaseOrderDto) {
    await this.findOne(id);

    const { items, ...orderData } = updateDto;

    // Recalculate if items are updated
    if (items) {
      const subtotal = items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice * (1 - item.discount / 100),
        0,
      );

      const taxAmount = items.reduce(
        (sum, item) =>
          sum + (item.quantity * item.unitPrice * (1 - item.discount / 100) * item.taxRate) / 100,
        0,
      );

      const totalAmount = subtotal + taxAmount + (orderData.shippingCost || 0);

      return this.prisma.purchaseOrder.update({
        where: { id },
        data: {
          ...orderData,
          subtotal,
          taxAmount,
          totalAmount,
          items: {
            deleteMany: {},
            create: items.map((item) => ({
              ...item,
              totalPrice: item.quantity * item.unitPrice * (1 - item.discount / 100),
            })),
          },
        },
        include: {
          items: true,
          vendor: true,
        },
      });
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: orderData,
      include: {
        items: true,
        vendor: true,
      },
    });
  }

  async updateStatus(id: string, status: POStatus) {
    await this.findOne(id);

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.purchaseOrder.delete({ where: { id } });
    return { message: 'Purchase order deleted successfully' };
  }

  async getStats() {
    const total = await this.prisma.purchaseOrder.count();
    const draft = await this.prisma.purchaseOrder.count({
      where: { status: 'DRAFT' },
    });
    const approved = await this.prisma.purchaseOrder.count({
      where: { status: 'APPROVED' },
    });
    const completed = await this.prisma.purchaseOrder.count({
      where: { status: 'COMPLETED' },
    });

    const totalValue = await this.prisma.purchaseOrder.aggregate({
      _sum: { totalAmount: true },
    });

    return {
      total,
      draft,
      approved,
      completed,
      totalValue: totalValue._sum.totalAmount || 0,
    };
  }

  private async generateOrderNumber(): Promise<string> {
    const count = await this.prisma.purchaseOrder.count();
    const year = new Date().getFullYear();
    const paddedCount = String(count + 1).padStart(6, '0');
    return `PO${year}${paddedCount}`;
  }
}

