import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;
  let prisma: any;

  const mockPo = {
    id: 'po-1',
    orderNumber: 'PO2026000001',
    vendorId: 'v1',
    status: 'DRAFT',
    subtotal: 1000,
    taxAmount: 50,
    totalAmount: 1050,
    items: [{ id: 'pi-1', description: 'Item', quantity: 10, unitPrice: 100, totalPrice: 1000 }],
    vendor: { id: 'v1', name: 'Vendor A', code: 'VEN001' },
    user: { id: 'u1', firstName: 'Admin', lastName: 'User' },
  };

  beforeEach(async () => {
    prisma = {
      purchaseOrder: {
        create: jest.fn().mockResolvedValue(mockPo),
        findMany: jest.fn().mockResolvedValue([mockPo]),
        findUnique: jest.fn().mockResolvedValue(mockPo),
        update: jest.fn().mockResolvedValue(mockPo),
        delete: jest.fn().mockResolvedValue(mockPo),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: 50000 } }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PurchaseOrdersService>(PurchaseOrdersService);
  });

  describe('create', () => {
    it('should calculate totals and create PO', async () => {
      const dto = {
        vendorId: 'v1',
        items: [
          { description: 'Steel', quantity: 10, unitPrice: 100, discount: 0, taxRate: 5 },
          { description: 'Cement', quantity: 20, unitPrice: 50, discount: 10, taxRate: 5 },
        ],
        shippingCost: 25,
      };

      await service.create(dto as any, 'u1');

      expect(prisma.purchaseOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderNumber: 'PO2026000001',
            userId: 'u1',
            subtotal: expect.any(Number),
            taxAmount: expect.any(Number),
            totalAmount: expect.any(Number),
          }),
        }),
      );

      // Verify calculation: item1 = 10*100*(1-0) = 1000, item2 = 20*50*(1-0.1) = 900
      // subtotal = 1900, tax = 1000*0.05 + 900*0.05 = 50+45 = 95, total = 1900+95+25 = 2020
      const createCall = prisma.purchaseOrder.create.mock.calls[0][0];
      expect(createCall.data.subtotal).toBe(1900);
      expect(createCall.data.taxAmount).toBe(95);
      expect(createCall.data.totalAmount).toBe(2020);
    });
  });

  describe('findAll', () => {
    it('should return POs with filters', async () => {
      await service.findAll({ status: 'APPROVED' });
      expect(prisma.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'APPROVED' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return PO by id', async () => {
      const result = await service.findOne('po-1');
      expect(result.orderNumber).toBe('PO2026000001');
    });

    it('should throw NotFoundException', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update PO status', async () => {
      await service.updateStatus('po-1', 'APPROVED' as any);
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'APPROVED' } }),
      );
    });
  });

  describe('remove', () => {
    it('should delete PO', async () => {
      const result = await service.remove('po-1');
      expect(result.message).toBe('Purchase order deleted successfully');
    });
  });

  describe('getStats', () => {
    it('should return PO statistics', async () => {
      prisma.purchaseOrder.count
        .mockResolvedValueOnce(20)  // total
        .mockResolvedValueOnce(5)   // draft
        .mockResolvedValueOnce(10)  // approved
        .mockResolvedValueOnce(5);  // completed

      const result = await service.getStats();
      expect(result).toEqual({
        total: 20,
        draft: 5,
        approved: 10,
        completed: 5,
        totalValue: 50000,
      });
    });
  });
});
