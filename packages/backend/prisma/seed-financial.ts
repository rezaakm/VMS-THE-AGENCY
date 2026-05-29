import { PrismaClient } from '@prisma/client';

const AUDIT_FLAGS = [
  {
    flagNumber: 1,
    title: 'Budget conflicts between two proposals',
    description:
      'Two competing budget proposals contain conflicting figures and assumptions.',
    severity: 'CRITICAL' as const,
    category: 'BUDGET' as const,
    assignedTo: 'Dinesh',
  },
  {
    flagNumber: 2,
    title: 'Revenue forecasting with no methodology',
    description:
      'Revenue projections lack documented methodology and supporting assumptions.',
    severity: 'HIGH' as const,
    category: 'REVENUE' as const,
    assignedTo: 'Dinesh',
  },
  {
    flagNumber: 3,
    title: 'Direct cost ratio at 63% (target under 55%)',
    description:
      'Direct costs are running at 63% of revenue; target is below 55%.',
    severity: 'CRITICAL' as const,
    category: 'COSTS' as const,
    assignedTo: 'Dinesh',
  },
  {
    flagNumber: 4,
    title: 'Unjustified OpEx increases',
    description: 'Operating expense increases lack variance analysis or approval trail.',
    severity: 'HIGH' as const,
    category: 'EXPENSES' as const,
    assignedTo: 'Dinesh',
  },
  {
    flagNumber: 5,
    title: 'AR collections stuck at OMR 57,100',
    description:
      'Accounts receivable collections have stalled with OMR 57,100 outstanding.',
    severity: 'HIGH' as const,
    category: 'AR' as const,
    assignedTo: 'Dinesh',
  },
  {
    flagNumber: 6,
    title: 'Missing staff settlements and salary inconsistencies',
    description:
      'Staff settlement records are incomplete; salary entries show inconsistencies.',
    severity: 'HIGH' as const,
    category: 'STAFF' as const,
    assignedTo: 'Dinesh',
  },
  {
    flagNumber: 7,
    title: '"Other Expenses" used as a dumping ground',
    description:
      'Miscellaneous expenses are being posted to Other Expenses without proper classification.',
    severity: 'MEDIUM' as const,
    category: 'EXPENSES' as const,
    assignedTo: 'Dinesh',
  },
  {
    flagNumber: 8,
    title: 'Owner current account — 13 months accumulated',
    description:
      'Owner current account balance has accumulated over 13 months without reconciliation.',
    severity: 'CRITICAL' as const,
    category: 'COMPLIANCE' as const,
    assignedTo: 'Dinesh',
  },
  {
    flagNumber: 9,
    title: 'No formal financial statements',
    description:
      'The agency does not produce formal monthly financial statements on a consistent basis.',
    severity: 'CRITICAL' as const,
    category: 'COMPLIANCE' as const,
    assignedTo: 'Dinesh',
  },
  {
    flagNumber: 10,
    title: 'Bank reconciliation non-existent',
    description: 'Bank accounts are not reconciled regularly against statements.',
    severity: 'CRITICAL' as const,
    category: 'RECONCILIATION' as const,
    assignedTo: 'Dinesh',
  },
  {
    flagNumber: 11,
    title: 'Budget arithmetic errors',
    description: 'Budget spreadsheets contain formula and arithmetic errors.',
    severity: 'MEDIUM' as const,
    category: 'BUDGET' as const,
    assignedTo: 'Dinesh',
  },
  {
    flagNumber: 12,
    title: 'Six missing financial processes',
    description:
      'Six core financial SOPs are not documented or not operating as defined processes.',
    severity: 'HIGH' as const,
    category: 'PROCESSES' as const,
    assignedTo: 'Reza',
  },
];

const CHECKLIST_ITEMS = [
  {
    name: 'Bank reconciliation',
    description: 'Reconcile all bank accounts against statements',
    frequency: 'MONTHLY' as const,
    owner: 'Dinesh',
    dueDay: 5,
    category: 'RECONCILIATION' as const,
  },
  {
    name: 'Owner current account review',
    description: 'Review and clear owner current account movements',
    frequency: 'MONTHLY' as const,
    owner: 'Dinesh',
    dueDay: 5,
    category: 'COMPLIANCE' as const,
  },
  {
    name: 'Monthly P&L preparation',
    description: 'Prepare and review profit and loss statement',
    frequency: 'MONTHLY' as const,
    owner: 'Dinesh',
    dueDay: 10,
    category: 'COMPLIANCE' as const,
  },
  {
    name: 'AR aging review',
    description: 'Review accounts receivable aging and follow up collections',
    frequency: 'WEEKLY' as const,
    owner: 'Dinesh',
    dueDay: null,
    category: 'AR' as const,
  },
];

const FINANCIAL_PROCESSES = [
  {
    name: 'Monthly bank reconciliation',
    description: 'Standard operating procedure for bank reconciliation',
    owner: 'Dinesh',
    frequency: 'MONTHLY' as const,
    status: 'NOT_STARTED' as const,
  },
  {
    name: 'Financial statement preparation',
    description: 'Monthly P&L and balance sheet preparation process',
    owner: 'Dinesh',
    frequency: 'MONTHLY' as const,
    status: 'NOT_STARTED' as const,
  },
  {
    name: 'AR collections follow-up',
    description: 'Weekly AR aging and collections workflow',
    owner: 'Dinesh',
    frequency: 'WEEKLY' as const,
    status: 'NOT_STARTED' as const,
  },
  {
    name: 'Budget variance review',
    description: 'Monthly budget vs actual variance analysis',
    owner: 'Reza',
    frequency: 'MONTHLY' as const,
    status: 'NOT_STARTED' as const,
  },
  {
    name: 'Payroll and staff settlements',
    description: 'Payroll processing and end-of-service settlement tracking',
    owner: 'Dinesh',
    frequency: 'MONTHLY' as const,
    status: 'NOT_STARTED' as const,
  },
  {
    name: 'Expense classification and approval',
    description: 'Expense coding, approval limits, and Other Expenses controls',
    owner: 'Reza',
    frequency: 'MONTHLY' as const,
    status: 'NOT_STARTED' as const,
  },
];

export async function seedFinancialOversight(prisma: PrismaClient) {
  const existing = await prisma.financialFlag.count();
  if (existing > 0) {
    console.log('⏭️  Financial oversight data already seeded');
    return;
  }

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 14);

  for (const flag of AUDIT_FLAGS) {
    await prisma.financialFlag.create({
      data: {
        ...flag,
        status: 'OPEN',
        deadline,
      },
    });
  }
  console.log(`✅ Seeded ${AUDIT_FLAGS.length} financial audit flags`);

  for (const item of CHECKLIST_ITEMS) {
    await prisma.financialChecklistItem.create({ data: item });
  }
  console.log(`✅ Seeded ${CHECKLIST_ITEMS.length} checklist items`);

  for (const process of FINANCIAL_PROCESSES) {
    await prisma.financialProcess.create({ data: process });
  }
  console.log(`✅ Seeded ${FINANCIAL_PROCESSES.length} financial processes`);
}
