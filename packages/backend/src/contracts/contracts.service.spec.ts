import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ContractsService', () => {
  let service: ContractsService;
  let prisma: any;

  const mockContract = {
    id: 'c-1',
    contractNumber: 'CNT2026000001',
    title: 'Annual Supply',
    vendorId: 'v1',
    status: 'ACTIVE',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    value: 100000,
    vendor: { id: 'v1', name: 'Vendor A', code: 'VEN001' },
  };

  beforeEach(async () => {
    prisma = {
      contract: {
        create: jest.fn().mockResolvedValue(mockContract),
        findMany: jest.fn().mockResolvedValue([mockContract]),
        findUnique: jest.fn().mockResolvedValue(mockContract),
        update: jest.fn().mockResolvedValue(mockContract),
        delete: jest.fn().mockResolvedValue(mockContract),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ContractsService>(ContractsService);
  });

  describe('create', () => {
    it('should generate contract number and create', async () => {
      const dto = { title: 'New Contract', vendorId: 'v1', value: 50000 };
      await service.create(dto as any);

      expect(prisma.contract.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contractNumber: 'CNT2026000001',
            title: 'New Contract',
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return all contracts', async () => {
      const result = await service.findAll();
      expect(result).toHaveLength(1);
    });

    it('should filter by status', async () => {
      await service.findAll({ status: 'ACTIVE' });
      expect(prisma.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
    });

    it('should filter by vendorId', async () => {
      await service.findAll({ vendorId: 'v1' });
      expect(prisma.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ vendorId: 'v1' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return contract by id', async () => {
      const result = await service.findOne('c-1');
      expect(result.contractNumber).toBe('CNT2026000001');
    });

    it('should throw NotFoundException', async () => {
      prisma.contract.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update contract', async () => {
      await service.update('c-1', { title: 'Updated' } as any);
      expect(prisma.contract.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c-1' },
          data: { title: 'Updated' },
        }),
      );
    });
  });

  describe('remove', () => {
    it('should delete contract', async () => {
      const result = await service.remove('c-1');
      expect(result.message).toBe('Contract deleted successfully');
    });
  });

  describe('getExpiringContracts', () => {
    it('should query active contracts expiring within days', async () => {
      await service.getExpiringContracts(30);
      expect(prisma.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
            endDate: expect.objectContaining({
              lte: expect.any(Date),
              gte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('should default to 30 days', async () => {
      await service.getExpiringContracts();
      expect(prisma.contract.findMany).toHaveBeenCalled();
    });
  });
});
