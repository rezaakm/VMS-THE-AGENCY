import { Test, TestingModule } from '@nestjs/testing';
import { BoqController } from './boq.controller';
import { BoqService } from './boq.service';

describe('BoqController', () => {
  let controller: BoqController;
  let service: jest.Mocked<Partial<BoqService>>;

  const mockBoq = { id: 'boq-1', boqNumber: 'BOQ-2026-001', title: 'Stand', status: 'DRAFT' };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue(mockBoq),
      findAll: jest.fn().mockResolvedValue([mockBoq]),
      findOne: jest.fn().mockResolvedValue(mockBoq),
      updateItem: jest.fn().mockResolvedValue({ id: 'item-1' }),
      addItem: jest.fn().mockResolvedValue({ id: 'item-new' }),
      removeItem: jest.fn().mockResolvedValue({ message: 'removed' }),
      updateStatus: jest.fn().mockResolvedValue(mockBoq),
      repriceAll: jest.fn().mockResolvedValue({ updated: 5, total: 10 }),
      syncAndReprice: jest.fn().mockResolvedValue({ sync: {}, reprice: { updated: 5, total: 10 } }),
      remove: jest.fn().mockResolvedValue({ message: 'deleted' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BoqController],
      providers: [{ provide: BoqService, useValue: service }],
    }).compile();

    controller = module.get<BoqController>(BoqController);
  });

  it('create - passes dto, user id, and files', async () => {
    const req = { user: { id: 'u1' } };
    const files = [{ originalname: 'plan.pdf' }] as any;
    await controller.create({ title: 'Test' } as any, req, files);
    expect(service.create).toHaveBeenCalledWith({ title: 'Test' }, 'u1', files);
  });

  it('findAll - passes query filters', async () => {
    await controller.findAll({ status: 'DRAFT', search: 'test' });
    expect(service.findAll).toHaveBeenCalledWith({ status: 'DRAFT', search: 'test' });
  });

  it('findOne - passes id', async () => {
    await controller.findOne('boq-1');
    expect(service.findOne).toHaveBeenCalledWith('boq-1');
  });

  it('updateStatus - passes id and status', async () => {
    await controller.updateStatus('boq-1', 'APPROVED');
    expect(service.updateStatus).toHaveBeenCalledWith('boq-1', 'APPROVED');
  });

  it('repriceAll - passes id', async () => {
    const result = await controller.repriceAll('boq-1');
    expect(service.repriceAll).toHaveBeenCalledWith('boq-1');
    expect(result.updated).toBe(5);
  });

  it('syncAndReprice - passes id', async () => {
    const result = await controller.syncAndReprice('boq-1');
    expect(service.syncAndReprice).toHaveBeenCalledWith('boq-1');
    expect(result.reprice.updated).toBe(5);
  });

  it('addItem - passes boqId and dto', async () => {
    await controller.addItem('boq-1', { description: 'New', quantity: 1, unit: 'piece' });
    expect(service.addItem).toHaveBeenCalledWith('boq-1', { description: 'New', quantity: 1, unit: 'piece' });
  });

  it('updateItem - passes itemId and dto', async () => {
    await controller.updateItem('item-1', { quantity: 10 } as any);
    expect(service.updateItem).toHaveBeenCalledWith('item-1', { quantity: 10 });
  });

  it('removeItem - passes itemId', async () => {
    const result = await controller.removeItem('item-1');
    expect(result.message).toBe('removed');
  });

  it('remove - passes id', async () => {
    const result = await controller.remove('boq-1');
    expect(result.message).toBe('deleted');
  });
});
