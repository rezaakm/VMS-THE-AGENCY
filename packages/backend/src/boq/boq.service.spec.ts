import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BoqService } from './boq.service';
import { PrismaService } from '../prisma/prisma.service';
import { CostEngineService } from '../cost-engine/cost-engine.service';
import { GoogleDriveService } from '../cost-sheets/google-drive.service';

describe('BoqService', () => {
  let service: BoqService;
  let prisma: any;
  let costEngine: any;
  let driveService: any;

  const mockBoq = {
    id: 'boq-1',
    boqNumber: 'BOQ-2026-001',
    title: 'Exhibition Stand',
    projectName: 'Oman Energy 2026',
    clientName: 'PDO',
    status: 'DRAFT',
    totalCost: 5000,
    totalSelling: 7000,
    margin: 28.6,
    drawingCount: 2,
    createdById: 'u1',
    createdBy: { id: 'u1', firstName: 'Admin', lastName: 'User', email: 'admin@vms.com' },
    drawings: [
      { id: 'd1', fileName: 'floor-plan.pdf', mimeType: 'application/pdf', aiNotes: '12x8m booth' },
    ],
    items: [
      {
        id: 'item-1', boqId: 'boq-1', itemNumber: 1, section: 'Structural', sectionNumber: '1',
        description: 'Aluminium extrusion frame', quantity: 50, unit: 'metre',
        unitCost: 5, totalCost: 250, unitSelling: 7, totalSelling: 350,
        priceSource: 'COST_SHEET', priceConfidence: 0.8,
      },
      {
        id: 'item-2', boqId: 'boq-1', itemNumber: 2, section: 'Finishes', sectionNumber: '2',
        description: 'PVC fabric 510gsm', quantity: 96, unit: 'sqm',
        unitCost: 12, totalCost: 1152, unitSelling: 16, totalSelling: 1536,
        priceSource: 'VENDOR_PO', priceConfidence: 0.9,
      },
      {
        id: 'item-3', boqId: 'boq-1', itemNumber: 3, section: 'Lighting', sectionNumber: '3',
        description: 'LED spotlight 50W', quantity: 20, unit: 'piece',
        unitCost: 0, totalCost: 0, unitSelling: 0, totalSelling: 0,
        priceSource: 'NONE', priceConfidence: 0,
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      bOQ: {
        create: jest.fn().mockResolvedValue(mockBoq),
        findMany: jest.fn().mockResolvedValue([mockBoq]),
        findUnique: jest.fn().mockResolvedValue(mockBoq),
        update: jest.fn().mockResolvedValue(mockBoq),
        delete: jest.fn().mockResolvedValue(mockBoq),
        count: jest.fn().mockResolvedValue(0),
      },
      bOQItem: {
        create: jest.fn().mockResolvedValue(mockBoq.items[0]),
        createMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue(mockBoq.items),
        findUnique: jest.fn().mockResolvedValue(mockBoq.items[0]),
        update: jest.fn().mockResolvedValue(mockBoq.items[0]),
        delete: jest.fn(),
      },
      bOQDrawing: {
        updateMany: jest.fn(),
      },
      costSheetItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    costEngine = {
      getBestPrice: jest.fn().mockResolvedValue({ unitPrice: 10, source: 'COST_SHEET', confidence: 0.8 }),
    };

    driveService = {
      syncFolder: jest.fn().mockResolvedValue({ filesFound: 5, filesProcessed: 3, filesSkipped: 2, errors: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoqService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(null) } },
        { provide: CostEngineService, useValue: costEngine },
        { provide: GoogleDriveService, useValue: driveService },
      ],
    }).compile();

    service = module.get<BoqService>(BoqService);
  });

  describe('findAll', () => {
    it('should return all BOQs', async () => {
      const result = await service.findAll();
      expect(prisma.bOQ.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should filter by status', async () => {
      await service.findAll({ status: 'DRAFT' });
      expect(prisma.bOQ.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'DRAFT' }),
        }),
      );
    });

    it('should filter by search', async () => {
      await service.findAll({ search: 'exhibition' });
      expect(prisma.bOQ.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return BOQ with items and drawings', async () => {
      const result = await service.findOne('boq-1');
      expect(result.boqNumber).toBe('BOQ-2026-001');
      expect(result.items).toHaveLength(3);
      expect(result.drawings).toHaveLength(1);
    });

    it('should throw NotFoundException for missing BOQ', async () => {
      prisma.bOQ.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateItem', () => {
    it('should update item and recalculate totals', async () => {
      await service.updateItem('item-1', { quantity: 100, unitCost: 6 });

      expect(prisma.bOQItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-1' },
          data: expect.objectContaining({
            quantity: 100,
            unitCost: 6,
            totalCost: 600,
            priceSource: 'MANUAL',
            priceConfidence: 1.0,
          }),
        }),
      );
    });

    it('should throw NotFoundException for missing item', async () => {
      prisma.bOQItem.findUnique.mockResolvedValue(null);
      await expect(service.updateItem('bad', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeItem', () => {
    it('should delete item and recalculate totals', async () => {
      const result = await service.removeItem('item-1');
      expect(prisma.bOQItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } });
      expect(result.message).toBe('Item removed');
    });

    it('should throw NotFoundException for missing item', async () => {
      prisma.bOQItem.findUnique.mockResolvedValue(null);
      await expect(service.removeItem('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addItem', () => {
    it('should add item with manual pricing', async () => {
      await service.addItem('boq-1', {
        description: 'New item',
        quantity: 10,
        unit: 'piece',
        unitCost: 25,
        unitSelling: 35,
      });

      expect(prisma.bOQItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            boqId: 'boq-1',
            itemNumber: 4, // max(1,2,3) + 1
            description: 'New item',
            quantity: 10,
            totalCost: 250,
            totalSelling: 350,
            priceSource: 'MANUAL',
          }),
        }),
      );
    });
  });

  describe('repriceAll', () => {
    it('should look up prices for all items from cost engine', async () => {
      const result = await service.repriceAll('boq-1');

      // All 3 items attempted, costEngine returns 10 OMR for each
      expect(costEngine.getBestPrice).toHaveBeenCalledTimes(3);
      expect(result.total).toBe(3);
      expect(result.updated).toBe(3);
    });
  });

  describe('syncAndReprice', () => {
    it('should sync Drive then reprice', async () => {
      const result = await service.syncAndReprice('boq-1');

      expect(driveService.syncFolder).toHaveBeenCalled();
      expect(result.sync.filesProcessed).toBe(3);
      expect(result.reprice.total).toBe(3);
    });

    it('should still reprice if Drive sync fails', async () => {
      driveService.syncFolder.mockRejectedValue(new Error('No credentials'));

      const result = await service.syncAndReprice('boq-1');
      expect(result.sync.message).toContain('not configured');
      expect(result.reprice.total).toBe(3);
    });
  });

  describe('updateStatus', () => {
    it('should update BOQ status', async () => {
      await service.updateStatus('boq-1', 'APPROVED');
      expect(prisma.bOQ.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'boq-1' },
          data: { status: 'APPROVED' },
        }),
      );
    });
  });

  describe('remove', () => {
    it('should delete BOQ', async () => {
      const result = await service.remove('boq-1');
      expect(prisma.bOQ.delete).toHaveBeenCalledWith({ where: { id: 'boq-1' } });
      expect(result.message).toBe('BOQ deleted');
    });
  });

  describe('create', () => {
    it('should reject when no files provided', async () => {
      await expect(
        service.create({ title: 'Test' } as any, 'u1', []),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when files is undefined', async () => {
      await expect(
        service.create({ title: 'Test' } as any, 'u1', undefined as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
