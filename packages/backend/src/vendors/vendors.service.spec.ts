import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { PrismaService } from '../prisma/prisma.service';

describe('VendorsService', () => {
  let service: VendorsService;
  let prisma: any;

  const mockVendor = {
    id: 'vendor-1',
    name: 'Global Supplies Ltd',
    code: 'VEN000001',
    email: 'info@global.com',
    phone: '+968 9999 0000',
    category: 'Materials',
    status: 'ACTIVE',
    contacts: [],
    documents: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      vendor: {
        create: jest.fn().mockResolvedValue(mockVendor),
        findMany: jest.fn().mockResolvedValue([mockVendor]),
        findUnique: jest.fn().mockResolvedValue(mockVendor),
        update: jest.fn().mockResolvedValue(mockVendor),
        delete: jest.fn().mockResolvedValue(mockVendor),
        count: jest.fn().mockResolvedValue(5),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VendorsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<VendorsService>(VendorsService);
  });

  describe('create', () => {
    it('should generate a vendor code and create vendor', async () => {
      const dto = { name: 'New Vendor', email: 'new@vendor.com', category: 'IT' };
      const result = await service.create(dto as any);

      expect(prisma.vendor.count).toHaveBeenCalled();
      expect(prisma.vendor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'New Vendor', code: 'VEN000006' }),
        }),
      );
      expect(result).toEqual(mockVendor);
    });
  });

  describe('findAll', () => {
    it('should return all vendors without filters', async () => {
      const result = await service.findAll();
      expect(prisma.vendor.findMany).toHaveBeenCalled();
      expect(result).toEqual([mockVendor]);
    });

    it('should apply status filter', async () => {
      await service.findAll({ status: 'ACTIVE' });
      expect(prisma.vendor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
    });

    it('should apply search filter with OR conditions', async () => {
      await service.findAll({ search: 'global' });
      expect(prisma.vendor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.any(Object) }),
            ]),
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return vendor by ID', async () => {
      const result = await service.findOne('vendor-1');
      expect(prisma.vendor.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'vendor-1' } }),
      );
      expect(result).toEqual(mockVendor);
    });

    it('should throw NotFoundException for non-existent vendor', async () => {
      prisma.vendor.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update vendor after confirming existence', async () => {
      const result = await service.update('vendor-1', { name: 'Updated' } as any);
      expect(prisma.vendor.findUnique).toHaveBeenCalled();
      expect(prisma.vendor.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'vendor-1' },
          data: { name: 'Updated' },
        }),
      );
      expect(result).toEqual(mockVendor);
    });
  });

  describe('remove', () => {
    it('should delete vendor after confirming existence', async () => {
      const result = await service.remove('vendor-1');
      expect(prisma.vendor.delete).toHaveBeenCalledWith({ where: { id: 'vendor-1' } });
      expect(result.message).toBe('Vendor deleted successfully');
    });
  });

  describe('updateStatus', () => {
    it('should update vendor status', async () => {
      await service.updateStatus('vendor-1', 'BLACKLISTED' as any);
      expect(prisma.vendor.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'vendor-1' },
          data: { status: 'BLACKLISTED' },
        }),
      );
    });
  });

  describe('getStats', () => {
    it('should return counts by status', async () => {
      prisma.vendor.count
        .mockResolvedValueOnce(10)   // total
        .mockResolvedValueOnce(7)    // active
        .mockResolvedValueOnce(2)    // pending
        .mockResolvedValueOnce(1);   // blacklisted

      const result = await service.getStats();
      expect(result).toEqual({ total: 10, active: 7, pending: 2, blacklisted: 1 });
    });
  });

  describe('getTopVendors', () => {
    it('should return top vendors ordered by performance', async () => {
      await service.getTopVendors(5);
      expect(prisma.vendor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'ACTIVE' },
          take: 5,
          orderBy: [{ performanceScore: 'desc' }, { totalSpent: 'desc' }],
        }),
      );
    });

    it('should default to limit 10', async () => {
      await service.getTopVendors();
      expect(prisma.vendor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });
});
