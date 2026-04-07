import { Test, TestingModule } from '@nestjs/testing';
import { RfqsController } from './rfqs.controller';
import { RfqsService } from './rfqs.service';
import { RfqEmailService } from './rfqs.email.service';

describe('RfqsController', () => {
  let controller: RfqsController;
  let rfqsService: jest.Mocked<Partial<RfqsService>>;
  let emailService: jest.Mocked<Partial<RfqEmailService>>;

  const mockRfq = {
    id: 'rfq-1',
    rfqNumber: 'RFQ-2026-001',
    title: 'Materials',
    status: 'DRAFT',
    items: [{ id: 'i1', description: 'Steel', quantity: 100, unit: 'piece', itemNumber: 1 }],
    vendorBids: [],
  };

  beforeEach(async () => {
    rfqsService = {
      create: jest.fn().mockResolvedValue(mockRfq),
      findAll: jest.fn().mockResolvedValue([mockRfq]),
      findOne: jest.fn().mockResolvedValue(mockRfq),
      update: jest.fn().mockResolvedValue(mockRfq),
      remove: jest.fn().mockResolvedValue({ message: 'deleted' }),
      sendToVendors: jest.fn(),
      compareBids: jest.fn().mockResolvedValue({ comparison: [], vendorTotals: [] }),
      awardBid: jest.fn().mockResolvedValue(mockRfq),
      getBidByToken: jest.fn(),
      submitBid: jest.fn().mockResolvedValue({ message: 'submitted', totalAmount: 5000 }),
    };

    emailService = {
      sendRfqInvite: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RfqsController],
      providers: [
        { provide: RfqsService, useValue: rfqsService },
        { provide: RfqEmailService, useValue: emailService },
      ],
    }).compile();

    controller = module.get<RfqsController>(RfqsController);
  });

  it('create - passes dto and user id', async () => {
    const req = { user: { id: 'u1' } };
    await controller.create({ title: 'Test', items: [] } as any, req);
    expect(rfqsService.create).toHaveBeenCalledWith({ title: 'Test', items: [] }, 'u1');
  });

  it('findAll - passes query filters', async () => {
    await controller.findAll({ status: 'DRAFT' as any });
    expect(rfqsService.findAll).toHaveBeenCalledWith({ status: 'DRAFT' });
  });

  it('findOne - passes id', async () => {
    await controller.findOne('rfq-1');
    expect(rfqsService.findOne).toHaveBeenCalledWith('rfq-1');
  });

  it('update - passes id and dto', async () => {
    await controller.update('rfq-1', { title: 'Updated' });
    expect(rfqsService.update).toHaveBeenCalledWith('rfq-1', { title: 'Updated' });
  });

  it('remove - passes id', async () => {
    const result = await controller.remove('rfq-1');
    expect(result.message).toBe('deleted');
  });

  it('send - sends to vendors and triggers emails', async () => {
    rfqsService.sendToVendors.mockResolvedValue({
      rfq: { ...mockRfq, status: 'SENT' } as any,
      sendLinks: [
        { vendorId: 'v1', vendorName: 'A', vendorEmail: 'a@v.com', token: 't1', bidUrl: 'url', whatsappUrl: null, status: 'PENDING', vendorPhone: null },
      ],
    });

    await controller.send('rfq-1', { vendorIds: ['v1'] });
    expect(rfqsService.sendToVendors).toHaveBeenCalledWith('rfq-1', ['v1']);
    expect(emailService.sendRfqInvite).toHaveBeenCalled();
  });

  it('compare - returns comparison', async () => {
    await controller.compare('rfq-1');
    expect(rfqsService.compareBids).toHaveBeenCalledWith('rfq-1');
  });

  it('award - passes rfqId and bidId', async () => {
    await controller.award('rfq-1', 'bid-1');
    expect(rfqsService.awardBid).toHaveBeenCalledWith('rfq-1', 'bid-1');
  });

  it('getBid (public) - passes token', async () => {
    await controller.getBid('token-abc');
    expect(rfqsService.getBidByToken).toHaveBeenCalledWith('token-abc');
  });

  it('submitBid (public) - passes token and dto', async () => {
    const dto = { items: [], validityDays: 30 };
    await controller.submitBid('token-abc', dto as any);
    expect(rfqsService.submitBid).toHaveBeenCalledWith('token-abc', dto);
  });
});
