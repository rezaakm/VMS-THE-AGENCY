import { FinancialOversightService } from './financial-oversight.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

describe('FinancialOversightService', () => {
  let service: FinancialOversightService;
  let prisma: {
    financialFlag: { updateMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    flagResponse: { findUnique: jest.Mock; update: jest.Mock };
  };
  let auditLog: { log: jest.Mock };

  beforeEach(() => {
    prisma = {
      financialFlag: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      flagResponse: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    auditLog = { log: jest.fn().mockResolvedValue(null) };
    service = new FinancialOversightService(
      prisma as unknown as PrismaService,
      auditLog as unknown as AuditLogService,
    );
  });

  it('escalateOverdueFlags updates past-deadline flags', async () => {
    const count = await service.escalateOverdueFlags();
    expect(count).toBe(2);
    expect(prisma.financialFlag.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'OVERDUE' },
      }),
    );
  });

  it('gradeResponse resolves flag when grade is ADEQUATE', async () => {
    prisma.flagResponse.findUnique.mockResolvedValue({
      id: 'resp-1',
      flagId: 'flag-1',
      flag: { id: 'flag-1' },
    });
    prisma.flagResponse.update.mockResolvedValue({ id: 'resp-1', grade: 'ADEQUATE' });

    await service.gradeResponse(
      'resp-1',
      { grade: 'ADEQUATE', reviewerNotes: 'Good' },
      'user-1',
    );

    expect(prisma.financialFlag.update).toHaveBeenCalledWith({
      where: { id: 'flag-1' },
      data: { status: 'RESOLVED' },
    });
    expect(auditLog.log).toHaveBeenCalledWith(
      'user-1',
      'GRADE',
      'FLAG_RESPONSE',
      'resp-1',
      expect.objectContaining({ grade: 'ADEQUATE' }),
    );
  });
});
