import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ReportsService AR aging', () => {
  it('buckets outstanding receivables by age', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oldDue = new Date(today);
    oldDue.setDate(oldDue.getDate() - 45);

    const prisma = {
      clientReceivable: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: '1',
            clientName: 'Client A',
            reference: 'AR-1',
            dueDate: oldDue,
            amount: 1000,
            paidAmount: 0,
            status: 'PENDING',
          },
        ]),
      },
    };

    const service = new ReportsService(prisma as unknown as PrismaService);
    const result = await service.getArAging();

    expect(result.buckets.total).toBe(1000);
    expect(result.buckets.days31_60).toBe(1000);
    expect(result.details).toHaveLength(1);
  });
});
