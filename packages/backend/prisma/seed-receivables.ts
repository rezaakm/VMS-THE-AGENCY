import { PrismaClient } from '@prisma/client';

/** Sample AR aligned with April 2026 audit (~OMR 57,100 outstanding). */
const RECEIVABLES = [
  {
    clientName: 'National Bank of Oman',
    reference: 'AR-2025-014',
    description: 'Event production — Q4 2025 balance',
    amount: 18500,
    paidAmount: 0,
    daysOverdue: 45,
  },
  {
    clientName: 'Omantel',
    reference: 'AR-2025-022',
    description: 'Brand activation campaign',
    amount: 15200,
    paidAmount: 0,
    daysOverdue: 62,
  },
  {
    clientName: 'PDO',
    reference: 'AR-2026-003',
    description: 'Corporate pavilion — partial billing',
    amount: 12800,
    paidAmount: 0,
    daysOverdue: 28,
  },
  {
    clientName: 'Ministry of Tourism',
    reference: 'AR-2025-031',
    description: 'Tourism roadshow deliverables',
    amount: 10600,
    paidAmount: 0,
    daysOverdue: 90,
  },
];

export async function seedClientReceivables(prisma: PrismaClient) {
  const existing = await prisma.clientReceivable.count();
  if (existing > 0) {
    console.log('⏭️  Client receivables already seeded');
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const row of RECEIVABLES) {
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() - row.daysOverdue);
    const invoiceDate = new Date(dueDate);
    invoiceDate.setDate(invoiceDate.getDate() - 30);

    await prisma.clientReceivable.create({
      data: {
        clientName: row.clientName,
        reference: row.reference,
        description: row.description,
        invoiceDate,
        dueDate,
        amount: row.amount,
        paidAmount: row.paidAmount,
        status: row.paidAmount >= row.amount ? 'PAID' : 'PENDING',
      },
    });
  }

  const total = RECEIVABLES.reduce((s, r) => s + r.amount - r.paidAmount, 0);
  console.log(
    `✅ Seeded ${RECEIVABLES.length} client receivables (OMR ${total.toLocaleString()} outstanding)`,
  );
}
