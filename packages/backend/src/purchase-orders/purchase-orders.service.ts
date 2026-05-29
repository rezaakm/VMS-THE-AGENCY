import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { calculatePOTotals } from '../common/utils/po-totals.util';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { POStatus } from '@prisma/client';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  async create(createDto: CreatePurchaseOrderDto, userId: string) {
    const orderNumber = await this.generateOrderNumber();

    const { subtotal, taxAmount, totalAmount } = calculatePOTotals(
      createDto.items,
      createDto.shippingCost || 0,
    );

    const { items, ...orderData } = createDto;

    const po = await this.prisma.purchaseOrder.create({
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
            discount: item.discount || 0,
            taxRate: item.taxRate || 0,
            totalPrice: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
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
    await this.auditLog.log(userId, 'CREATE', 'PURCHASE_ORDER', po.id, {
      orderNumber: po.orderNumber,
      totalAmount: po.totalAmount,
    });
    return po;
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

  async update(
    id: string,
    updateDto: UpdatePurchaseOrderDto,
    userId?: string,
  ) {
    await this.findOne(id);

    const { items, ...orderData } = updateDto;

    // Recalculate if items are updated
    if (items) {
      const { subtotal, taxAmount, totalAmount } = calculatePOTotals(
        items,
        orderData.shippingCost || 0,
      );

      const updated = await this.prisma.purchaseOrder.update({
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
              discount: item.discount || 0,
              taxRate: item.taxRate || 0,
              totalPrice: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
            })),
          },
        },
        include: {
          items: true,
          vendor: true,
        },
      });
      if (userId) {
        await this.auditLog.log(userId, 'UPDATE', 'PURCHASE_ORDER', id, {
          orderNumber: updated.orderNumber,
          totalAmount: updated.totalAmount,
        });
      }
      return updated;
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: orderData,
      include: {
        items: true,
        vendor: true,
      },
    });
    if (userId) {
      await this.auditLog.log(userId, 'UPDATE', 'PURCHASE_ORDER', id, {
        orderNumber: updated.orderNumber,
      });
    }
    return updated;
  }

  async updateStatus(
    id: string,
    status: POStatus,
    userId?: string,
    userRole?: UserRole,
  ) {
    await this.findOne(id);

    const approvalStatuses: POStatus[] = ['APPROVED', 'COMPLETED'];
    if (
      approvalStatuses.includes(status) &&
      userRole &&
      userRole !== UserRole.ADMIN &&
      userRole !== UserRole.MANAGER
    ) {
      throw new ForbiddenException(
        'Only managers or admins can approve or complete purchase orders',
      );
    }

    const po = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status },
    });
    if (userId) {
      await this.auditLog.log(userId, 'STATUS_CHANGE', 'PURCHASE_ORDER', id, {
        status,
      });
    }
    return po;
  }

  async remove(id: string, userId?: string) {
    await this.findOne(id);
    await this.prisma.purchaseOrder.delete({ where: { id } });
    if (userId) {
      await this.auditLog.log(userId, 'DELETE', 'PURCHASE_ORDER', id);
    }
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

