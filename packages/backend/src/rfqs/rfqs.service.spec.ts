import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RfqsService } from './rfqs.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RfqsService', () => {
  let service: RfqsService;
  let prisma: any;

  const mockRfqItems = [
    { id: 'item-1', itemNumber: 1, description: 'Steel Beams', quantity: 100, unit: 'piece', rfqId: 'rfq-1' },
    { id: 'item-2', itemNumber: 2, description: 'Concrete Mix', quantity: 50, unit: 'bag', rfqId: 'rfq-1' },
  ];

  const mockBids = [
    {
      id: 'bid-1',
      rfqId: 'rfq-1',
      vendorId: 'v1',
      token: 'token-abc',
      status: 'SUBMITTED',
      totalAmount: 41000,
      submittedAt: new Date(),
      validityDays: 30,
      notes: null,
      vendor: { id: 'v1', name: 'Vendor A', code: 'VEN001', email: 'a@v.com', phone: '+968 1111' },
      items: [
        { id: 'bi-1', bidId: 'bid-1', rfqItemId: 'item-1', unitPrice: 200, totalPrice: 20000, notes: null, rfqItem: mockRfqItems[0] },
        { id: 'bi-2', bidId: 'bid-1', rfqItemId: 'item-2', unitPrice: 420, totalPrice: 21000, notes: null, rfqItem: mockRfqItems[1] },
      ],
    },
    {
      id: 'bid-2',
      rfqId: 'rfq-1',
      vendorId: 'v2',
      token: 'token-def',
      status: 'SUBMITTED',
      totalAmount: 39800,
      submittedAt: new Date(),
      validityDays: 30,
      notes: null,
      vendor: { id: 'v2', name: 'Vendor B', code: 'VEN002', email: 'b@v.com', phone: '+968 2222' },
      items: [
        { id: 'bi-3', bidId: 'bid-2', rfqItemId: 'item-1', unitPrice: 196, totalPrice: 19600, notes: null, rfqItem: mockRfqItems[0] },
        { id: 'bi-4', bidId: 'bid-2', rfqItemId: 'item-2', unitPrice: 404, totalPrice: 20200, notes: null, rfqItem: mockRfqItems[1] },
      ],
    },
  ];

  const mockRfq = {
    id: 'rfq-1',
    rfqNumber: 'RFQ-2026-001',
    title: 'Construction Materials',
    category: 'Building',
    status: 'SENT',
    deadline: new Date('2026-12-31'),
    items: mockRfqItems,
    vendorBids: mockBids,
    createdBy: { id: 'u1', firstName: 'Admin', lastName: 'User', email: 'admin@vms.com' },
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      rFQ: {
        create: jest.fn().mockResolvedValue({ id: 'rfq-1' }),
        findMany: jest.fn().mockResolvedValue([mockRfq]),
        findUnique: jest.fn().mockResolvedValue(mockRfq),
        update: jest.fn().mockResolvedValue(mockRfq),
        delete: jest.fn().mockResolvedValue(mockRfq),
        count: jest.fn().mockResolvedValue(0),
      },
      rFQItem: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      rFQVendorBid: {
        createMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      rFQBidItem: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RfqsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<RfqsService>(RfqsService);
  });

  describe('findOne', () => {
    it('should return RFQ with items and bids', async () => {
      const result = await service.findOne('rfq-1');
      expect(result.rfqNumber).toBe('RFQ-2026-001');
      expect(result.items).toHaveLength(2);
      expect(result.vendorBids).toHaveLength(2);
    });

    it('should throw NotFoundException for non-existent RFQ', async () => {
      prisma.rFQ.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return list of RFQs', async () => {
      const result = await service.findAll();
      expect(prisma.rFQ.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should apply status filter', async () => {
      await service.findAll({ status: 'DRAFT' as any });
      expect(prisma.rFQ.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'DRAFT' }),
        }),
      );
    });

    it('should apply search filter', async () => {
      await service.findAll({ search: 'steel' });
      expect(prisma.rFQ.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
    });
  });

  describe('remove', () => {
    it('should delete draft RFQ', async () => {
      prisma.rFQ.findUnique.mockResolvedValue({ ...mockRfq, status: 'DRAFT' });
      const result = await service.remove('rfq-1');
      expect(prisma.rFQ.delete).toHaveBeenCalledWith({ where: { id: 'rfq-1' } });
      expect(result.message).toBe('RFQ deleted');
    });

    it('should reject deletion of non-draft RFQ', async () => {
      prisma.rFQ.findUnique.mockResolvedValue({ ...mockRfq, status: 'SENT' });
      await expect(service.remove('rfq-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should reject update of non-draft RFQ', async () => {
      prisma.rFQ.findUnique.mockResolvedValue({ ...mockRfq, status: 'SENT' });
      await expect(service.update('rfq-1', { title: 'New' })).rejects.toThrow(BadRequestException);
    });

    it('should update draft RFQ', async () => {
      prisma.rFQ.findUnique.mockResolvedValue({ ...mockRfq, status: 'DRAFT' });
      await service.update('rfq-1', { title: 'Updated Title' });
      expect(prisma.rFQ.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rfq-1' },
          data: { title: 'Updated Title' },
        }),
      );
    });
  });

  describe('compareBids', () => {
    it('should return comparison grid with lowest prices', async () => {
      const result = await service.compareBids('rfq-1');

      expect(result.rfq.rfqNumber).toBe('RFQ-2026-001');
      expect(result.comparison).toHaveLength(2);
      expect(result.vendorTotals).toHaveLength(2);

      // Item 1: Vendor B (196) is cheaper than Vendor A (200)
      expect(result.comparison[0].lowestUnitPrice).toBe(196);
      // Item 2: Vendor B (404) is cheaper than Vendor A (420)
      expect(result.comparison[1].lowestUnitPrice).toBe(404);
    });

    it('should include vendor totals with submission info', async () => {
      const result = await service.compareBids('rfq-1');
      expect(result.vendorTotals[0].totalAmount).toBe(41000);
      expect(result.vendorTotals[1].totalAmount).toBe(39800);
    });
  });

  describe('awardBid', () => {
    it('should award bid and reject others via transaction', async () => {
      await service.awardBid('rfq-1', 'bid-2');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // Transaction receives an array of Prisma promises
      const transactionArg = prisma.$transaction.mock.calls[0][0];
      expect(Array.isArray(transactionArg)).toBe(true);
      expect(transactionArg).toHaveLength(3);
    });

    it('should throw NotFoundException for non-existent bid', async () => {
      await expect(service.awardBid('rfq-1', 'bad-bid')).rejects.toThrow(NotFoundException);
    });

    it('should reject awarding non-submitted bid', async () => {
      const rfqWithPendingBid = {
        ...mockRfq,
        vendorBids: [{ ...mockBids[0], status: 'PENDING' }],
      };
      prisma.rFQ.findUnique.mockResolvedValue(rfqWithPendingBid);

      await expect(service.awardBid('rfq-1', 'bid-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getBidByToken', () => {
    it('should return bid with RFQ details', async () => {
      const mockBid = { id: 'bid-1', rfq: mockRfq, vendor: { id: 'v1', name: 'A' }, items: [] };
      prisma.rFQVendorBid.findUnique.mockResolvedValue(mockBid);

      const result = await service.getBidByToken('token-abc');
      expect(result).toEqual(mockBid);
    });

    it('should throw NotFoundException for invalid token', async () => {
      prisma.rFQVendorBid.findUnique.mockResolvedValue(null);
      await expect(service.getBidByToken('bad-token')).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitBid', () => {
    const bidInDb = {
      id: 'bid-1',
      status: 'PENDING',
      rfq: { ...mockRfq, deadline: new Date('2027-12-31'), items: mockRfqItems },
    };

    it('should submit bid and calculate totals', async () => {
      prisma.rFQVendorBid.findUnique.mockResolvedValue(bidInDb);

      const dto = {
        items: [
          { rfqItemId: 'item-1', unitPrice: 200 },
          { rfqItemId: 'item-2', unitPrice: 420 },
        ],
        notes: 'Valid 30 days',
        validityDays: 30,
      };

      const result = await service.submitBid('token-abc', dto);

      expect(prisma.rFQBidItem.deleteMany).toHaveBeenCalledWith({ where: { bidId: 'bid-1' } });
      expect(prisma.rFQBidItem.createMany).toHaveBeenCalled();
      expect(prisma.rFQVendorBid.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'SUBMITTED',
            totalAmount: 200 * 100 + 420 * 50, // 20000 + 21000 = 41000
          }),
        }),
      );
      expect(result.message).toBe('Bid submitted successfully');
      expect(result.totalAmount).toBe(41000);
    });

    it('should reject bid for expired deadline', async () => {
      prisma.rFQVendorBid.findUnique.mockResolvedValue({
        ...bidInDb,
        rfq: { ...bidInDb.rfq, deadline: new Date('2020-01-01') },
      });

      await expect(service.submitBid('token-abc', { items: [], validityDays: 30 } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject bid that is already processed', async () => {
      prisma.rFQVendorBid.findUnique.mockResolvedValue({ ...bidInDb, status: 'ACCEPTED' });

      await expect(service.submitBid('token-abc', { items: [] } as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
