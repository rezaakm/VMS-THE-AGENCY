import { Test, TestingModule } from '@nestjs/testing';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';

describe('VendorsController', () => {
  let controller: VendorsController;
  let service: jest.Mocked<Partial<VendorsService>>;

  const mockVendor = { id: 'v1', name: 'Test Vendor', code: 'VEN000001' };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue(mockVendor),
      findAll: jest.fn().mockResolvedValue([mockVendor]),
      findOne: jest.fn().mockResolvedValue(mockVendor),
      update: jest.fn().mockResolvedValue(mockVendor),
      remove: jest.fn().mockResolvedValue({ message: 'deleted' }),
      updateStatus: jest.fn().mockResolvedValue(mockVendor),
      getStats: jest.fn().mockResolvedValue({ total: 5 }),
      getTopVendors: jest.fn().mockResolvedValue([mockVendor]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VendorsController],
      providers: [{ provide: VendorsService, useValue: service }],
    }).compile();

    controller = module.get<VendorsController>(VendorsController);
  });

  it('create - delegates to service', async () => {
    const dto = { name: 'New', email: 'n@v.com' };
    const result = await controller.create(dto as any);
    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockVendor);
  });

  it('findAll - passes query filters', async () => {
    const query = { status: 'ACTIVE', search: 'test' };
    await controller.findAll(query);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('findOne - passes id', async () => {
    await controller.findOne('v1');
    expect(service.findOne).toHaveBeenCalledWith('v1');
  });

  it('update - passes id and dto', async () => {
    await controller.update('v1', { name: 'Updated' } as any);
    expect(service.update).toHaveBeenCalledWith('v1', { name: 'Updated' });
  });

  it('remove - passes id', async () => {
    const result = await controller.remove('v1');
    expect(service.remove).toHaveBeenCalledWith('v1');
    expect(result.message).toBe('deleted');
  });

  it('updateStatus - passes id and status', async () => {
    await controller.updateStatus('v1', 'BLACKLISTED');
    expect(service.updateStatus).toHaveBeenCalledWith('v1', 'BLACKLISTED');
  });

  it('getStats - returns stats', async () => {
    const result = await controller.getStats();
    expect(result).toEqual({ total: 5 });
  });

  it('getTopVendors - parses limit', async () => {
    await controller.getTopVendors('5');
    expect(service.getTopVendors).toHaveBeenCalledWith(5);
  });

  it('getTopVendors - defaults to 10 when no limit', async () => {
    await controller.getTopVendors(undefined);
    expect(service.getTopVendors).toHaveBeenCalledWith(10);
  });
});
